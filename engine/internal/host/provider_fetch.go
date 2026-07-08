package host

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/voocel/ainovel-cli/internal/bootstrap"
)

const fetchModelsTimeout = 15 * time.Second

// openAIListResponse OpenAI /v1/models 响应格式。
type openAIListResponse struct {
	Data []openAIModelRef `json:"data"`
}

type openAIModelRef struct {
	ID string `json:"id"`
}

// FetchProviderModels 调用 provider 的 /v1/models（或 /models）端点，
// 拉取模型列表并写入 providers.<name>.models，然后持久化。
// providerName 为 "all" 时遍历所有已配置 provider。
func (h *Host) FetchProviderModels(providerName string) ([]string, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	if strings.TrimSpace(providerName) == "all" || strings.TrimSpace(providerName) == "" {
		return h.fetchAllProviderModelsLocked()
	}
	return h.fetchSingleProviderModelsLocked(providerName)
}

func (h *Host) fetchAllProviderModelsLocked() ([]string, error) {
	var fetched []string
	var errs []string
	// 按名称排序，保证输出稳定
	names := make([]string, 0, len(h.cfg.Providers))
	for name := range h.cfg.Providers {
		names = append(names, name)
	}
	sort.Strings(names)

	for _, name := range names {
		models, err := h.fetchSingleProviderModelsLocked(name)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s: %v", name, err))
			continue
		}
		fetched = append(fetched, fmt.Sprintf("%s (%d个模型)", name, len(models)))
	}
	if len(errs) > 0 {
		return fetched, fmt.Errorf("部分 provider 拉取失败:\n%s", strings.Join(errs, "\n"))
	}
	return fetched, nil
}

func (h *Host) fetchSingleProviderModelsLocked(providerName string) ([]string, error) {
	pc, ok := h.cfg.Providers[providerName]
	if !ok {
		return nil, fmt.Errorf("provider %q 不存在", providerName)
	}

	// 确定协议类型：只有 OpenAI 兼容端支持 /models 端点
	providerType, err := pc.ProviderType(providerName)
	if err != nil {
		return nil, fmt.Errorf("provider %q 无法确定协议类型: %w", providerName, err)
	}
	if providerType != "openai" {
		return nil, fmt.Errorf("provider %q 协议类型为 %q，不支持自动拉取模型（仅 OpenAI 兼容端支持 /models）", providerName, providerType)
	}

	// 构建请求 URL
	baseURL := strings.TrimRight(pc.BaseURL, "/")
	if baseURL == "" {
		return nil, fmt.Errorf("provider %q 未配置 base_url", providerName)
	}

	// 智能处理 base_url：
	// - 已含 /v1 → GET {baseURL}/models
	// - 路径型（例 /openai）→ GET {baseURL}/v1/models（DeepSeek/豆包等兼容端点）
	// - 根路径 → GET {baseURL}/v1/models
	var url string
	if strings.HasSuffix(baseURL, "/v1") {
		url = baseURL + "/models"
	} else if strings.Contains(baseURL, "/") && !strings.HasSuffix(baseURL, "/v1") {
		// 可能是类似 https://api.longcat.chat/openai 的路径型
		url = baseURL + "/v1/models"
	} else {
		url = baseURL + "/v1/models"
	}

	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("构造请求失败: %w", err)
	}
	req.Header.Set("Accept", "application/json")
	if pc.APIKey != "" {
		req.Header.Set("Authorization", "Bearer "+pc.APIKey)
	}

	client := &http.Client{Timeout: fetchModelsTimeout}
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("请求 %s 失败: %w", url, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%s 返回 %d", url, resp.StatusCode)
	}

	var result openAIListResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("解析 %s 响应失败: %w", url, err)
	}

	models := make([]string, 0, len(result.Data))
	for _, m := range result.Data {
		id := strings.TrimSpace(m.ID)
		if id != "" {
			models = append(models, id)
		}
	}

	if len(models) == 0 {
		return nil, fmt.Errorf("%s 返回了空模型列表", url)
	}

	// 写入配置
	h.cfg.SetCandidateModels(providerName, models)

	// 持久化
	if path := bootstrap.DefaultConfigPath(); path != "" {
		if err := bootstrap.SaveConfig(path, h.cfg); err != nil {
			slog.Warn("保存配置失败", "module", "host", "err", err)
		}
	}

	h.emitEvent(Event{
		Time:     time.Now(),
		Category: "SYSTEM",
		Summary:  fmt.Sprintf("已从 %s 拉取 %d 个模型到 provider %q", url, len(models), providerName),
		Level:    "info",
	})

	return models, nil
}

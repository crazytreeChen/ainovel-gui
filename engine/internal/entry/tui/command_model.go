package tui

import (
	"fmt"
	"strings"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/lipgloss"
	"github.com/voocel/agentcore"
	"github.com/voocel/ainovel-cli/internal/bootstrap"
)

type modelRuntime interface {
	ConfiguredProviders() []string
	ConfiguredModels(provider string) []string
	CurrentModelSelection(role string) (string, string, bool)
	AvailableThinking(role string) []agentcore.ThinkingLevel
	CurrentThinking(role string) string
	SwitchModel(role, provider, model string) error
	SetRoleThinking(role, level string) error
	AddProvider(name string) error
	AddModel(provider, model string) error
}

type modelSwitchFocus int

const (
	modelFocusRole modelSwitchFocus = iota
	modelFocusProvider
	modelFocusModel
	modelFocusThinking
	modelFocusAddProvider // 新增 provider 输入模式
	modelFocusAddModel    // 新增 model 输入模式
	maxModelFocus
)

type modelRoleOption struct {
	Key   string
	Label string
}

// modelRoleOptions 从 bootstrap.AllRoles 派生，保持单一数据源。
var modelRoleOptions = func() []modelRoleOption {
	opts := make([]modelRoleOption, len(bootstrap.AllRoles))
	for i, r := range bootstrap.AllRoles {
		opts[i] = modelRoleOption{Key: r.Key, Label: r.Label}
	}
	return opts
}()

type thinkingOption struct{ Key, Label string }

var allThinkingOptions = []thinkingOption{
	{"", "默认(继承)"},
	{"off", "关闭"},
	{"low", "低"},
	{"medium", "中"},
	{"high", "高"},
	{"xhigh", "极高"},
	{"max", "最高"},
}

func thinkingOptionsFor(rt modelRuntime, role string) []thinkingOption {
	levels := rt.AvailableThinking(role)
	if len(levels) == 0 {
		return []thinkingOption{allThinkingOptions[0]}
	}
	out := make([]thinkingOption, 0, len(levels))
	for _, level := range levels {
		key := string(level)
		for _, option := range allThinkingOptions {
			if option.Key == key {
				out = append(out, option)
				break
			}
		}
	}
	if len(out) == 0 {
		return []thinkingOption{allThinkingOptions[0]}
	}
	return out
}

func thinkingIndexOf(options []thinkingOption, level string) int {
	level = strings.ToLower(strings.TrimSpace(level))
	for i, o := range options {
		if o.Key == level {
			return i
		}
	}
	return 0 // 未知值 → 继承
}

type modelSwitchState struct {
	focus           modelSwitchFocus
	roleIdx         int
	providerIdx     int
	modelIdx        int
	thinkingIdx     int
	providers       []string
	models          []string
	thinking        []thinkingOption
	message         string
	customInput     string // 手动输入新 provider / 新模型的临时文本
	customInputDone bool   // 提交后标记，下次 sync 清空
}

func newModelSwitchState(rt modelRuntime, roleHint string) *modelSwitchState {
	state := &modelSwitchState{
		providers: rt.ConfiguredProviders(),
	}
	if len(state.providers) == 0 {
		state.message = "当前没有可用 provider，按 i 输入新 provider"
	}

	roleHint = normalizeRoleKey(roleHint)
	for i, opt := range modelRoleOptions {
		if opt.Key == roleHint {
			state.roleIdx = i
			break
		}
	}
	state.syncSelection(rt)
	return state
}

func normalizeRoleKey(role string) string {
	role = strings.ToLower(strings.TrimSpace(role))
	if role == "" {
		return "default"
	}
	for _, r := range bootstrap.AllRoles {
		if r.Key == role {
			return role
		}
	}
	return ""
}

func (s *modelSwitchState) role() string {
	return modelRoleOptions[s.roleIdx].Key
}

func (s *modelSwitchState) roleLabel() string {
	return modelRoleOptions[s.roleIdx].Label
}

func (s *modelSwitchState) provider() string {
	if len(s.providers) == 0 || s.providerIdx < 0 || s.providerIdx >= len(s.providers) {
		return ""
	}
	return s.providers[s.providerIdx]
}

func (s *modelSwitchState) model() string {
	if len(s.models) == 0 || s.modelIdx < 0 || s.modelIdx >= len(s.models) {
		return ""
	}
	return s.models[s.modelIdx]
}

func (s *modelSwitchState) thinkingKey() string {
	if s.thinkingIdx < 0 || s.thinkingIdx >= len(s.thinking) {
		return ""
	}
	return s.thinking[s.thinkingIdx].Key
}

func (s *modelSwitchState) thinkingLabel() string {
	if s.thinkingIdx < 0 || s.thinkingIdx >= len(s.thinking) {
		return allThinkingOptions[0].Label
	}
	return s.thinking[s.thinkingIdx].Label
}

func (s *modelSwitchState) moveFocus(delta int) {
	s.focus = modelSwitchFocus((int(s.focus) + delta + int(maxModelFocus)) % int(maxModelFocus))
}

func (s *modelSwitchState) cycle(delta int, rt modelRuntime) {
	switch s.focus {
	case modelFocusRole:
		total := len(modelRoleOptions)
		s.roleIdx = (s.roleIdx + delta + total) % total
		s.syncSelection(rt)
	case modelFocusProvider:
		if len(s.providers) == 0 {
			return
		}
		total := len(s.providers)
		s.providerIdx = (s.providerIdx + delta + total) % total
		s.syncModels(rt, "")
	case modelFocusModel:
		if len(s.models) == 0 {
			return
		}
		total := len(s.models)
		s.modelIdx = (s.modelIdx + delta + total) % total
	case modelFocusThinking:
		total := len(s.thinking)
		if total == 0 {
			return
		}
		s.thinkingIdx = (s.thinkingIdx + delta + total) % total
	case modelFocusAddProvider, modelFocusAddModel:
		// 输入模式不下拉切换，只处理 Backspace
		if delta < 0 && len(s.customInput) > 0 {
			runes := []rune(s.customInput)
			s.customInput = string(runes[:len(runes)-1])
		}
	}
}

// handleInputChar 处理手动输入模式的字符追加。
func (s *modelSwitchState) handleInputChar(ch rune) {
	s.customInput += string(ch)
}

func (s *modelSwitchState) syncSelection(rt modelRuntime) {
	provider, model, _ := rt.CurrentModelSelection(s.role())
	if len(s.providers) > 0 {
		s.providerIdx = 0
		for i, candidate := range s.providers {
			if candidate == provider {
				s.providerIdx = i
				break
			}
		}
	}
	s.syncModels(rt, model)
	s.syncThinking(rt)
	s.message = ""
}

func (s *modelSwitchState) syncModels(rt modelRuntime, preferred string) {
	s.models = rt.ConfiguredModels(s.provider())
	s.modelIdx = 0
	if len(s.models) == 0 {
		return
	}
	preferred = strings.TrimSpace(preferred)
	for i, model := range s.models {
		if model == preferred {
			s.modelIdx = i
			return
		}
	}
}

func (s *modelSwitchState) syncThinking(rt modelRuntime) {
	s.thinking = thinkingOptionsFor(rt, s.role())
	s.thinkingIdx = thinkingIndexOf(s.thinking, rt.CurrentThinking(s.role()))
}

func (s *modelSwitchState) apply(rt modelRuntime) error {
	// 新增 provider 模式：提交 customInput 创建 provider
	if s.focus == modelFocusAddProvider {
		name := strings.TrimSpace(s.customInput)
		if name == "" {
			return fmt.Errorf("provider 名称不能为空")
		}
		if err := rt.AddProvider(name); err != nil {
			return err
		}
		s.customInput = ""
		s.customInputDone = true
		s.providers = rt.ConfiguredProviders()
		// 定位到新增的 provider
		for i, p := range s.providers {
			if p == name {
				s.providerIdx = i
				break
			}
		}
		s.focus = modelFocusProvider
		s.syncModels(rt, "")
		s.syncThinking(rt)
		s.message = fmt.Sprintf("已添加 provider %q，请编辑配置文件填入 api_key/base_url", name)
		return nil
	}

	// 新增模型模式：提交 customInput 创建模型
	if s.focus == modelFocusAddModel {
		name := strings.TrimSpace(s.customInput)
		if name == "" {
			return fmt.Errorf("模型名不能为空")
		}
		if s.provider() == "" {
			return fmt.Errorf("请先选择 provider")
		}
		if err := rt.AddModel(s.provider(), name); err != nil {
			return err
		}
		s.customInput = ""
		s.customInputDone = true
		s.models = rt.ConfiguredModels(s.provider())
		for i, m := range s.models {
			if m == name {
				s.modelIdx = i
				break
			}
		}
		s.focus = modelFocusModel
		s.message = fmt.Sprintf("已添加模型 %q", name)
		return nil
	}

	if len(s.providers) == 0 {
		return fmt.Errorf("当前没有可用 provider，按 i 输入新 provider")
	}
	if len(s.models) == 0 {
		return fmt.Errorf("provider %q 没有已配置模型，按 i 输入新模型", s.provider())
	}
	if s.provider() == "" || s.model() == "" {
		return fmt.Errorf("provider 和 model 不能为空")
	}
	wantThinking := s.thinkingKey()
	if err := rt.SwitchModel(s.role(), s.provider(), s.model()); err != nil {
		return err
	}
	s.syncThinking(rt)
	// 推理强度与模型正交：仅当较当前值有变化时应用，避免冗余持久化/事件。
	if wantThinking != strings.ToLower(strings.TrimSpace(rt.CurrentThinking(s.role()))) {
		if err := rt.SetRoleThinking(s.role(), wantThinking); err != nil {
			return err
		}
		s.syncThinking(rt)
	}
	return nil
}

func (m Model) handleModelSwitchKey(msg tea.KeyMsg) (tea.Model, tea.Cmd) {
	if m.modelSwitch == nil {
		return m, nil
	}
	state := m.modelSwitch

	// 在输入模式下，处理文本字符和特殊键
	if state.focus == modelFocusAddProvider || state.focus == modelFocusAddModel {
		switch msg.Type {
		case tea.KeyEsc:
			// 取消输入，返回上级列表
			state.customInput = ""
			if state.focus == modelFocusAddProvider {
				state.focus = modelFocusProvider
			} else {
				state.focus = modelFocusModel
			}
			return m, nil
		case tea.KeyEnter:
			if err := state.apply(m.runtime); err != nil {
				state.message = err.Error()
				return m, nil
			}
			// 如果是新增操作（apply 处理完后又切回了列表），保持在面板
			if state.customInputDone {
				state.customInputDone = false
				return m, nil
			}
			m.modelSwitch = nil
			return m, tea.Batch(m.textarea.Focus(), fetchSnapshot(m.runtime))
		case tea.KeyBackspace:
			state.cycle(-1, m.runtime)
			return m, nil
		case tea.KeyRunes:
			for _, r := range msg.Runes {
				state.handleInputChar(r)
			}
			return m, nil
		case tea.KeySpace:
			state.handleInputChar(' ')
			return m, nil
		default:
			return m, nil
		}
	}

	switch msg.Type {
	case tea.KeyEsc:
		m.modelSwitch = nil
		return m, m.textarea.Focus()
	case tea.KeyTab, tea.KeyDown:
		state.moveFocus(1)
		return m, nil
	case tea.KeyShiftTab, tea.KeyUp:
		state.moveFocus(-1)
		return m, nil
	case tea.KeyLeft:
		state.cycle(-1, m.runtime)
		return m, nil
	case tea.KeyRight:
		state.cycle(1, m.runtime)
		return m, nil
	case tea.KeyRunes:
		// 'i' 键进入新增模式（Provider 或 Model 行）
		for _, r := range msg.Runes {
			if r == 'i' {
				switch state.focus {
				case modelFocusProvider:
					state.customInput = ""
					state.focus = modelFocusAddProvider
					return m, nil
				case modelFocusModel:
					state.customInput = ""
					state.focus = modelFocusAddModel
					return m, nil
				}
			}
			// 'd' 键删除当前 provider（仅限运行时添加的）
			if r == 'd' && state.focus == modelFocusProvider {
				return m, nil // TODO: 暂不支持删除
			}
		}
		return m, nil
	case tea.KeyEnter:
		if err := state.apply(m.runtime); err != nil {
			state.message = err.Error()
			return m, nil
		}
		m.modelSwitch = nil
		return m, tea.Batch(m.textarea.Focus(), fetchSnapshot(m.runtime))
	default:
		return m, nil
	}
}

func renderModelSwitchBar(width int, state *modelSwitchState) string {
	if state == nil || width <= 0 {
		return ""
	}

	title := lipgloss.NewStyle().
		Foreground(colorMuted).
		Bold(true).
		Render("/model 切换模型")

	provLabel := state.provider()
	if provLabel == "" {
		provLabel = "未设置"
	}
	modelLabel := state.model()
	if modelLabel == "" {
		modelLabel = "未设置"
	}

	addHintStyle := lipgloss.NewStyle().Foreground(colorAccent).Italic(true)
	iHint := addHintStyle.Render(" i=新增")

	row1 := renderModelField("角色", state.roleLabel(), state.focus == modelFocusRole)
	row2 := renderModelFieldWithHint("Provider", provLabel, state.focus == modelFocusProvider, iHint)
	row3 := renderModelFieldWithHint("模型", modelLabel, state.focus == modelFocusModel, iHint)

	// 新增 provider 输入行
	if state.focus == modelFocusAddProvider {
		row2 = renderInputField("Provider", state.customInput, true)
	}
	// 新增模型输入行
	if state.focus == modelFocusAddModel {
		row3 = renderInputField("模型", state.customInput, true)
	}

	row4 := renderModelField("推理强度", state.thinkingLabel(), state.focus == modelFocusThinking)
	hint := lipgloss.NewStyle().
		Foreground(colorDim).
		Italic(true).
		Render("Tab 切字段   ←→ 切选项   i 新增   Enter 应用   Esc 取消")
	lines := []string{
		row1,
		row2,
		row3,
		row4,
		hint,
	}
	if state.message != "" {
		lines = append(lines, lipgloss.NewStyle().Foreground(colorError).Italic(true).Render(truncate(state.message, width-8)))
	}

	content := strings.Join(lines, "\n")
	boxW := lipgloss.Width(content) + 8
	maxW := width - 2
	if maxW > 68 {
		maxW = 68
	}
	if boxW > maxW {
		boxW = maxW
	}
	if boxW < 56 {
		boxW = 56
	}

	innerW := boxW - 2
	if innerW < 16 {
		innerW = 16
	}
	sepW := innerW - lipgloss.Width(title) - 3
	if sepW < 0 {
		sepW = 0
	}
	lineStyle := lipgloss.NewStyle().Foreground(colorDim)
	topBorder := lineStyle.Render("┌─ ") + title + lineStyle.Render(" "+strings.Repeat("─", sepW)+"┐")
	bottomBorder := lineStyle.Render("└" + strings.Repeat("─", innerW) + "┘")

	body := make([]string, 0, len(lines))
	for _, line := range lines {
		padding := innerW - lipgloss.Width(line)
		if padding < 0 {
			padding = 0
		}
		body = append(body, lineStyle.Render("│")+line+strings.Repeat(" ", padding)+lineStyle.Render("│"))
	}

	return strings.Join(append(append([]string{topBorder}, body...), bottomBorder), "\n")
}

func renderModelField(label, value string, focused bool) string {
	if strings.TrimSpace(value) == "" {
		value = "未设置"
	}
	labelText := lipgloss.NewStyle().
		Foreground(colorMuted).
		Width(12).
		Render(label + ":")
	style := lipgloss.NewStyle().Padding(0, 1).Foreground(bodyTextColor)
	if focused {
		style = style.Foreground(colorAccent).Bold(true).Underline(true)
	}
	return labelText + style.Render("["+value+"]")
}

func renderModelFieldWithHint(label, value string, focused bool, hint string) string {
	if strings.TrimSpace(value) == "" {
		value = "未设置"
	}
	labelText := lipgloss.NewStyle().
		Foreground(colorMuted).
		Width(12).
		Render(label + ":")
	style := lipgloss.NewStyle().Padding(0, 1).Foreground(bodyTextColor)
	if focused {
		style = style.Foreground(colorAccent).Bold(true).Underline(true)
	}
	return labelText + style.Render("["+value+"]") + " " + hint
}

func renderInputField(label, value string, focused bool) string {
	labelText := lipgloss.NewStyle().
		Foreground(colorMuted).
		Width(12).
		Render(label + ":")
	cursor := "▌"
	display := value + cursor
	if value == "" {
		display = cursor + lipgloss.NewStyle().Foreground(colorDim).Render("输入名称...")
	}
	style := lipgloss.NewStyle().Padding(0, 1).Foreground(bodyTextColor)
	if focused {
		style = style.Foreground(colorAccent).Bold(true)
	}
	return labelText + style.Render("["+display+"]")
}

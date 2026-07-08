package tui

import (
	"fmt"
	"strings"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/voocel/ainovel-cli/internal/host"
)

type slashCommandSpec struct {
	Name        string
	Aliases     []string
	Group       string
	Usage       string
	Description string
	AutoExecute bool
	Hidden      bool
	NeedsIdle   bool
	Run         func(m Model, args []string) (tea.Model, tea.Cmd)
}

type slashCommand struct {
	name string
	args []string
}

func parseSlashCommand(text string) (slashCommand, bool) {
	text = strings.TrimSpace(text)
	if !strings.HasPrefix(text, "/") {
		return slashCommand{}, false
	}
	fields := strings.Fields(strings.TrimPrefix(text, "/"))
	if len(fields) == 0 {
		return slashCommand{}, false
	}
	return slashCommand{name: strings.ToLower(fields[0]), args: fields[1:]}, true
}

func (s slashCommandSpec) matches(name string) bool {
	if s.Name == name {
		return true
	}
	for _, alias := range s.Aliases {
		if strings.EqualFold(alias, name) {
			return true
		}
	}
	return false
}

func commandRegistryInstance() commandRegistry {
	return newCommandRegistry([]slashCommandSpec{
		{
			Name:        "help",
			Group:       "system",
			Usage:       "/help",
			Description: "查看命令列表",
			AutoExecute: true,
			Run: func(m Model, _ []string) (tea.Model, tea.Cmd) {
				m.help = newHelpState(m.width, m.height)
				m.textarea.Blur()
				return m, nil
			},
		},
		{
			Name:        "model",
			Aliases:     []string{"m"},
			Group:       "system",
			Usage:       "/model [role]",
			Description: "切换默认或角色模型（按 i 新增 provider/模型）",
			AutoExecute: true,
			Run: func(m Model, args []string) (tea.Model, tea.Cmd) {
				roleHint := ""
				if len(args) > 0 {
					roleHint = args[0]
					if normalizeRoleKey(roleHint) == "" {
						m.applyEvent(host.Event{
							Time: time.Now(), Category: "ERROR", Summary: "未知角色：" + roleHint, Level: "error",
						})
						m.refreshEventViewport()
						return m, nil
					}
				}
				m.modelSwitch = newModelSwitchState(m.runtime, roleHint)
				m.textarea.Blur()
				return m, nil
			},
		},
		{
			Name:        "provider",
			Group:       "system",
			Usage:       "/provider <add|fetch-models> ...",
			Description: "管理 LLM provider：add 新增 / fetch-models 自动拉取模型列表",
			AutoExecute: true,
			Run: func(m Model, args []string) (tea.Model, tea.Cmd) {
				if len(args) == 0 {
					m.applyEvent(host.Event{
						Time: time.Now(), Category: "SYSTEM",
						Summary: "用法：/provider add <name> | /provider fetch-models [name|all]",
						Level:   "info",
					})
					m.refreshEventViewport()
					return m, nil
				}
				switch args[0] {
				case "add":
					return runProviderAdd(m, args[1:])
				case "fetch-models", "fetch", "fm":
					return runProviderFetchModels(m, args[1:])
				default:
					m.applyEvent(host.Event{
						Time: time.Now(), Category: "SYSTEM",
						Summary: "未知子命令：" + args[0] + "，可用：add / fetch-models",
						Level:   "info",
					})
					m.refreshEventViewport()
					return m, nil
				}
			},
		},
		{
			Name:        "diag",
			Group:       "analysis",
			Usage:       "/diag",
			Description: "诊断小说创作健康度",
			AutoExecute: true,
			Run: func(m Model, _ []string) (tea.Model, tea.Cmd) {
				m.reportSeq++
				m.report = newReportState(m.width, m.height, m.reportSeq, time.Now())
				m.textarea.Blur()
				return m, loadReport(m.runtime.Dir(), m.reportSeq)
			},
		},
		{
			Name:        "import",
			Group:       "writing",
			Usage:       "/import <path> [from=N]",
			Description: "反推外部小说续写",
			NeedsIdle:   true,
			Run: func(m Model, args []string) (tea.Model, tea.Cmd) {
				m.importSeq++
				state, listenCmd, err := startImport(m.runtime, m.importSeq, args, m.width, m.height)
				if err != nil {
					m.applyEvent(host.Event{
						Time: time.Now(), Category: "ERROR", Summary: "导入启动失败：" + err.Error(), Level: "error",
					})
					m.refreshEventViewport()
					return m, nil
				}
				m.importer = state
				m.textarea.Blur()
				return m, listenCmd
			},
		},
		{
			Name:        "cocreate",
			Aliases:     []string{"plan"},
			Group:       "writing",
			Usage:       "/cocreate",
			Description: "暂停创作，共创规划后续阶段走向",
			AutoExecute: true,
			Run: func(m Model, _ []string) (tea.Model, tea.Cmd) {
				if m.mode != modeRunning {
					m.applyEvent(host.Event{
						Time: time.Now(), Category: "ERROR", Summary: "阶段共创仅在创作中可用", Level: "error",
					})
					m.refreshEventViewport()
					return m, nil
				}
				if !m.runtime.PauseForCoCreate() {
					m.applyEvent(host.Event{
						Time: time.Now(), Category: "ERROR", Summary: "无法进入阶段共创：全书已完成或已在共创中", Level: "error",
					})
					m.refreshEventViewport()
					return m, nil
				}
				m.cocreate = newStageCoCreateState()
				m.resizeTextarea()
				m.textarea.Blur()
				return m, m.sendCoCreate()
			},
		},
		{
			Name:        "simulate",
			Group:       "writing",
			Usage:       "/simulate",
			Description: "读取 ./simulate 生成或增量更新仿写画像",
			NeedsIdle:   true,
			Run: func(m Model, args []string) (tea.Model, tea.Cmd) {
				m.simSeq++
				state, listenCmd, err := startSimulate(m.runtime, m.simSeq, args, m.width, m.height)
				if err != nil {
					m.applyEvent(host.Event{
						Time: time.Now(), Category: "ERROR", Summary: "仿写画像启动失败：" + err.Error(), Level: "error",
					})
					m.refreshEventViewport()
					return m, nil
				}
				m.simulator = state
				m.textarea.Blur()
				return m, listenCmd
			},
		},
		{
			Name:        "importsim",
			Group:       "writing",
			Usage:       "/importsim <profile.json>",
			Description: "导入已有仿写画像并按语料指纹合并",
			NeedsIdle:   true,
			Run: func(m Model, args []string) (tea.Model, tea.Cmd) {
				m.simSeq++
				state, listenCmd, err := startImportSimulation(m.runtime, m.simSeq, args, m.width, m.height)
				if err != nil {
					m.applyEvent(host.Event{
						Time: time.Now(), Category: "ERROR", Summary: "导入仿写画像失败：" + err.Error(), Level: "error",
					})
					m.refreshEventViewport()
					return m, nil
				}
				m.simulator = state
				m.textarea.Blur()
				return m, listenCmd
			},
		},
		{
			Name:        "export",
			Group:       "writing",
			Usage:       "/export [path] [from=N] [to=M] [--overwrite]",
			Description: "导出已完成章节为 TXT/EPUB",
			AutoExecute: true,
			Run: func(m Model, args []string) (tea.Model, tea.Cmd) {
				cmd, err := startExport(m.runtime, args)
				if err != nil {
					m.applyEvent(host.Event{
						Time: time.Now(), Category: "ERROR", Summary: "导出启动失败：" + err.Error(), Level: "error",
					})
					m.refreshEventViewport()
					return m, nil
				}
				m.applyEvent(host.Event{
					Time: time.Now(), Category: "SYSTEM", Summary: "正在导出...", Level: "info",
				})
				m.refreshEventViewport()
				return m, cmd
			},
		},
	})
}

func commandSpecs() []slashCommandSpec {
	return commandRegistryInstance().Visible()
}

func (m Model) handleSlashCommand(cmd slashCommand) (tea.Model, tea.Cmd) {
	spec, ok := commandRegistryInstance().Find(cmd.name)
	if !ok {
		m.applyEvent(host.Event{
			Time: time.Now(), Category: "ERROR", Summary: "未知命令：/" + cmd.name, Level: "error",
		})
		m.refreshEventViewport()
		return m, nil
	}
	if spec.NeedsIdle && m.snapshot.IsRunning {
		m.applyEvent(host.Event{
			Time: time.Now(), Category: "ERROR", Summary: "命令仅可在空闲状态执行：/" + spec.Name, Level: "error",
		})
		m.refreshEventViewport()
		return m, nil
	}
	return spec.Run(m, cmd.args)
}

func runProviderAdd(m Model, args []string) (tea.Model, tea.Cmd) {
	if len(args) < 1 {
		m.applyEvent(host.Event{
			Time: time.Now(), Category: "SYSTEM", Summary: "用法：/provider add <name>", Level: "info",
		})
		m.refreshEventViewport()
		return m, nil
	}
	name := args[0]
	if err := m.runtime.AddProvider(name); err != nil {
		m.applyEvent(host.Event{
			Time: time.Now(), Category: "ERROR", Summary: "添加 provider 失败：" + err.Error(), Level: "error",
		})
		m.refreshEventViewport()
		return m, nil
	}
	m.applyEvent(host.Event{
		Time:     time.Now(),
		Category: "SYSTEM",
		Summary:  fmt.Sprintf("已添加 provider %q，请确认 api_key/base_url 后执行 /provider fetch-models %s", name, name),
		Level:    "info",
	})
	m.refreshEventViewport()
	return m, nil
}

func runProviderFetchModels(m Model, args []string) (tea.Model, tea.Cmd) {
	name := "all"
	if len(args) > 0 {
		name = args[0]
	}
	results, err := m.runtime.FetchProviderModels(name)
	if err != nil {
		// 部分成功：先展示成功结果，再提示错误
		if len(results) > 0 {
			for _, r := range results {
				m.applyEvent(host.Event{
					Time: time.Now(), Category: "SYSTEM", Summary: r, Level: "info",
				})
			}
		}
		m.applyEvent(host.Event{
			Time: time.Now(), Category: "ERROR", Summary: "拉取模型失败：" + err.Error(), Level: "error",
		})
		m.refreshEventViewport()
		return m, nil
	}
	for _, r := range results {
		m.applyEvent(host.Event{
			Time: time.Now(), Category: "SYSTEM", Summary: r, Level: "info",
		})
	}
	m.refreshEventViewport()
	return m, nil
}

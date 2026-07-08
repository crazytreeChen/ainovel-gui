package diag

// Severity 表示发现的严重程度。
type Severity string

const (
	SevCritical Severity = "critical" // 阻塞进度或数据损坏
	SevWarning  Severity = "warning"  // 可能降低质量或浪费 token
	SevInfo     Severity = "info"     // 可优化项
)

// Category 将发现按维度分组。
type Category string

const (
	CatFlow     Category = "flow"     // 流程卡顿、状态异常、恢复问题
	CatQuality  Category = "quality"  // 评审评分、合同履约、一致性
	CatPlanning Category = "planning" // 大纲缺口、伏笔漂移、指南针过时
	CatContext  Category = "context"  // 角色/时间线/关系异常
)

// Confidence 表示规则判定的置信度。
type Confidence string

const (
	ConfHigh   Confidence = "high"   // 确定性强，可信赖
	ConfMedium Confidence = "medium" // 启发式判断，可能有误判
	ConfLow    Confidence = "low"    // 粗略信号，仅供参考
)

// AutoLevel 表示 Finding 是否可以转为自动化动作。
type AutoLevel string

const (
	AutoNone    AutoLevel = "none"    // 仅报告，不自动
	AutoSuggest AutoLevel = "suggest" // 建议动作但需人工确认
	AutoSafe    AutoLevel = "safe"    // 可安全自动执行
)

// Finding 是一条可执行的诊断结果。
type Finding struct {
	Rule       string     // 规则名，如 "StaleForeshadow"
	Category   Category   // 分类
	Severity   Severity   // 严重程度
	Confidence Confidence // 判定置信度
	AutoLevel  AutoLevel  // 自动化级别
	Target     string     // 建议作用面，如 "runtime.flow"
	Title      string     // 一行摘要
	Evidence   string     // 具体数据证据
	Suggestion string     // 改进建议（指向 prompt/flow/config）
}

// RuleFunc 是诊断规则的统一签名。
type RuleFunc func(snap *Snapshot) []Finding

// ActionKind 表示诊断动作的类型。
type ActionKind string

const (
	ActionEmitNotice      ActionKind = "emit_notice"       // 发系统提示
	ActionEnqueueFollowUp ActionKind = "enqueue_follow_up" // 注入 coordinator follow-up
)

// Action 是 Planner 根据高置信 Finding 生成的可执行动作。
type Action struct {
	SourceRule  string     // 来源规则名
	Kind        ActionKind // 动作类型
	Severity    Severity   // 继承自 Finding
	Summary     string     // 简短描述
	Message     string     // 传递给控制流的消息
	Fingerprint string     // 来源 Finding 的稳定指纹，用于运行时去重
}

// Stats 是与发现并列展示的概览指标。
type Stats struct {
	CompletedChapters int
	TotalChapters     int
	TotalWords        int
	AvgWordsPerCh     int
	Phase             string
	Flow              string
	PlanningTier      string
	ReviewCount       int
	RewriteCount      int
	AvgReviewScore    float64
	ForeshadowOpen    int
	ForeshadowStale   int
}

// Metrics 是结构化的诊断指标，便于 GUI 展示和自动化处理。
type Metrics struct {
	// 进度指标
	ProgressPercent float64 `json:"progress_percent"` // 完成百分比
	DaysSinceStart  int     `json:"days_since_start"`  // 创作天数
	AvgChaptersPerDay float64 `json:"avg_chapters_per_day"` // 日均章节
	
	// 质量指标
	CriticalIssues int     `json:"critical_issues"` // 严重问题数
	ErrorIssues    int     `json:"error_issues"`    // 错误问题数
	WarningIssues  int     `json:"warning_issues"`  // 警告问题数
	QualityScore   float64 `json:"quality_score"`   // 综合质量分（0-100）
	
	// 效率指标
	TotalAPICalls  int     `json:"total_api_calls"`  // API 调用总数
	TotalCostUSD   float64 `json:"total_cost_usd"`   // 总花费（美元）
	AvgCostPerChapter float64 `json:"avg_cost_per_chapter"` // 章均花费
	
	// 一致性指标
	TitleMismatches    int `json:"title_mismatches"`    // 标题不一致数
	CharacterIssues    int `json:"character_issues"`    // 角色一致性问题数
	TimelineIssues     int `json:"timeline_issues"`     // 时间线问题数
}

// Report 是一次诊断运行的完整输出。
type Report struct {
	Stats    Stats
	Metrics  Metrics
	Findings []Finding
	Actions  []Action
}

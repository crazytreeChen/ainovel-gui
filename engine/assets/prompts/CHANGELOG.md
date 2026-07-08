# Prompt 变更记录

本文件记录 ainovel-cli prompt 文件的变更历史。

---

## v1.2.0 (2026-07-08)

### writer.md
- **标题一致性**：优先沿用大纲标题，偏离需说明理由
- **字数处理**：剧情密度先于字数裁剪，保留必要铺垫
- **另开章节**：增加"另开章节"兜底原则

### editor.md
- **标题一致性**：consistency 维度增加标题与大纲一致性检查
- **铺垫充分性**：pacing 维度增加铺垫充分性检查
- **转场自然度**：pacing 维度增加转场自然度检查
- **突兀转折**：continuity 维度明确突兀转折检查

---

## v1.1.0 (2026-07-06)

### writer.md
- 去 AI 味规则增强
- 句式多样性要求
- 前情不复述约束

### editor.md
- 七维评审标准完善
- 用户规则集成
- severity 分级标准

---

## v1.0.0 (2026-07-01)

初始版本。

### writer.md
- 创作执行协议
- 章节契约系统
- 字数控制

### editor.md
- 七维结构化审阅
- 评分卡门禁
- 弧级/卷级评审模式

---

## 版本说明

- **主版本号**：prompt 结构重大变更（如新增/删除维度）
- **次版本号**：新增检查规则或显著行为变更
- **修订号**：文案调整、规则微调

## 文件说明

| 文件 | 用途 | 维护者 |
|------|------|--------|
| writer.md | Writer Agent 创作指令 | Editor |
| editor.md | Editor Agent 审阅指令 | Editor |
| coordinator.md | Coordinator 协调指令 | Editor |
| architect-long.md | 长篇规划师指令 | Editor |
| architect-short.md | 短篇规划师指令 | Editor |

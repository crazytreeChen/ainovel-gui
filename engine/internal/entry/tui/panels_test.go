package tui

import (
	"strings"
	"testing"

	"github.com/voocel/ainovel-cli/internal/host"
)

func TestRenderTopBarShowsVersion(t *testing.T) {
	out := renderTopBar(host.UISnapshot{
		Provider:  "openrouter",
		ModelName: "test-model",
		NovelName: "测试小说",
	}, 120, "", "v1.2.3")
	if !strings.Contains(out, "ainovel-cli v1.2.3") {
		t.Fatalf("top bar missing version: %q", out)
	}
}

func TestBuildRightInfoShowsThinkingLevelAfterModel(t *testing.T) {
	out := buildRightInfo(host.UISnapshot{
		Provider:           "openrouter",
		ModelName:          "test-model",
		ModelContextWindow: 200000,
		ThinkingLevel:      "medium",
	}, "/tmp/output")
	if !strings.Contains(out, "test-model(200K,med)") {
		t.Fatalf("right info missing compact thinking level: %q", out)
	}
}

func TestBuildRightInfoShowsAutoThinkingWhenUnset(t *testing.T) {
	out := buildRightInfo(host.UISnapshot{
		ModelName:          "test-model",
		ModelContextWindow: 128000,
	}, "")
	if !strings.Contains(out, "test-model(128K,auto)") {
		t.Fatalf("right info missing auto thinking level: %q", out)
	}
}

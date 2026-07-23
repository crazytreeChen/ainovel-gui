package utils

import (
	"bytes"
	"strings"
	"unicode/utf8"

	"golang.org/x/text/encoding/simplifiedchinese"
)

// DecodeText 把用户提供的文本文件字节解码为 UTF-8：非法 UTF-8 时按 GB18030
//（GBK 超集）转码——网络流传的中文小说 txt 大量为 GBK 编码，直接当 UTF-8 读
// 全是乱码。非 GBK 的字节序列会被解码器替换为 U+FFFD（本就是乱码，由调用方的
// 零命中兜底报错引导用户）。最后剥离 UTF-8 BOM（否则行首匹配会带上它）。
func DecodeText(data []byte) string {
	if !utf8.Valid(data) {
		if decoded, err := simplifiedchinese.GB18030.NewDecoder().Bytes(data); err == nil {
			data = decoded
		}
	}
	return strings.TrimPrefix(string(data), "\uFEFF")
}

// SanitizeUTF8 将字节切片中的非法 UTF-8 序列替换为 U+FFFD，保证返回值一定
// 通过 utf8.Valid 校验。用于把磁盘文件/工具结果喂给 LLM 前做兜底清洗，避免
// provider SDK 因 "text block must be valid UTF-8" 拒绝请求，进而导致上下文
// 压缩（compaction / FullSummary）失败、Coordinator 终止。合法 UTF-8 原样返回。
func SanitizeUTF8(b []byte) []byte {
	if utf8.Valid(b) {
		return b
	}
	out := bytes.NewBuffer(make([]byte, 0, len(b)))
	for len(b) > 0 {
		r, size := utf8.DecodeRune(b)
		if r == utf8.RuneError {
			out.WriteRune('\uFFFD')
		} else {
			out.WriteRune(r)
		}
		b = b[size:]
	}
	return out.Bytes()
}

// SanitizeUTF8String 对字符串做同样的非法 UTF-8 清洗。
func SanitizeUTF8String(s string) string {
	if utf8.ValidString(s) {
		return s
	}
	return string(SanitizeUTF8([]byte(s)))
}

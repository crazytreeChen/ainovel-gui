/**
 * 图标生成脚本
 * 
 * 生成应用图标：
 * - macOS: icon.icns (使用 iconutil)
 * - Windows: icon.ico (使用 sharp 或 png2ico)
 * - Linux: icons/ 目录下的多尺寸 PNG
 * 
 * 前置条件：
 * - macOS: Xcode Command Line Tools（iconutil 需要）
 * - Windows: 建议安装 sharp（npm i -D sharp）
 * 
 * 用法: node scripts/generate-icons.cjs
 */

const { execSync } = require('child_process')
const { existsSync, mkdirSync, copyFileSync, writeFileSync, readFileSync } = require('fs')
const { join, dirname } = require('path')
const os = require('os')

const ROOT = join(__dirname, '..')
const BUILD = join(ROOT, 'build')
const SVG_PATH = join(BUILD, 'icon.svg')

// PNG sizes 需要生成的尺寸
const PNG_SIZES = [16, 32, 64, 128, 256, 512]
const MAC_ICONSET = join(BUILD, 'icon.iconset')

async function main() {
  console.log('🔨 Generating application icons...')

  if (!existsSync(SVG_PATH)) {
    console.log('⚠ SVG icon not found, creating placeholder...')
    createPlaceholderSVG()
  }

  // 尝试使用 sharp 生成 PNG
  let hasSharp = false
  try {
    require.resolve('sharp')
    hasSharp = true
  } catch {
    console.log('⚠ sharp not installed, will create simple placeholder icons')
  }

  if (hasSharp) {
    await generateWithSharp()
  } else {
    generatePlaceholder()
  }

  // macOS: .icns
  if (os.platform() === 'darwin') {
    try {
      generateIcns()
      console.log('✅ macOS icon.icns generated')
    } catch (e) {
      console.log('⚠ Failed to generate .icns:', e.message)
      console.log('  Install Xcode Command Line Tools: xcode-select --install')
    }
  }

  // Windows: .ico
  generateIcoPlaceholder()

  // Linux: multi-size PNGs
  generateLinuxIcons()

  console.log('✅ Icon generation complete')
  console.log('  For production builds, install sharp: npm i -D sharp')
}

async function generateWithSharp() {
  const sharp = require('sharp')
  const svgBuffer = readFileSync(SVG_PATH)

  // 生成各尺寸 PNG
  const iconsDir = join(BUILD, 'icons')
  if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true })

  for (const size of PNG_SIZES) {
    const outPath = join(iconsDir, `${size}x${size}.png`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`  ✓ ${size}x${size} PNG`)
  }

  // 生成 256x256 作为默认
  await sharp(svgBuffer).resize(256, 256).png().toFile(join(BUILD, 'icon.png'))
  console.log('  ✓ icon.png (256x256)')

  // Windows: 将多个尺寸合成 ico
  if (os.platform() === 'win32' || process.argv.includes('--ico')) {
    try {
      const sizes = [16, 32, 48, 64, 128, 256]
      const sharpBuffers = await Promise.all(
        sizes.map((s) => sharp(svgBuffer).resize(s, s).png().toBuffer())
      )
      // 用 png-to-ico 或直接复制最大尺寸
      writeFileSync(join(BUILD, 'icon.ico'), sharpBuffers[sharpBuffers.length - 1])
      console.log('  ✓ icon.ico (placeholder - use proper tool for multi-size)')
    } catch (e) {
      console.log('  ⚠ icon.ico generation skipped')
    }
  }
}

function generatePlaceholder() {
  // 没有 sharp 时创建占位
  const iconsDir = join(BUILD, 'icons')
  if (!existsSync(iconsDir)) mkdirSync(iconsDir, { recursive: true })

  // 复制 SVG 作为占位
  for (const size of PNG_SIZES) {
    const outPath = join(iconsDir, `${size}x${size}.png`)
    if (!existsSync(outPath)) {
      // 创建一个最简单的 1x1 PNG 占位（无法显示，仅供构建不报错）
      const minimalPNG = Buffer.from([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG header
        0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // 1x1
        0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8-bit grayscale
        0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, // IDAT
        0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, // compressed data
        0x00, 0x00, 0x03, 0x00, 0x01, 0x12, 0xE4, 0x0A, // IEND
        0x9D, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 
        0x44, 0xAE, 0x42, 0x60, 0x82,
      ])
      writeFileSync(outPath, minimalPNG)
    }
  }

  if (!existsSync(join(BUILD, 'icon.png'))) {
    copyFileSync(join(iconsDir, '256x256.png'), join(BUILD, 'icon.png'))
  }

  console.log('⚠ Placeholder icons created (install sharp for proper icons)')
}

function generateIcns() {
  // 创建 .iconset 目录
  if (!existsSync(MAC_ICONSET)) {
    mkdirSync(MAC_ICONSET, { recursive: true })
  }

  const iconsDir = join(BUILD, 'icons')
  const pairs = [
    [16, 'icon_16x16.png'],
    [32, 'icon_16x16@2x.png'],
    [32, 'icon_32x32.png'],
    [64, 'icon_32x32@2x.png'],
    [128, 'icon_128x128.png'],
    [256, 'icon_128x128@2x.png'],
    [256, 'icon_256x256.png'],
    [512, 'icon_256x256@2x.png'],
    [512, 'icon_512x512.png'],
    [1024, 'icon_512x512@2x.png'],
  ]

  for (const [size, name] of pairs) {
    const src = join(iconsDir, `${size}x${size}.png`)
    const dest = join(MAC_ICONSET, name)
    if (existsSync(src)) {
      copyFileSync(src, dest)
    }
  }

  // 使用 iconutil 生成 .icns
  execSync(`iconutil -c icns "${MAC_ICONSET}" -o "${join(BUILD, 'icon.icns')}"`, {
    stdio: 'pipe',
  })
}

function generateIcoPlaceholder() {
  const icoPath = join(BUILD, 'icon.ico')
  if (!existsSync(icoPath)) {
    // 使用 256x256 PNG 作为基础
    const png256 = join(BUILD, 'icons', '256x256.png')
    if (existsSync(png256)) {
      copyFileSync(png256, icoPath)
    } else {
      // 创建最小占位
      writeFileSync(icoPath, Buffer.alloc(0))
    }
  }
}

function generateLinuxIcons() {
  // Linux icons 已由 generateWithSharp/generatePlaceholder 生成
  // 只需确保目录存在
  const iconsDir = join(BUILD, 'icons')
  if (!existsSync(iconsDir)) {
    mkdirSync(iconsDir, { recursive: true })
  }
}

function createPlaceholderSVG() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="64" fill="url(#bg)"/>
  <g transform="translate(256,256)" fill="none" stroke="#e5b449" stroke-width="12">
    <line x1="0" y1="-120" x2="0" y2="120" stroke="#5fb8a3" stroke-width="16"/>
    <path d="M-10,-120 Q-80,-130 -140,-110 L-140,130 Q-80,110 -10,120 Z"/>
    <path d="M10,-120 Q80,-130 140,-110 L140,130 Q80,110 10,120 Z"/>
  </g>
  <text x="256" y="310" text-anchor="middle" font-family="Georgia, serif" font-size="80" font-weight="bold" fill="#e5b449" opacity="0.3">AI</text>
  <circle cx="180" cy="160" r="6" fill="#7ec488" opacity="0.6"/>
  <circle cx="332" cy="180" r="4" fill="#e09b5a" opacity="0.6"/>
  <circle cx="200" cy="380" r="5" fill="#7ec5d8" opacity="0.6"/>
  <circle cx="340" cy="350" r="3" fill="#a890d8" opacity="0.6"/>
</svg>`
  writeFileSync(SVG_PATH, svg)
  console.log('  ✓ SVG icon created')
}

main().catch(console.error)

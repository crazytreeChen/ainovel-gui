export {}

/**
 * 系统 IPC（模型/配置/更新/诊断/目录/封面）
 */
const { state, getDB, getAinovelBinary, GUI_DATA_DIR, home } = require('../context')
const { validatePath } = require('../path-validator')
const { createLogger } = require('../logger')
const { join, dirname, resolve, extname, sep } = require('path')
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync, cpSync, rmSync, unlinkSync, statSync } = require('fs')
const { execFileSync, spawn } = require('child_process')
import { ExecFileSyncOptions } from 'child_process'
const os = require('os')

const log = createLogger('ipc:system')

const CONFIG_PATH = join(home, '.ainovel', 'config.json')
const coverExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp']

function runCli(binary: string, args: string[], opts: ExecFileSyncOptions = {}) {
  return new Promise<string>((resolve, reject) => {
    const { cwd, timeout } = opts
    const child = spawn(binary, args, { cwd, shell: false, stdio: ['ignore', 'pipe', 'pipe'] })
    const outChunks: Buffer[] = []
    const errChunks: Buffer[] = []
    let killedByTimeout = false
    const timer: ReturnType<typeof setTimeout> | null = timeout ? setTimeout(() => { killedByTimeout = true; child.kill('SIGTERM') }, timeout) : null
    child.stdout.on('data', (d: Buffer) => outChunks.push(d))
    child.stderr.on('data', (d: Buffer) => errChunks.push(d))
    child.on('error', (err: Error) => { if (timer) clearTimeout(timer); reject(err) })
    child.on('close', (code: number | null) => {
      if (timer) clearTimeout(timer)
      const stdout = Buffer.concat(outChunks).toString('utf8')
      const stderr = Buffer.concat(errChunks).toString('utf8')
      const e = (killedByTimeout
        ? new Error(`CLI 超时 (${timeout}ms)`)
        : new Error(`CLI exit ${code}`)) as Error & { stdout: string; stderr: string }
      e.stdout = stdout
      e.stderr = stderr
      if (killedByTimeout || code !== 0) return reject(e)
      resolve(stdout)
    })
  })
}

// download-update URL 白名单：仅允许 GitHub 官方 releases 路径，防止 SSRF
const ALLOWED_DOWNLOAD_HOST = 'github.com'
const ALLOWED_DOWNLOAD_PATH_PREFIX = '/crazytreeChen/ainovel-gui/releases/download/'

function validateDownloadUrl(url: string) {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' &&
           parsed.hostname === ALLOWED_DOWNLOAD_HOST &&
           parsed.pathname.startsWith(ALLOWED_DOWNLOAD_PATH_PREFIX)
  } catch { return false }
}

const ALLOWED_INSTALL_EXTS = ['.dmg', '.exe', '.appimage', '.deb']
function validateInstallPath(filePath: string) {
  if (typeof filePath !== 'string' || !filePath) return false
  const downloadsDir = require('electron').app.getPath('downloads')
  const resolved = resolve(filePath)
  const downloadsPrefix = downloadsDir.endsWith(sep) ? downloadsDir : downloadsDir + sep
  if (!resolved.startsWith(downloadsPrefix)) return false
  const ext = extname(resolved).toLowerCase()
  if (!ALLOWED_INSTALL_EXTS.includes(ext)) return false
  if (!existsSync(resolved)) return false
  return true
}

function register(ipcMain: Electron.IpcMain) {
  // ── 目录管理 ──
  ipcMain.handle('select-directory', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({ properties: ['openDirectory'], title: '选择小说工作目录', message: '选择存放 output/ 的父目录（即运行 ainovel-cli 的工作目录）' })
    if (result.canceled || result.filePaths.length === 0) return null
    state.outputDir = result.filePaths[0]
    return state.outputDir
  })

  ipcMain.handle('set-directory', async (_e: Electron.IpcMainInvokeEvent, dir: string) => {
    const safeDir = validatePath(dir)
    state.outputDir = safeDir
    if (!existsSync(safeDir)) mkdirSync(safeDir, { recursive: true })
    return true
  })

  ipcMain.handle('get-directory', async () => state.outputDir)
  ipcMain.handle('open-directory', async (_e: Electron.IpcMainInvokeEvent, dir: string) => { require('electron').shell.openPath(validatePath(dir)) })

  // ── CLI 二进制检查 ──
  ipcMain.handle('check-binary', async () => {
    try {
      const binary = getAinovelBinary()
      if (!existsSync(binary)) return { available: false, version: '', path: binary }
      const version = execFileSync(binary, ['--version'], { encoding: 'utf8', shell: false }).trim()
      return { available: true, version, path: binary }
    } catch (e: any) { log.warn('check-binary', e?.message || e); return { available: false, version: '', path: '' } }
  })

  // ── 诊断 ──
  ipcMain.handle('run-diag', async () => {
    const binary = getAinovelBinary()
    const cwd = state.outputDir || require('electron').app.getPath('documents')
    try { return await runCli(binary, ['--headless'], { cwd, timeout: 60000 }) }
    catch (e: any) { return e.stdout || e.stderr || e.message || '诊断执行失败' }
  })

  ipcMain.handle('read-diag-report', async () => {
    if (!state.outputDir) return ''
    const f = join(state.outputDir, 'output', 'meta', 'diag-export.md')
    if (!existsSync(f)) return ''
    return readFileSync(f, 'utf8')
  })

  ipcMain.handle('run-simulate', async (_e: Electron.IpcMainInvokeEvent, bookId: string) => {
    const binary = getAinovelBinary()
    let cwd = state.outputDir || require('electron').app.getPath('documents')
    if (bookId) { try { const book = getDB().getBook(bookId); if (book?.workspace_dir) cwd = book.workspace_dir } catch (e: any) { log.error('run-simulate:getBook', e) } }
    try { return await runCli(binary, ['--headless', '--prompt', '/simulate'], { cwd, timeout: 120000 }) }
    catch (e: any) { return e.stdout || e.stderr || e.message || '仿写分析执行失败' }
  })

  ipcMain.handle('run-export', async (_e: Electron.IpcMainInvokeEvent, bookId: string, args: string) => {
    try {
      // 解析 args：/format txt [/metadata] [/chapters range]
      const parts = (args || '').split(/\s+/).filter(Boolean)
      const fmtIdx = parts.indexOf('/format')
      const fmt = fmtIdx >= 0 && fmtIdx + 1 < parts.length ? parts[fmtIdx + 1] : 'txt'
      const hasMeta = parts.includes('/metadata')
      const chIdx = parts.indexOf('/chapters')
      const chRange = chIdx >= 0 && chIdx + 1 < parts.length ? parts[chIdx + 1] : 'all'
      if (!['txt', 'epub', 'markdown', 'full'].includes(fmt)) return `导出失败: 不支持的格式 ${fmt}`

      const db = getDB()
      if (!db) return '导出失败: 数据库未初始化'

      const book = db.getBook(bookId)
      if (!book) return '导出失败: 未找到书籍'

      const bookDir = join(GUI_DATA_DIR, 'books', bookId)
      if (!existsSync(bookDir)) mkdirSync(bookDir, { recursive: true })

      // 读取章节列表和内容
      const chapters = (db.listChapters(bookId) || []) as any[]
      const completedChapters = chapters.filter(c => c.status === 'completed' || c.status === 'draft')
      if (completedChapters.length === 0) {
        // 尝试从 JSON 文件中读取章节
        let chDir = join(bookDir, 'chapters')
        if (!existsSync(chDir)) chDir = join(bookDir, 'output', 'novel', 'chapters')
        if (existsSync(chDir)) {
          const files = readdirSync(chDir).filter((f: string) => f.endsWith('.md')).sort()
          for (const f of files) {
            const num = parseInt(f.replace('.md', ''), 10)
            if (!isNaN(num)) {
              const content = readFileSync(join(chDir, f), 'utf8')
              const title = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`
              completedChapters.push({ num, title, content, word_count: content.length, status: 'completed' })
            }
          }
        }
      }
      if (completedChapters.length === 0) return '导出失败: 没有已完成的章节'

      // 填充每章的 content（listChapters 不返回 content）
      for (const ch of completedChapters) {
        if (!ch.content) {
          try {
            const full = db.getChapter(bookId, ch.num)
            ch.content = full?.content || ''
          } catch (e: any) { ch.content = '' }
        }
        // 尝试从 JSON 文件补充
        if (!ch.content) {
          let chFile = join(bookDir, 'chapters', `${String(ch.num).padStart(2, '0')}.md`)
          if (!existsSync(chFile)) chFile = join(bookDir, 'output', 'novel', 'chapters', `${String(ch.num).padStart(2, '0')}.md`)
          if (existsSync(chFile)) ch.content = readFileSync(chFile, 'utf8')
        }
        ch.title = ch.title || `第${ch.num}章`
      }

      // 处理章节范围过滤
      let exportChapters = completedChapters
      if (chRange !== 'all') {
        const [fromStr, toStr] = chRange.split('-')
        const fromN = parseInt(fromStr, 10)
        const toN = parseInt(toStr, 10)
        if (!isNaN(fromN)) exportChapters = completedChapters.filter(c => c.num >= fromN && c.num <= (isNaN(toN) ? fromN : toN))
      }

      const bookName = book.name || '未命名'

      // ── 弹出保存对话框让用户选择位置 ──
      const { dialog } = require('electron')
      if (fmt === 'full') {
        // 完整项目导出到目录
        const dirResult = await dialog.showOpenDialog({
          title: '选择导出目录',
          properties: ['openDirectory', 'createDirectory'],
        })
        if (dirResult.canceled || dirResult.filePaths.length === 0) return '导出已取消'
        const outDir = join(dirResult.filePaths[0], `${bookName}_完整项目`)
        if (existsSync(outDir)) {
          for (const f of readdirSync(outDir)) rmSync(join(outDir, f), { recursive: true, force: true })
        } else mkdirSync(outDir, { recursive: true })
        // 拷贝 bookDir 下所有文件
        if (existsSync(bookDir)) {
          for (const f of readdirSync(bookDir)) {
            const src = join(bookDir, f)
            const dst = join(outDir, f)
            try {
              const st = statSync(src)
              if (st.isDirectory()) cpSync(src, dst, { recursive: true })
              else copyFileSync(src, dst)
            } catch (e: any) { log.warn('export-full:copy', e?.message || e) }
          }
        }
        // 写章节到 chapters/ 子目录
        const chOutDir = join(outDir, 'chapters')
        if (!existsSync(chOutDir)) mkdirSync(chOutDir, { recursive: true })
        for (const ch of exportChapters) {
          writeFileSync(join(chOutDir, `${String(ch.num).padStart(2, '0')}.md`), ch.content || '', 'utf8')
        }
        writeFileSync(join(outDir, 'book.json'), JSON.stringify({ id: bookId, name: bookName, premise: book.premise || '', style: book.style || 'default' }, null, 2), 'utf8')
        return `导出成功: ${outDir}`
      }

      const extMap: Record<string, string> = { txt: '.txt', markdown: '.md', epub: '.epub' }
      const ext = extMap[fmt] || '.txt'
      const filterName: Record<string, string> = { txt: 'TXT 文本', markdown: 'Markdown', epub: 'EPUB 电子书' }
      const saveResult = await dialog.showSaveDialog({
        title: '导出小说',
        defaultPath: `${bookName}${ext}`,
        filters: [{ name: filterName[fmt] || '文件', extensions: [fmt === 'markdown' ? 'md' : fmt] }],
      })
      if (saveResult.canceled || !saveResult.filePath) return '导出已取消'
      const outPath = saveResult.filePath

      // ── TXT / Markdown ──
      if (fmt === 'txt' || fmt === 'markdown') {
        const lines: string[] = []
        if (fmt === 'markdown') {
          lines.push(`# ${bookName}`)
          if (book.premise) lines.push('', `> ${book.premise}`, '')
        } else {
          lines.push(`《${bookName}》`)
          if (book.premise) lines.push('', book.premise, '')
          lines.push('', '='.repeat(40), '')
        }
        for (const ch of exportChapters) {
          if (fmt === 'markdown') lines.push('', `## ${ch.title}`, '')
          else lines.push('', ch.title, '-'.repeat(20), '')
          if (ch.content) lines.push(ch.content)
        }
        if (hasMeta) {
          const totalWC = exportChapters.reduce((s: number, c: any) => s + (c.word_count || c.content?.length || 0), 0)
          lines.push('', '---', `章节数: ${exportChapters.length}  总字数: ${totalWC}  导出时间: ${new Date().toLocaleString('zh-CN')}`)
        }
        writeFileSync(outPath, lines.join('\n'), 'utf8')
        return `导出成功: ${outPath}`
      }

      // ── EPUB ──
      if (fmt === 'epub') {
        const { ZipArchive } = require('archiver')
        const fse = require('fs')
        // 清理 EPUB 标题标记（# 标题行），保留纯文本
        function stripTitleMarkers(text: string): string {
          return text.replace(/^#+\s*/gm, '').trim()
        }
        // 转义 XHTML 特殊字符
        function xhtmlEscape(text: string): string {
          return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        }
        // 将 Markdown 段落转换为 XHTML 段落
        function mdToHtml(text: string): string {
          const lines = text.split('\n')
          const html: string[] = []
          let inPara = false
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed) {
              if (inPara) { html.push('</p>'); inPara = false }
              continue
            }
            // 标题
            if (/^#{1,6}\s/.test(trimmed)) {
              if (inPara) { html.push('</p>'); inPara = false }
              const level = trimmed.match(/^#+/)![0].length
              const title = xhtmlEscape(trimmed.replace(/^#+\s*/, ''))
              html.push(`<h${level}>${title}</h${level}>`)
              continue
            }
            // 分隔线
            if (/^[-*_]{3,}$/.test(trimmed)) {
              if (inPara) { html.push('</p>'); inPara = false }
              html.push('<hr/>')
              continue
            }
            if (!inPara) { html.push('<p>'); inPara = true }
            // 加粗/斜体
            let processed = xhtmlEscape(trimmed)
            processed = processed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            processed = processed.replace(/\*(.+?)\*/g, '<em>$1</em>')
            html.push(processed)
          }
          if (inPara) html.push('</p>')
          return html.join('\n')
        }

        const safeName = bookName.replace(/[<>:"/\\|?*]/g, '_').trim() || 'novel'
        const stream = fse.createWriteStream(outPath)
        const archive = new ZipArchive({ zlib: { level: 9 } })
        archive.pipe(stream)

        // mimetype 必须第一个添加且不压缩（EPUB 规范）
        archive.append('application/epub+zip', { name: 'mimetype', store: true })

        // META-INF/container.xml
        archive.append(
          `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`,
          { name: 'META-INF/container.xml' }
        )

        // CSS
        archive.append(
          `body { font-family: serif; line-height: 1.8; margin: 1em 2em; }
h1 { text-align: center; margin: 2em 0 1em; font-size: 1.6em; }
h2 { text-align: center; margin: 1.5em 0 0.8em; font-size: 1.3em; }
p { text-indent: 2em; margin: 0; }
hr { margin: 1.5em 0; }`,
          { name: 'OEBPS/stylesheet.css' }
        )

        // 生成 chapter XHTML
        const chapterFiles: string[] = []
        for (let i = 0; i < exportChapters.length; i++) {
          const ch = exportChapters[i]
          const fn = `chapter-${String(i + 1).padStart(3, '0')}.xhtml`
          chapterFiles.push(fn)
          const bodyLines: string[] = []
          // 使用 h1 而非 h2（EPUB 视觉层级）
          bodyLines.push(`<h1>${xhtmlEscape(ch.title || `第${ch.num}章`)}</h1>`)
          if (ch.content) bodyLines.push(mdToHtml(ch.content))
          archive.append(
            `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>${xhtmlEscape(ch.title || `第${ch.num}章`)}</title>
<link rel="stylesheet" type="text/css" href="stylesheet.css"/></head>
<body>
${bodyLines.join('\n')}
</body>
</html>`,
            { name: `OEBPS/${fn}` }
          )
        }

        // content.opf
        const uid = `urn:uuid:${bookId || safeName}`
        const manifestItems = chapterFiles.map((fn, i) =>
          `    <item id="ch${i + 1}" href="${fn}" media-type="application/xhtml+xml"/>`
        ).join('\n')
        const spineOrder = chapterFiles.map((_, i) =>
          `    <itemref idref="ch${i + 1}"/>`
        ).join('\n')
        archive.append(
          `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">${uid}</dc:identifier>
    <dc:title>${xhtmlEscape(bookName)}</dc:title>
    <dc:language>zh-CN</dc:language>
    <dc:creator>AINovel</dc:creator>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="css" href="stylesheet.css" media-type="text/css"/>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
${manifestItems}
  </manifest>
  <spine>
${spineOrder}
  </spine>
</package>`,
          { name: 'OEBPS/content.opf' }
        )

        // nav.xhtml（EPUB3 导航）
        const navItems = exportChapters.map((ch, i) =>
          `          <li><a href="chapter-${String(i + 1).padStart(3, '0')}.xhtml">${xhtmlEscape(ch.title || `第${ch.num}章`)}</a></li>`
        ).join('\n')
        archive.append(
          `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>目录</title></head>
<body>
  <nav epub:type="toc">
    <h1>目录</h1>
    <ol>
${navItems}
    </ol>
  </nav>
</body>
</html>`,
          { name: 'OEBPS/nav.xhtml' }
        )

        await archive.finalize()
        await new Promise<void>((resolve, reject) => {
          stream.on('close', () => resolve())
          stream.on('error', (err: Error) => reject(err))
        })
        return `导出成功: ${outPath}`
      }

      return `导出失败: 不支持的格式 ${fmt}`
    } catch (e: any) {
      log.error('run-export:error', e?.message || e)
      return '导出失败: ' + (e?.message || '未知错误')
    }
  })

  // ── 配置管理 ──
  ipcMain.handle('save-config-value', async (_e: Electron.IpcMainInvokeEvent, key: string, value: any) => { getDB().setConfig(key, value); return true })
  ipcMain.handle('load-config-value', async (_e: Electron.IpcMainInvokeEvent, key: string) => { return getDB().getConfig(key) })

  // ── 模型管理 ──
  ipcMain.handle('fetch-models', async (_e: Electron.IpcMainInvokeEvent, baseUrl: string, apiKey: string, protocol: string) => {
    try {
      const url = protocol === 'openai' ? baseUrl.replace(/\/+$/, '') + '/models' : baseUrl.replace(/\/+$/, '') + '/v1/models'
      const headers = { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' }
      const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10000) })
      if (!resp.ok) return { error: 'HTTP ' + resp.status + ': ' + resp.statusText }
      const data = await resp.json()
      const models = (data.data || data.models || []).map((m: any) => m.id || m.name).filter(Boolean)
      return { models }
    } catch (e: any) { return { error: e.message || '请求失败' } }
  })

  ipcMain.handle('load-provider-config', async () => {
    try {
      const config = getDB().getConfig('provider_config')
      if (config) return config
    } catch (e: any) { log.error('load-provider-config:db', e) }
    if (!existsSync(CONFIG_PATH)) return null
    try {
      const jsonConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'))
      getDB().setConfig('provider_config', jsonConfig)
      return jsonConfig
    } catch (e: any) { log.error('load-provider-config:file', e); return null }
  })

  ipcMain.handle('save-provider-config', async (_e: Electron.IpcMainInvokeEvent, config: any) => {
    try { getDB().setConfig('provider_config', config) } catch (e: any) { log.error('save-provider-config:db', e) }
    const dir = dirname(CONFIG_PATH)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2))
    return true
  })

  // ── 图片生成 ──
  // 支持多种图片接口格式，通过 image_format 配置切换：
  //   "openai"  — OpenAI DALL·E 标准格式（response_format 在顶层）
  //   "agnes"   — Agnes AI / LiteLLM 格式（response_format 在 extra_body 内 + return_base64）
  //   未设置    — 自动兼容模式（优先尝试 agnes 格式）
  ipcMain.handle('generate-image', async (_e: Electron.IpcMainInvokeEvent, providerKey: string, model: string, prompt: string, options?: { size?: string; style?: string }) => {
    try {
      const config = getDB().getConfig('provider_config')
      if (!config) return { error: '未配置任何 Provider，请先在模型管理中设置' }
      const key = providerKey || config.image_provider || ''
      const mdl = model || config.image_model || ''
      if (!key) return { error: '未配置图片生成 Provider，请先在模型管理中设置图片生成模型' }
      if (!mdl) return { error: '未配置图片生成模型，请先在模型管理中选择图片模型' }
      if (!config?.providers?.[key]) return { error: `Provider "${key}" 未配置` }
      const p = config.providers[key]
      if (!p.api_key) return { error: `Provider "${key}" API Key 未设置` }
      const url = (p.base_url || '').replace(/\/+$/, '') + '/images/generations'
      const imageFormat = config.image_format || 'agnes'

      // 根据接口格式构建请求体
      let body: Record<string, any>
      switch (imageFormat) {
        case 'openai':
          // OpenAI DALL·E 标准
          body = {
            model: mdl, prompt,
            size: options?.size || '1024x1024',
            n: 1,
            response_format: 'b64_json',
          }
          break
        case 'agnes':
        default:
          // Agnes AI / LiteLLM 兼容格式
          body = {
            model: mdl, prompt,
            size: options?.size || '1024x1024',
            return_base64: true,
            extra_body: { response_format: 'b64_json' },
          }
          break
      }
      if (options?.style) body.style = options.style

      const resp = await fetch(url, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + p.api_key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      })
      const data = await resp.json()
      if (!resp.ok) return { error: data?.error?.message || `HTTP ${resp.status}: ${resp.statusText}` }
      const item = data?.data?.[0]
      // 优先使用 base64 数据
      if (item?.b64_json) return { image: `data:image/png;base64,${item.b64_json}` }
      // 兼容返回 URL 的 provider：下载后转 base64
      if (item?.url) {
        const imgResp = await fetch(item.url, { signal: AbortSignal.timeout(30000) })
        if (!imgResp.ok) return { error: `下载图片失败: HTTP ${imgResp.status}` }
        const arr = await imgResp.arrayBuffer()
        const contentType = imgResp.headers.get('content-type') || 'image/png'
        const b64 = Buffer.from(arr).toString('base64')
        return { image: `data:${contentType};base64,${b64}` }
      }
      return { error: 'API 未返回图片数据' }
    } catch (e: any) { return { error: e.message || '图片生成失败' } }
  })

  ipcMain.handle('save-image-provider-config', async (_e: Electron.IpcMainInvokeEvent, imageProvider: string, imageModel: string, imageFormat?: string) => {
    try {
      const config = getDB().getConfig('provider_config') || {}
      config.image_provider = imageProvider
      config.image_model = imageModel
      if (imageFormat) config.image_format = imageFormat
      getDB().setConfig('provider_config', config)
      return true
    } catch (e: any) { log.error('save-image-provider-config', e); return false }
  })

  // ── 封面图片 ──
  ipcMain.handle('select-cover-image', async () => {
    const { dialog } = require('electron')
    const result = await dialog.showOpenDialog({ properties: ['openFile'], title: '选择封面图片', filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }] })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  ipcMain.handle('save-book-cover', async (_e: Electron.IpcMainInvokeEvent, id: string, imagePath: string) => {
    const { join: pJoin } = require('path')
    const dir = pJoin(GUI_DATA_DIR, 'books', id)
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
    // 支持 base64 data URL（AI 生成的图片）
    if (typeof imagePath === 'string' && imagePath.startsWith('data:image/')) {
      const match = imagePath.match(/^data:image\/(png|jpeg|jpg|gif|webp);base64,(.+)$/)
      if (!match) { log.error('save-cover:invalid base64 format'); return false }
      const ext = '.' + match[1].replace('jpeg', 'jpg')
      const dest = pJoin(dir, 'cover' + ext)
      for (const e of coverExts) { const old = pJoin(dir, 'cover' + e); if (old !== dest && existsSync(old)) try { unlinkSync(old) } catch (e: any) { log.error('save-cover:unlink', e) } }
      try { writeFileSync(dest, Buffer.from(match[2], 'base64')); return true } catch (e: any) { log.error('save-cover:write', e); return e.message }
    }
    // 原有逻辑：本地文件路径
    const safeImagePath = validatePath(imagePath)
    if (!existsSync(safeImagePath)) { log.error('save-cover: image not found:', safeImagePath); return false }
    const ext = coverExts.find(e => safeImagePath.toLowerCase().endsWith(e)) || '.png'
    const dest = pJoin(dir, 'cover' + ext)
    for (const e of coverExts) { const old = pJoin(dir, 'cover' + e); if (old !== dest && existsSync(old)) try { unlinkSync(old) } catch (e: any) { log.error('save-cover:unlink', e) } }
    try { copyFileSync(safeImagePath, dest); return true } catch (e: any) { log.error('save-cover:copy', e); return e.message }
  })

  ipcMain.handle('get-book-cover', async (_e: Electron.IpcMainInvokeEvent, id: string) => {
    const { join: pJoin } = require('path')
    const dir = validatePath(pJoin(GUI_DATA_DIR, 'books', id))
    if (!existsSync(dir)) return null
    for (const ext of coverExts) {
      const coverFile = pJoin(dir, 'cover' + ext)
      if (existsSync(coverFile)) {
        const data = readFileSync(coverFile)
        const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/bmp'
        return `data:${mime};base64,${data.toString('base64')}`
      }
    }
    return null
  })

  // ── 自动更新 ──
  ipcMain.handle('check-update', async () => {
    try {
      const apiUrl = 'https://api.github.com/repos/crazytreeChen/ainovel-gui/releases/latest'
      const apiResp = await fetch(apiUrl, { headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ainovel-gui' }, signal: AbortSignal.timeout(10000) })
      if (!apiResp.ok) return { available: false, error: '无法获取最新版本信息 (HTTP ' + apiResp.status + ')' }
      const release = await apiResp.json()
      const latestVersion = (release.tag_name || '').replace(/^v/, '') || '0.0.0'
      const available = semverGt(latestVersion, APP_VERSION)
      // 尝试获取下载清单 — 404 时仍有版本信息
      let download = null
      try {
        const manifestUrl = `https://github.com/crazytreeChen/ainovel-gui/releases/download/v${latestVersion}/download.json`
        const manifestResp = await fetch(manifestUrl, { signal: AbortSignal.timeout(5000) })
        if (manifestResp.ok) {
          const manifest = await manifestResp.json()
          const platform = os.platform() === 'darwin' ? (os.arch() === 'arm64' ? 'mac-arm64' : 'mac-x64') : os.platform() === 'win32' ? 'win-x64' : 'linux-x64'
          download = manifest.downloads?.[platform]
        }
      } catch { /* manifest not available, show version info only */ }
      return {
        available,
        currentVersion: APP_VERSION,
        latestVersion,
        url: download?.url || '',
        notes: release.body || '',
        releaseDate: release.published_at || '',
        size: download?.size || 0,
        sha256: download?.sha256 || '',
      }
    } catch (e: any) { return { available: false, error: e.message || '检查更新失败' } }
  })

  ipcMain.handle('download-update', async (_e: Electron.IpcMainInvokeEvent, url: string, expectedSha256: string) => {
    try {
      if (!validateDownloadUrl(url)) return { success: false, error: 'URL 不在白名单内，仅允许 https://github.com/crazytreeChen/ainovel-gui/releases/download/ 路径' }
      const crypto = require('crypto')
      const destDir = require('electron').app.getPath('downloads')
      const filename = url.split('/').pop() || 'ainovel-update'
      const destPath = join(destDir, filename)
      const response = await fetch(url, { signal: AbortSignal.timeout(600000) })
      if (!response.ok) return { success: false, error: 'HTTP ' + response.status }
      if (!response.body) return { success: false, error: '下载响应无内容' }
      const totalSize = parseInt(response.headers.get('content-length') || '0')
      const chunks: Buffer[] = []; let downloaded = 0
      const body = response.body as any
      for await (const chunk of body) { chunks.push(Buffer.from(chunk)); downloaded += chunk.length; if (state.mainWindow && !state.mainWindow.isDestroyed()) state.mainWindow.webContents.send('download-progress', { percent: totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0, bytesPerSecond: 0, downloaded, total: totalSize }) }
      const fileBuffer = Buffer.concat(chunks)
      writeFileSync(destPath, fileBuffer)
      if (expectedSha256) {
        const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex')
        if (actualHash !== expectedSha256.toLowerCase()) { unlinkSync(destPath); return { success: false, error: 'SHA256 校验失败' } }
      }
      return { success: true, path: destPath, size: fileBuffer.length }
    } catch (e: any) { return { success: false, error: e.message || '下载失败' } }
  })

  ipcMain.handle('install-update', async (_e: Electron.IpcMainInvokeEvent, filePath: string) => {
    try {
      if (!validateInstallPath(filePath)) return { success: false, error: '非法的安装包路径：仅允许 downloads 目录下的 .dmg/.exe/.AppImage/.deb 文件' }
      if (os.platform() === 'win32') { require('child_process').spawn(filePath, ['/S'], { detached: true, stdio: 'ignore' }); return { success: true } }
      else { require('electron').shell.openPath(filePath); return { success: true } }
    } catch (e: any) { return { success: false, error: e.message || '启动安装失败' } }
  })

  // ── 数据备份与恢复 ──
  ipcMain.handle('backup-data', async () => {
    try {
      const { ZipArchive: ArchiverClass } = require('archiver')
      const { dialog } = require('electron')
      const defaultName = `ainovel-backup-${new Date().toISOString().slice(0, 10)}.zip`
      const result = await dialog.showSaveDialog({
        title: '导出数据快照',
        defaultPath: defaultName,
        filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
      })
      if (result.canceled || !result.filePath) return { success: false, error: '取消' }
      return new Promise<{ success: boolean; path?: string; error?: string }>((resolve) => {
        const output = require('fs').createWriteStream(result.filePath!)
        const archive = new ArchiverClass({ zlib: { level: 6 } })
        output.on('close', () => resolve({ success: true, path: result.filePath!, error: undefined }))
        archive.on('error', (err: Error) => resolve({ success: false, error: err.message }))
        archive.pipe(output)
        archive.directory(GUI_DATA_DIR, 'ainovel-gui')
        archive.finalize()
      })
    } catch (e: any) { return { success: false, error: e.message || '备份失败' } }
  })

  ipcMain.handle('restore-data', async () => {
    try {
      const { dialog } = require('electron')
      const result = await dialog.showOpenDialog({
        title: '从快照恢复数据',
        filters: [{ name: 'ZIP 压缩包', extensions: ['zip'] }],
        properties: ['openFile'],
      })
      if (result.canceled || result.filePaths.length === 0) return { success: false, error: '取消' }
      const zipPath = result.filePaths[0]
      // 解压前先备份当前数据库（以防恢复失败）
      const crypto = require('crypto')
      const backupName = `pre-restore-${Date.now()}.db`
      const fs = require('fs')
      const { join: pJoin } = require('path')
      if (fs.existsSync(pJoin(GUI_DATA_DIR, 'ainovel.db'))) {
        fs.copyFileSync(pJoin(GUI_DATA_DIR, 'ainovel.db'), pJoin(GUI_DATA_DIR, backupName))
      }
      // 解压 zip 覆盖 GUI_DATA_DIR
      const { execFileSync } = require('child_process')
      execFileSync('unzip', ['-o', zipPath, '-d', require('path').dirname(GUI_DATA_DIR)], { shell: false, stdio: 'ignore' })
      // 重启数据库连接
      const dbPath = pJoin(GUI_DATA_DIR, 'ainovel-gui', 'ainovel.db')
      if (fs.existsSync(dbPath)) {
        // 如果 zip 内包含 ainovel-gui/ 目录，将其内容移到 GUI_DATA_DIR
        const srcDir = pJoin(GUI_DATA_DIR, 'ainovel-gui')
        if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
          const entries = fs.readdirSync(srcDir)
          for (const entry of entries) {
            const src = pJoin(srcDir, entry)
            const dst = pJoin(GUI_DATA_DIR, entry)
            if (fs.existsSync(dst)) {
              // 合并目录
              if (fs.statSync(dst).isDirectory()) continue // 跳过已存在的目录
              fs.unlinkSync(dst)
            }
            fs.renameSync(src, dst)
          }
          fs.rmdirSync(srcDir)
        }
      }
      // 重启 DB
      state.db = null
      getDB()
      return { success: true }
    } catch (e: any) { return { success: false, error: e.message || '恢复失败' } }
  })
}

const APP_VERSION = '0.6.1'
function semverGt(a: string, b: string) {
  const pa = a.replace(/^v/, '').split('.').map(Number)
  const pb = b.replace(/^v/, '').split('.').map(Number)
  for (let i = 0; i < 3; i++) { if ((pa[i] || 0) > (pb[i] || 0)) return true; if ((pa[i] || 0) < (pb[i] || 0)) return false }
  return false
}

module.exports = { register }

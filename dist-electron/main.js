// @ts-nocheck — Electron 主进程使用 CJS require，类型由运行时保证
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const { join, dirname } = require('path');
const { ChildProcess, spawn, execSync } = require('child_process');
const { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, copyFileSync, unlinkSync } = require('fs');
const os = require('os');
const { AppDatabase } = require('./database');
// ── 运行环境 ──
const isDev = process.env.NODE_ENV === 'development' || process.argv.includes('--dev');
// ── 全局状态 ──
let mainWindow = null;
let ainovelProcess = null;
let outputDir = '';
let configPath = '';
let db = null;
// 引擎事件缓冲区（从 stderr 实时捕获，供前端轮询）
const engineEvents = [];
// ── 数据库初始化 ──
const home = app.getPath('home');
const GUI_DATA_DIR = join(home, '.ainovel-gui');
function getDB() {
    if (!db) {
        if (!existsSync(GUI_DATA_DIR))
            mkdirSync(GUI_DATA_DIR, { recursive: true });
        db = new AppDatabase(join(GUI_DATA_DIR, 'ainovel.db'));
    }
    return db;
}
// ── ainovel-cli 路径查找 ──
function getAinovelBinary() {
    if (process.env.AINOVEL_BIN)
        return process.env.AINOVEL_BIN;
    // 1. 子模块编译产物（vendor/ainovel-cli 编译到 build/）
    const submoduleBin = join(__dirname, '..', 'build', 'ainovel-cli', 'bin', os.platform() === 'win32' ? 'ainovel-cli.exe' : 'ainovel-cli');
    if (existsSync(submoduleBin))
        return submoduleBin;
    // 同目录下的 ainovel-cli（打包后携带）
    const exeDir = dirname(app.getPath('exe'));
    const bundled = os.platform() === 'win32'
        ? join(exeDir, 'ainovel-cli.exe')
        : join(exeDir, 'ainovel-cli');
    if (existsSync(bundled))
        return bundled;
    // PATH
    try {
        const cmd = os.platform() === 'win32' ? 'where ainovel-cli' : 'which ainovel-cli';
        const which = execSync(cmd, { encoding: 'utf8' }).trim().split('\n')[0];
        if (which)
            return which;
    }
    catch { /* ignore */ }
    // 常见位置
    const home = app.getPath('home');
    const candidates = os.platform() === 'win32'
        ? [
            join(process.env.LOCALAPPDATA || '', 'ainovel-cli', 'ainovel-cli.exe'),
            join(process.env.ProgramFiles || '', 'ainovel-cli', 'ainovel-cli.exe'),
            join(home, '.ainovel', 'bin', 'ainovel-cli.exe'),
        ]
        : [
            '/usr/local/bin/ainovel-cli',
            join(home, '.local', 'bin', 'ainovel-cli'),
            join(home, '.ainovel', 'bin', 'ainovel-cli'),
        ];
    for (const p of candidates) {
        if (existsSync(p))
            return p;
    }
    return os.platform() === 'win32' ? 'ainovel-cli.exe' : 'ainovel-cli';
}
// ── 文件工具 ──
function readStoreJSON(relativePath) {
    if (!outputDir)
        return null;
    // 兼容多种目录结构
    const candidates = [
        join(outputDir, 'output', relativePath), // outputDir/output/relativePath
        join(outputDir, relativePath), // outputDir/relativePath
    ];
    // 如果 outputDir/output/ 下有子目录，也尝试 outputDir/output/{subdir}/relativePath
    const outputSub = join(outputDir, 'output');
    if (existsSync(outputSub)) {
        try {
            const entries = readdirSync(outputSub, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    candidates.push(join(outputSub, entry.name, relativePath));
                }
            }
        }
        catch { }
    }
    for (const fullPath of candidates) {
        if (existsSync(fullPath)) {
            try {
                return JSON.parse(readFileSync(fullPath, 'utf8'));
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
function readStoreText(relativePath) {
    if (!outputDir)
        return null;
    const candidates = [
        join(outputDir, 'output', relativePath),
        join(outputDir, relativePath),
    ];
    const outputSub = join(outputDir, 'output');
    if (existsSync(outputSub)) {
        try {
            const entries = readdirSync(outputSub, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.isDirectory()) {
                    candidates.push(join(outputSub, entry.name, relativePath));
                }
            }
        }
        catch { }
    }
    for (const fullPath of candidates) {
        if (existsSync(fullPath)) {
            try {
                return readFileSync(fullPath, 'utf8');
            }
            catch {
                return null;
            }
        }
    }
    return null;
}
// 带目录参数的版本（用于书籍管理 IPC）
function readStoreJSONAt(baseDir, relativePath) {
    const fullPath = join(baseDir, relativePath);
    if (!existsSync(fullPath))
        return null;
    try {
        return JSON.parse(readFileSync(fullPath, 'utf8'));
    }
    catch {
        return null;
    }
}
function readStoreTextAt(baseDir, relativePath) {
    const fullPath = join(baseDir, relativePath);
    if (!existsSync(fullPath))
        return null;
    try {
        return readFileSync(fullPath, 'utf8');
    }
    catch {
        return null;
    }
}
// 查找 outputDir/output/ 下有效的作品目录（包含 meta/progress.json）
function findActiveBookDir() {
    if (!outputDir)
        return null;
    const outputSub = join(outputDir, 'output');
    if (!existsSync(outputSub))
        return outputDir; // 降级到 outputDir 本身
    try {
        const entries = readdirSync(outputSub, { withFileTypes: true });
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const progressFile = join(outputSub, entry.name, 'meta', 'progress.json');
                if (existsSync(progressFile))
                    return join(outputSub, entry.name);
            }
        }
    }
    catch { }
    return join(outputSub); // 降级到 outputDir/output
}
// ── IPC 处理器 ──
function setupIPC() {
    ipcMain.handle('get-snapshot', async () => {
        const snap = createEmptySnapshot();
        const isAlive = ainovelProcess !== null && ainovelProcess.exitCode === null;
        snap.runtimeState = isAlive ? 'running' : 'idle';
        snap.isRunning = isAlive;
        // 优先从 SQLite 读取书籍数据
        try {
            const books = getDB().listBooks();
            if (books && books.length > 0) {
                const book = books[0]; // 目前只支持单本书
                snap.novelName = book.name || '';
                snap.style = book.style || '';
                snap.phase = book.phase || 'init';
                snap.totalWordCount = book.totalWordCount || 0;
                snap.completedCount = book.completedCount || 0;
            }
        }
        catch { }
        // 运行时数据从 ainovel-cli 读取（如果正在运行）
        if (isAlive) {
            const progress = readStoreJSON('meta/progress.json');
            if (progress) {
                // progress.json 使用 snake_case 字段名
                if (progress.novel_name)
                    snap.novelName = progress.novel_name;
                snap.phase = progress.phase || snap.phase;
                snap.flow = progress.flow || '';
                const completed = progress.completed_chapters || [];
                snap.completedCount = completed.length > 0 ? completed.length : snap.completedCount;
                snap.totalChapters = progress.total_chapters || 0;
                snap.totalWordCount = progress.total_word_count || snap.totalWordCount;
                snap.inProgressChapter = progress.in_progress_chapter || 0;
                snap.currentChapter = progress.current_chapter || 0;
                snap.pendingRewrites = progress.pending_rewrites || [];
                snap.rewriteReason = progress.rewrite_reason || '';
                snap.layered = progress.layered || false;
                if (progress.current_volume && progress.current_arc) {
                    snap.currentVolumeArc = `第${progress.current_volume}卷·第${progress.current_arc}弧`;
                }
                if (completed.length > 0) {
                    const last = completed[completed.length - 1];
                    const wc = (progress.chapter_word_counts || {})[last] || '';
                    snap.lastCommitSummary = `第${last}章 ${wc}字`;
                }
            }
        }
        else {
            // 未运行时，从 SQLite 补充所有展示数据
            try {
                const books = getDB().listBooks();
                if (books && books.length > 0) {
                    const bookId = books[0].id;
                    // 读取前提
                    const fullBook = getDB().getBook(bookId);
                    if (fullBook?.premise)
                        snap.premise = fullBook.premise.slice(0, 200);
                    // 读取角色
                    try {
                        const chars = getDB().getCharacters(bookId);
                        if (chars && chars.length > 0) {
                            snap.characters = chars.map((c) => c.name + (c.role ? `（${c.role}）` : ''));
                        }
                    }
                    catch { }
                    // 读取扁平大纲（后 30 条，最新章节优先）
                    try {
                        const entries = getDB().getOutlineEntries(bookId);
                        if (entries && entries.length > 0) {
                            snap.outline = entries.slice(-30).map((e) => ({
                                chapter: e.chapter || 0,
                                title: e.title || '',
                                coreEvent: e.core_event || '',
                            }));
                        }
                    }
                    catch { }
                    // 读取指南针
                    try {
                        const compass = getDB().getCompass(bookId);
                        if (compass) {
                            snap.compassDirection = compass.endingDirection || '';
                            snap.compassScale = compass.estimatedScale || '';
                        }
                    }
                    catch { }
                    // 读取最近评审
                    try {
                        const reviews = getDB().getReviews(bookId);
                        if (reviews && reviews.length > 0) {
                            const last = reviews[reviews.length - 1];
                            snap.lastReviewSummary = last.summary ? `第${last.chapter}章: ${last.summary.slice(0, 80)}` : '';
                        }
                    }
                    catch { }
                    // 读取用量统计
                    try {
                        const usage = getDB().getUsageStats(bookId);
                        if (usage) {
                            snap.totalInputTokens = usage.total_input || 0;
                            snap.totalOutputTokens = usage.total_output || 0;
                            snap.totalCostUSD = usage.total_cost || 0;
                            snap.totalSavedUSD = usage.total_saved || 0;
                            // 缓存数据
                            snap.cacheReadTokens = usage.cache_read || 0;
                            snap.cacheWriteTokens = usage.cache_write || 0;
                        }
                    }
                    catch { }
                    // 读取运行信息（provider/model）
                    try {
                        const meta = getDB().getRunMeta(bookId);
                        if (meta) {
                            snap.provider = meta.provider || '';
                            snap.modelName = meta.model || '';
                        }
                    }
                    catch { }
                    // 读取进度（总章节数、分层状态）
                    try {
                        const prog = getDB().database.prepare('SELECT * FROM progress WHERE book_id=?').get(bookId);
                        if (prog) {
                            snap.layered = !!prog.layered;
                            if (prog.total_chapters > 0)
                                snap.totalChapters = prog.total_chapters;
                            snap.completedCount = (() => { try {
                                return JSON.parse(prog.completed_chapters || '[]').length;
                            }
                            catch {
                                return 0;
                            } })();
                        }
                    }
                    catch { }
                }
            }
            catch { }
        }
        snap.statusLabel = deriveStatusLabel(snap);
        // 无论是否运行，都从 SQLite 补充展示数据（前提/角色/大纲/指南针/评审/用量/模型）
        try {
            const books = getDB().listBooks();
            if (books && books.length > 0) {
                const bookId = books[0].id;
                // 前提
                try {
                    const fullBook = getDB().getBook(bookId);
                    if (fullBook?.premise && !snap.premise)
                        snap.premise = fullBook.premise.slice(0, 200);
                }
                catch { }
                // 角色
                try {
                    const chars = getDB().getCharacters(bookId);
                    if (chars && chars.length > 0 && snap.characters.length === 0) {
                        snap.characters = chars.map((c) => c.name + (c.role ? `（${c.role}）` : ''));
                    }
                }
                catch { }
                // 大纲（仅当 snapshot 中没有时补充）
                try {
                    if (snap.outline.length === 0) {
                        const entries = getDB().getOutlineEntries(bookId);
                        if (entries && entries.length > 0) {
                            snap.outline = entries.slice(-30).map((e) => ({
                                chapter: e.chapter || 0,
                                title: e.title || '',
                                coreEvent: e.core_event || '',
                            }));
                        }
                    }
                }
                catch { }
                // 指南针
                try {
                    if (!snap.compassDirection) {
                        const compass = getDB().getCompass(bookId);
                        if (compass) {
                            snap.compassDirection = compass.endingDirection || '';
                            snap.compassScale = compass.estimatedScale || '';
                        }
                    }
                }
                catch { }
                // 最近评审
                try {
                    if (!snap.lastReviewSummary) {
                        const reviews = getDB().getReviews(bookId);
                        if (reviews && reviews.length > 0) {
                            const last = reviews[reviews.length - 1];
                            snap.lastReviewSummary = last.summary ? `第${last.chapter}章: ${last.summary.slice(0, 80)}` : '';
                        }
                    }
                }
                catch { }
                // 用量
                try {
                    const usage = getDB().getUsageStats(bookId);
                    if (usage) {
                        if (!snap.totalInputTokens)
                            snap.totalInputTokens = usage.total_input || 0;
                        if (!snap.totalOutputTokens)
                            snap.totalOutputTokens = usage.total_output || 0;
                        if (!snap.totalCostUSD)
                            snap.totalCostUSD = usage.total_cost || 0;
                        if (!snap.totalSavedUSD)
                            snap.totalSavedUSD = usage.total_saved || 0;
                        if (!snap.cacheReadTokens)
                            snap.cacheReadTokens = usage.cache_read || 0;
                        if (!snap.cacheWriteTokens)
                            snap.cacheWriteTokens = usage.cache_write || 0;
                    }
                }
                catch { }
                // 运行信息（provider/model）
                try {
                    const meta = getDB().getRunMeta(bookId);
                    if (meta) {
                        if (!snap.provider)
                            snap.provider = meta.provider || '';
                        if (!snap.modelName)
                            snap.modelName = meta.model || '';
                    }
                }
                catch { }
            }
        }
        catch { }
        return snap;
    });
    ipcMain.handle('get-events', async () => {
        // 优先返回实时缓冲区事件
        if (engineEvents.length > 0) {
            return [...engineEvents].slice(-500);
        }
        if (!outputDir)
            return [];
        const bookDir = findActiveBookDir();
        if (!bookDir)
            return [];
        const cpPath = join(bookDir, 'meta', 'checkpoints.jsonl');
        if (!existsSync(cpPath)) {
            // 也试试 bookDir/output/meta/checkpoints.jsonl
            const altPath = join(bookDir, 'output', 'meta', 'checkpoints.jsonl');
            if (!existsSync(altPath))
                return [];
            cpPathAlt = altPath;
        }
        const finalPath = existsSync(cpPath) ? cpPath : cpPath;
        try {
            const raw = readFileSync(cpPath, 'utf8');
            return raw.split('\n').filter(Boolean).slice(-500).map((line) => {
                try {
                    const p = JSON.parse(line);
                    return {
                        time: p.time || '', category: p.category || 'SYSTEM',
                        summary: p.summary || '', detail: p.detail || '',
                        agent: p.agent || '', depth: p.depth || 0,
                        level: p.level || 'info', duration: p.duration || 0,
                    };
                }
                catch {
                    return {
                        time: '', category: 'SYSTEM', summary: line,
                        detail: '', agent: '', depth: 0, level: 'info', duration: 0,
                    };
                }
            });
        }
        catch {
            return [];
        }
    });
    ipcMain.handle('read-chapter', async (_e, ch) => {
        if (!outputDir)
            return '';
        const bookDir = findActiveBookDir();
        if (!bookDir)
            return '';
        const f = join(bookDir, 'chapters', `${String(ch).padStart(2, '0')}.md`);
        if (!existsSync(f)) {
            // 回退到 outputDir/output/chapters/
            const fallback = join(outputDir, 'output', 'chapters', `${String(ch).padStart(2, '0')}.md`);
            if (existsSync(fallback))
                try {
                    return readFileSync(fallback, 'utf8');
                }
                catch {
                    return '';
                }
            return '';
        }
        try {
            return readFileSync(f, 'utf8');
        }
        catch {
            return '';
        }
    });
    ipcMain.handle('list-chapters', async () => {
        if (!outputDir)
            return [];
        const bookDir = findActiveBookDir();
        if (!bookDir)
            return [];
        const chDir = join(bookDir, 'chapters');
        if (!existsSync(chDir))
            return [];
        const files = readdirSync(chDir).filter((f) => f.endsWith('.md')).sort();
        const progress = readStoreJSON('meta/progress.json');
        const titles = progress?.chapterTitles || {};
        return files.map((file) => {
            const num = parseInt(file.replace('.md', ''), 10);
            if (isNaN(num))
                return null;
            const content = readFileSync(join(chDir, file), 'utf8');
            return {
                num,
                title: titles[num] || content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`,
                wordCount: content.length,
            };
        }).filter(Boolean);
    });
    ipcMain.handle('run-diag', async () => {
        const binary = getAinovelBinary();
        const cwd = outputDir || app.getPath('documents');
        try {
            return execSync(`"${binary}" --headless --diag 2>&1`, { cwd, encoding: 'utf8', timeout: 60000 });
        }
        catch (e) {
            return e.stdout || e.stderr || e.message || '诊断执行失败';
        }
    });
    ipcMain.handle('read-diag-report', async () => {
        if (!outputDir)
            return '';
        const f = join(outputDir, 'output', 'meta', 'diag-export.md');
        if (!existsSync(f))
            return '';
        return readFileSync(f, 'utf8');
    });
    ipcMain.handle('run-simulate', async (_e, bookId) => {
        const binary = getAinovelBinary();
        let cwd = outputDir || app.getPath('documents');
        if (bookId) {
            try {
                const book = getDB().getBook(bookId);
                if (book?.workspace_dir)
                    cwd = book.workspace_dir;
            }
            catch { }
        }
        try {
            return execSync(`"${binary}" --headless /simulate 2>&1`, { cwd, encoding: 'utf8', timeout: 120000 });
        }
        catch (e) {
            return e.stdout || e.stderr || e.message || '仿写分析执行失败';
        }
    });
    ipcMain.handle('run-export', async (_e, args) => {
        const binary = getAinovelBinary();
        const cwd = outputDir || app.getPath('documents');
        try {
            return execSync(`"${binary}" --headless /export ${args} 2>&1`, { cwd, encoding: 'utf8', timeout: 60000 });
        }
        catch (e) {
            return e.stdout || e.stderr || e.message || '导出失败';
        }
    });
    ipcMain.handle('start-writing', async (_e, prompt, bookId) => {
        await stopAinovelProcess();
        const binary = getAinovelBinary();
        if (!existsSync(binary))
            return false;
        // 如果有 bookId，从数据库读取工作目录
        let cwd = outputDir || app.getPath('documents');
        if (bookId) {
            try {
                const book = getDB().getBook(bookId);
                if (book?.workspace_dir)
                    cwd = book.workspace_dir;
            }
            catch { }
        }
        if (!existsSync(cwd))
            mkdirSync(cwd, { recursive: true });
        // 更新全局 outputDir
        outputDir = cwd;
        const args = ['--headless', '--prompt', prompt];
        if (configPath)
            args.push('--config', configPath);
        try {
            ainovelProcess = spawn(binary, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
            ainovelProcess.on('exit', (code) => {
                ainovelProcess = null;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('process-exited', code);
                }
            });
            ainovelProcess.on('error', () => { ainovelProcess = null; });
            // 启动运行时数据同步
            startRuntimeSync();
            return true;
        }
        catch {
            return false;
        }
    });
    // 从 checkpoint 恢复写作（不传 --prompt，引擎自动检测进度恢复）
    ipcMain.handle('resume-writing', async (_e, bookId) => {
        await stopAinovelProcess();
        const binary = getAinovelBinary();
        if (!existsSync(binary))
            return false;
        // 从数据库读取工作目录
        let cwd = outputDir || app.getPath('documents');
        if (bookId) {
            try {
                const book = getDB().getBook(bookId);
                if (book?.workspace_dir)
                    cwd = book.workspace_dir;
            }
            catch { }
        }
        if (!existsSync(cwd)) {
            mkdirSync(cwd, { recursive: true });
            return false;
        }
        // 引擎的 output_dir 在 config 中配置为相对路径（如 output/novel），
        // 所以 cwd 需要设为 output/ 的父目录，而非 novel 本身
        // 检查 cwd 是否包含 /output/，如果是则往上退一层
        const sep = path.sep;
        const outputPattern = new RegExp(`${sep}output${sep}[^${sep}]+$`);
        const outputParent = cwd.replace(outputPattern, '');
        if (outputParent !== cwd && existsSync(join(outputParent, 'output'))) {
            cwd = outputParent;
        }
        // 更新全局 outputDir
        outputDir = cwd;
        const args = ['--headless'];
        if (configPath)
            args.push('--config', configPath);
        try {
            ainovelProcess = spawn(binary, args, { cwd, stdio: ['pipe', 'pipe', 'pipe'], env: { ...process.env } });
            // 捕获 stderr 输出到实时事件缓冲区
            let stderrData = '';
            ainovelProcess.stderr.on('data', (data) => {
                const text = data.toString();
                stderrData += text;
                // 解析行级事件 [HH:MM:SS] [CATEGORY] summary
                for (const line of text.split('\n').filter(Boolean)) {
                    const match = line.match(/\[(\d{2}:\d{2}:\d{2})\]\s+\[(\w+)\]\s+(.*)/);
                    if (match) {
                        // 拼接完整时间戳（用今天的日期 + 日志时间）
                        const now = new Date();
                        const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${match[1]}`;
                        engineEvents.push({
                            time: timeStr,
                            category: match[2],
                            summary: match[3],
                            detail: '',
                            agent: '',
                            depth: 0,
                            level: match[2] === 'ERROR' ? 'error' : match[2] === 'WARN' ? 'warn' : 'info',
                            duration: 0,
                        });
                    }
                }
                // 保留最近 2000 条
                if (engineEvents.length > 2000)
                    engineEvents.splice(0, engineEvents.length - 2000);
            });
            // 捕获 stdout 作为实时输出（StreamOutput）
            // 解析 [T]/[C] 标记分离思考与正文
            let streamMode = 'content';
            let streamBuf = '';
            let streamTimer = null;
            ainovelProcess.stdout.on('data', (data) => {
                const text = data.toString();
                const clean = text.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
                if (!clean || !mainWindow || mainWindow.isDestroyed())
                    return;
                // 检测 [T]/[C] 标记
                const tIdx = clean.indexOf('[T]');
                const cIdx = clean.indexOf('[C]');
                if (tIdx >= 0 || cIdx >= 0) {
                    // 遇到标记时先把缓冲区内容发出去
                    if (streamBuf) {
                        mainWindow.webContents.send('stream-output', JSON.stringify({ type: streamMode, text: streamBuf }));
                        streamBuf = '';
                    }
                    if (tIdx >= 0)
                        streamMode = 'thinking';
                    if (cIdx >= 0)
                        streamMode = 'content';
                    // 标记后面的文本
                    const idx = tIdx >= 0 ? tIdx + 3 : cIdx + 3;
                    const rest = clean.substring(idx).trim();
                    if (rest)
                        streamBuf = rest;
                }
                else {
                    streamBuf += clean;
                }
                // 积累足够多或定时刷新
                if (streamBuf.length > 100) {
                    mainWindow.webContents.send('stream-output', JSON.stringify({ type: streamMode, text: streamBuf }));
                    streamBuf = '';
                }
                if (!streamTimer) {
                    streamTimer = setTimeout(() => {
                        streamTimer = null;
                        if (streamBuf) {
                            mainWindow.webContents.send('stream-output', JSON.stringify({ type: streamMode, text: streamBuf }));
                            streamBuf = '';
                        }
                    }, 500);
                }
            });
            ainovelProcess.on('exit', (code) => {
                if (code !== 0 && stderrData) {
                    console.error('[ainovel-cli resume exit] code:', code, 'stderr:', stderrData);
                }
                stopRuntimeSync();
                ainovelProcess = null;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('process-exited', code);
                }
            });
            ainovelProcess.on('error', () => { ainovelProcess = null; });
            startRuntimeSync();
            return true;
        }
        catch {
            return false;
        }
    });
    ipcMain.handle('send-input', async (_e, text) => {
        if (!ainovelProcess || !ainovelProcess.stdin || ainovelProcess.exitCode !== null)
            return false;
        try {
            ainovelProcess.stdin.write(text + '\n');
            // 在事件流中显示用户输入
            const now = new Date();
            const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
            engineEvents.push({
                time: timeStr,
                category: 'USER',
                summary: text.slice(0, 120),
                detail: text,
                agent: '',
                depth: 0,
                level: 'info',
                duration: 0,
            });
            return true;
        }
        catch {
            return false;
        }
    });
    ipcMain.handle('pause-writing', async () => {
        if (!ainovelProcess || ainovelProcess.exitCode !== null)
            return false;
        try {
            ainovelProcess.kill('SIGINT');
            return true;
        }
        catch {
            return false;
        }
    });
    ipcMain.handle('stop-writing', async () => { await stopAinovelProcess(); return true; });
    ipcMain.handle('select-directory', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openDirectory'],
            title: '选择小说工作目录',
            message: '选择存放 output/ 的父目录（即运行 ainovel-cli 的工作目录）',
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        outputDir = result.filePaths[0];
        return outputDir;
    });
    ipcMain.handle('set-directory', async (_e, dir) => {
        outputDir = dir;
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        return true;
    });
    ipcMain.handle('get-directory', async () => outputDir);
    ipcMain.handle('check-binary', async () => {
        try {
            const binary = getAinovelBinary();
            if (!existsSync(binary))
                return { available: false, version: '', path: binary };
            const version = execSync(`"${binary}" --version 2>&1`, { encoding: 'utf8' }).trim();
            return { available: true, version, path: binary };
        }
        catch {
            return { available: false, version: '', path: '' };
        }
    });
    ipcMain.handle('open-directory', async (_e, dir) => {
        const { shell } = require('electron');
        shell.openPath(dir);
    });
    // ── 书籍管理 IPC ──
    ipcMain.handle('list-books', async () => {
        try {
            return getDB().listBooks();
        }
        catch {
            return [];
        }
    });
    ipcMain.handle('create-book', async (_e, name, style, phase, premise, tags) => {
        const crypto = require('crypto');
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const book = { id, name, premise: premise || '', style: style || 'default', planning_tier: 'short', phase: phase || 'init', flow: 'writing', layered: false, total_word_count: 0, workspace_dir: null, tags: tags || '', created_at: now, updated_at: now, last_opened_at: now };
        getDB().createBook(book);
        const bookDir = join(home, '.ainovel-gui', 'books', id);
        if (!existsSync(bookDir))
            mkdirSync(bookDir, { recursive: true });
        return { ...book, completedCount: 0 };
    });
    ipcMain.handle('delete-book', async (_e, id) => {
        getDB().deleteBook(id);
        return true;
    });
    ipcMain.handle('get-book', async (_e, id) => {
        return getDB().getBook(id);
    });
    ipcMain.handle('save-config-value', async (_e, key, value) => {
        getDB().setConfig(key, value);
        return true;
    });
    ipcMain.handle('load-config-value', async (_e, key) => {
        return getDB().getConfig(key);
    });
    ipcMain.handle('get-book-dir', async (_e, id) => {
        const book = (index.books || []).find(b => b.id === id);
        if (!book)
            return null;
        return book.workspaceDir || join(GUI_DATA_DIR, 'books', id);
    });
    ipcMain.handle('get-gui-data-dir', async () => GUI_DATA_DIR);
    // ── 数据库调试 ──
    ipcMain.handle('debug-db', async () => {
        try {
            const myDB = getDB();
            const bookCount = myDB.listBooks().length;
            const dbPath = join(GUI_DATA_DIR, 'ainovel.db');
            const exists = existsSync(dbPath);
            const size = exists ? readFileSync(dbPath).length : 0;
            return { path: dbPath, exists, size, bookCount, home };
        }
        catch (e) {
            return { error: e.message || String(e) };
        }
    });
    // ── 导入已有书籍 ──
    ipcMain.handle('scan-workspace', async (_e, dir) => {
        try {
            // 检查是否是有效的 ainovel 工作目录（有 output/ 子目录）
            const outputDirCheck = join(dir, 'output');
            if (!existsSync(outputDirCheck))
                return null;
            // 读取元数据
            const progress = readStoreJSON('meta/progress.json');
            const premiseRaw = readStoreText('meta/premise.md');
            const bookJson = readStoreJSONAt(dir, 'book.json');
            // 统计章节数
            let chapterCount = 0;
            const chDir = join(dir, 'chapters');
            if (existsSync(chDir)) {
                chapterCount = readdirSync(chDir).filter(f => f.endsWith('.md')).length;
            }
            return {
                name: progress?.novelName || bookJson?.name || '',
                style: bookJson?.style || progress?.style || 'default',
                phase: progress?.phase || 'init',
                chapterCount,
                totalWordCount: progress?.totalWordCount || 0,
                premise: premiseRaw ? premiseRaw.slice(0, 200) : '',
                hasLayered: progress?.layered || false,
                hasCharacters: existsSync(join(dir, 'characters.json')),
                hasOutline: existsSync(join(dir, 'outline.json')),
            };
        }
        catch {
            return null;
        }
    });
    ipcMain.handle('import-workspace', async (_e, dir) => {
        try {
            const crypto = require('crypto');
            const id = crypto.randomUUID();
            const now = new Date().toISOString();
            // 扫描信息
            const info = await ipcMain.emit('scan-workspace', null, dir);
            const progress = readStoreJSON('meta/progress.json');
            const bookJson = readStoreJSONAt(dir, 'book.json');
            const name = progress?.novelName || bookJson?.name || '未命名作品';
            const style = bookJson?.style || progress?.style || 'default';
            const phase = progress?.phase || 'init';
            // 创建书籍记录
            const book = {
                id, name, premise: bookJson?.premise || '', style,
                planning_tier: bookJson?.planningTier || bookJson?.planning_tier || 'short',
                phase, flow: 'writing', layered: progress?.layered ? 1 : 0,
                total_word_count: progress?.totalWordCount || 0,
                workspace_dir: dir,
                created_at: now, updated_at: now, last_opened_at: now,
            };
            getDB().createBook(book);
            // 复制封面（如果有）
            const coverExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];
            for (const ext of coverExts) {
                const coverFile = join(dir, 'cover' + ext);
                if (existsSync(coverFile)) {
                    const destDir = join(GUI_DATA_DIR, 'books', id);
                    if (!existsSync(destDir))
                        mkdirSync(destDir, { recursive: true });
                    copyFileSync(coverFile, join(destDir, 'cover' + ext));
                    break;
                }
            }
            // 同步现有数据到 SQLite
            const db = getDB();
            try {
                // 同步大纲
                const outline = readStoreJSONAt(dir, 'outline.json');
                if (outline && outline.length > 0)
                    db.saveOutlineEntries(id, outline);
                // 同步分层大纲
                const layeredOutline = readStoreJSONAt(dir, 'layered_outline.json');
                if (layeredOutline && layeredOutline.length > 0) {
                    db.saveVolumes(id, layeredOutline);
                    const allArcs = [];
                    const allArcChapters = [];
                    for (const v of layeredOutline) {
                        for (const a of (v.arcs || [])) {
                            allArcs.push({ volume_idx: v.index || v.idx || 0, idx: a.index || a.idx || 0, title: a.title, goal: a.goal, estimated_chapters: a.estimatedChapters || 0 });
                            for (const ac of (a.chapters || [])) {
                                allArcChapters.push({ volume_idx: v.index || v.idx || 0, arc_idx: a.index || a.idx || 0, chapter: ac.chapter || 0, title: ac.title, core_event: ac.coreEvent || '', hook: ac.hook || '', scenes: ac.scenes || [] });
                            }
                        }
                    }
                    if (allArcs.length > 0)
                        db.saveArcs(id, allArcs);
                    if (allArcChapters.length > 0)
                        db.saveArcChapters(id, allArcChapters);
                }
                // 同步指南针
                const compass = readStoreJSONAt(dir, 'compass.json');
                if (compass)
                    db.saveCompass(id, compass);
                // 同步角色
                const chars = readStoreJSONAt(dir, 'characters.json');
                if (chars && chars.length > 0)
                    db.saveCharacters(id, chars);
                // 同步时间线
                const timeline = readStoreJSONAt(dir, 'timeline.json');
                if (timeline && timeline.length > 0)
                    db.saveTimelineEvents(id, timeline);
                const foreshadow = readStoreJSONAt(dir, 'foreshadow_ledger.json');
                if (foreshadow && foreshadow.length > 0)
                    db.saveForeshadowEntries(id, foreshadow);
                const relations = readStoreJSONAt(dir, 'relationship_state.json');
                if (relations && relations.length > 0)
                    db.saveRelationshipEntries(id, relations);
                // 同步章节
                if (existsSync(join(dir, 'chapters'))) {
                    const files = readdirSync(join(dir, 'chapters')).filter(f => f.endsWith('.md')).sort();
                    for (const file of files) {
                        const num = parseInt(file.replace('.md', ''), 10);
                        if (!isNaN(num)) {
                            const content = readFileSync(join(dir, 'chapters', file), 'utf8');
                            const title = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`;
                            db.saveChapter(id, num, content, title);
                        }
                    }
                }
                // 同步评审
                const reviewDir = join(dir, 'reviews');
                if (existsSync(reviewDir)) {
                    const revFiles = readdirSync(reviewDir).filter(f => f.endsWith('.json'));
                    const reviews = revFiles.map(f => {
                        try {
                            return JSON.parse(readFileSync(join(reviewDir, f), 'utf8'));
                        }
                        catch {
                            return null;
                        }
                    }).filter(Boolean);
                    if (reviews.length > 0)
                        db.saveReviews(id, reviews);
                }
                // 同步仿写画像
                const simProfile = readStoreJSONAt(dir, 'simulation_profile.json');
                if (simProfile)
                    db.saveSimulationProfile(id, simProfile);
                // 同步用户规则
                const userRules = readStoreJSONAt(dir, 'user_rules.json');
                if (userRules)
                    db.saveUserRules(id, userRules);
                // 同步摘要
                const summaryDir = join(dir, 'summaries');
                if (existsSync(summaryDir)) {
                    const summaryFiles = readdirSync(summaryDir).filter(f => f.endsWith('.json'));
                    const summaries = summaryFiles.map(f => {
                        try {
                            const s = JSON.parse(readFileSync(join(summaryDir, f), 'utf8'));
                            if (s.chapter)
                                return { type: 'chapter', ref_key: String(s.chapter), summary: s.summary || '', characters: s.characters || [], key_events: s.keyEvents || s.key_events || [] };
                            if (s.arc !== undefined)
                                return { type: 'arc', ref_key: `arc-v${String(s.volume).padStart(2, '0')}a${String(s.arc).padStart(2, '0')}`, summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] };
                            if (s.volume && s.arc === undefined)
                                return { type: 'volume', ref_key: `vol-v${String(s.volume).padStart(2, '0')}`, summary: s.summary || '', characters: [], key_events: s.keyEvents || s.key_events || [] };
                            return null;
                        }
                        catch {
                            return null;
                        }
                    }).filter(Boolean);
                    if (summaries.length > 0)
                        db.saveSummaries(id, summaries);
                }
                // 同步用户指令
                const userDirPath = join(dir, 'meta', 'user_directives.json');
                if (existsSync(userDirPath)) {
                    try {
                        const directives = JSON.parse(readFileSync(userDirPath, 'utf8'));
                        if (directives.length > 0)
                            db.saveUserDirectives(id, directives);
                    }
                    catch { }
                }
            }
            catch { }
            return { ...book, completedCount: progress?.completedChapters?.length || 0 };
        }
        catch {
            return null;
        }
    });
    // ── 大纲/章节数据 IPC ──
    function getBookDirById(id) {
        try {
            const book = getDB().getBook(id);
            if (book)
                return join(GUI_DATA_DIR, 'books', id);
        }
        catch { }
        // fallback
        return join(GUI_DATA_DIR, 'books', id);
    }
    ipcMain.handle('get-book-outline', async (_e, id) => {
        const dir = getBookDirById(id);
        if (!dir)
            return null;
        const db = getDB();
        let outline = null, layeredOutline = null, compass = null, premise = null;
        // 优先从 SQLite 读取
        try {
            const entries = db.getOutlineEntries(id);
            if (entries && entries.length > 0)
                outline = entries;
            const volumes = db.getVolumes(id);
            const arcs = db.getArcs(id);
            const arcChapters = db.getArcChapters(id);
            if (volumes && volumes.length > 0) {
                layeredOutline = volumes.map(v => ({
                    index: v.idx, title: v.title, theme: v.theme,
                    arcs: arcs.filter(a => a.volume_idx === v.idx).map(a => ({
                        index: a.idx, title: a.title, goal: a.goal,
                        estimatedChapters: a.estimated_chapters,
                        chapters: arcChapters.filter(ac => ac.volume_idx === v.idx && ac.arc_idx === a.idx)
                            .map(ac => ({ chapter: ac.chapter, title: ac.title, coreEvent: ac.core_event, hook: ac.hook, scenes: ac.scenes })),
                    })),
                }));
            }
            compass = db.getCompass(id);
        }
        catch { }
        // SQLite 无数据时从 JSON 回退
        if (!outline || outline.length === 0) {
            outline = readStoreJSONAt(dir, 'outline.json');
            try {
                if (outline && outline.length > 0)
                    db.saveOutlineEntries(id, outline);
            }
            catch { }
        }
        if (!layeredOutline || layeredOutline.length === 0) {
            layeredOutline = readStoreJSONAt(dir, 'layered_outline.json');
        }
        if (!compass) {
            compass = readStoreJSONAt(dir, 'compass.json');
            try {
                if (compass)
                    db.saveCompass(id, compass);
            }
            catch { }
        }
        if (!premise) {
            premise = readStoreTextAt(dir, 'premise.md');
        }
        return { outline, layeredOutline, compass, premise };
    });
    ipcMain.handle('save-book-outline', async (_e, id, data) => {
        const dir = getBookDirById(id);
        if (!dir)
            return false;
        const db = getDB();
        try {
            // SQLite
            if (data.outline)
                db.saveOutlineEntries(id, data.outline);
            if (data.layeredOutline) {
                const layered = data.layeredOutline;
                db.saveVolumes(id, layered);
                const allArcs = [];
                const allArcChapters = [];
                for (const v of layered) {
                    for (const a of (v.arcs || [])) {
                        allArcs.push({ volume_idx: v.index || v.idx || 0, idx: a.index || a.idx || 0, title: a.title, goal: a.goal, estimated_chapters: a.estimatedChapters || a.estimated_chapters || 0 });
                        for (const ac of (a.chapters || [])) {
                            allArcChapters.push({ volume_idx: v.index || v.idx || 0, arc_idx: a.index || a.idx || 0, chapter: ac.chapter || 0, title: ac.title, core_event: ac.coreEvent || ac.core_event || '', hook: ac.hook || '', scenes: ac.scenes || [] });
                        }
                    }
                }
                db.saveArcs(id, allArcs);
                db.saveArcChapters(id, allArcChapters);
            }
            if (data.compass)
                db.saveCompass(id, data.compass);
        }
        catch { }
        // JSON (ainovel-cli 兼容)
        if (data.outline)
            writeFileSync(join(dir, 'outline.json'), JSON.stringify(data.outline, null, 2));
        if (data.layeredOutline)
            writeFileSync(join(dir, 'layered_outline.json'), JSON.stringify(data.layeredOutline, null, 2));
        if (data.compass)
            writeFileSync(join(dir, 'compass.json'), JSON.stringify(data.compass, null, 2));
        if (data.premise !== undefined)
            writeFileSync(join(dir, 'premise.md'), data.premise);
        return true;
    });
    ipcMain.handle('get-book-chapters', async (_e, id) => {
        const dir = getBookDirById(id);
        if (!dir)
            return [];
        const chDir = join(dir, 'chapters');
        // 优先从 SQLite 读取
        try {
            const dbChapters = getDB().listChapters(id);
            if (dbChapters && dbChapters.length > 0) {
                return dbChapters.map(c => ({
                    num: c.num, title: c.title || `第${c.num}章`,
                    wordCount: c.word_count || 0, status: c.status || 'completed',
                }));
            }
        }
        catch { }
        // 回退到 JSON
        if (!existsSync(chDir))
            return [];
        const files = readdirSync(chDir).filter(f => f.endsWith('.md')).sort();
        return files.map(file => {
            const num = parseInt(file.replace('.md', ''), 10);
            if (isNaN(num))
                return null;
            try {
                const content = readFileSync(join(chDir, file), 'utf8');
                const firstLine = content.split('\n')[0] || '';
                const title = firstLine.replace(/^#\s*/, '').trim() || `第${num}章`;
                // 同步到 SQLite
                try {
                    getDB().saveChapter(id, num, content, title);
                }
                catch { }
                return { num, title, wordCount: content.length, status: 'completed' };
            }
            catch {
                return { num, title: `第${num}章`, wordCount: 0, status: 'completed' };
            }
        }).filter(Boolean);
    });
    ipcMain.handle('get-book-chapter', async (_e, id, num) => {
        const dir = getBookDirById(id);
        if (!dir)
            return null;
        // 优先从 SQLite 读取
        try {
            const dbCh = getDB().getChapter(id, num);
            const dbDraft = getDB().getDraft(id, num);
            const dbPlan = getDB().getChapterPlan(id, num);
            if (dbCh && dbCh.content) {
                return { num, content: dbCh.content || '', draft: dbDraft || '', plan: dbPlan };
            }
        }
        catch { }
        // 回退到 JSON
        const chFile = join(dir, 'chapters', `${String(num).padStart(2, '0')}.md`);
        const draftFile = join(dir, 'drafts', `${String(num).padStart(2, '0')}.draft.md`);
        const planFile = join(dir, 'drafts', `${String(num).padStart(2, '0')}.plan.json`);
        let content = '';
        let draft = '';
        let plan = null;
        if (existsSync(chFile))
            content = readFileSync(chFile, 'utf8');
        if (existsSync(draftFile))
            draft = readFileSync(draftFile, 'utf8');
        if (existsSync(planFile)) {
            try {
                plan = JSON.parse(readFileSync(planFile, 'utf8'));
            }
            catch { }
        }
        // 同步到 SQLite
        try {
            if (content)
                getDB().saveChapter(id, num, content, '');
            if (draft)
                getDB().saveDraft(id, num, draft);
            if (plan)
                getDB().saveChapterPlan(id, num, plan);
        }
        catch { }
        return { num, content, draft, plan };
    });
    ipcMain.handle('save-book-chapter', async (_e, id, num, content) => {
        const dir = getBookDirById(id);
        if (!dir)
            return false;
        // SQLite
        try {
            getDB().saveChapter(id, num, content, '');
        }
        catch { }
        // JSON
        const chDir = join(dir, 'chapters');
        if (!existsSync(chDir))
            mkdirSync(chDir, { recursive: true });
        writeFileSync(join(chDir, `${String(num).padStart(2, '0')}.md`), content, 'utf8');
        return true;
    });
    // 角色 IPC
    ipcMain.handle('get-book-characters', async (_e, id) => {
        const dir = getBookDirById(id);
        if (!dir)
            return [];
        // 优先从 SQLite 读取
        try {
            const chars = getDB().getCharacters(id);
            if (chars && chars.length > 0)
                return chars;
        }
        catch { }
        // 回退到 JSON
        const chars = readStoreJSONAt(dir, 'characters.json') || [];
        try {
            if (chars.length > 0)
                getDB().saveCharacters(id, chars);
        }
        catch { }
        return chars;
    });
    ipcMain.handle('save-book-characters', async (_e, id, chars) => {
        const dir = getBookDirById(id);
        if (!dir)
            return false;
        // SQLite
        try {
            getDB().saveCharacters(id, chars);
        }
        catch { }
        // JSON
        writeFileSync(join(dir, 'characters.json'), JSON.stringify(chars, null, 2));
        return true;
    });
    // 时间线 IPC
    ipcMain.handle('get-book-timeline', async (_e, id) => {
        const dir = getBookDirById(id);
        if (!dir)
            return null;
        // 优先从 SQLite 读取
        try {
            const events = getDB().getTimelineEvents(id);
            if (events && events.length > 0) {
                return {
                    timeline: events,
                    foreshadow: getDB().getForeshadowEntries(id),
                    relationships: getDB().getRelationshipEntries(id),
                    stateChanges: getDB().getStateChanges(id),
                };
            }
        }
        catch { }
        // 回退到 JSON
        const timeline = readStoreJSONAt(dir, 'timeline.json') || [];
        const foreshadow = readStoreJSONAt(dir, 'foreshadow_ledger.json') || [];
        const relationships = readStoreJSONAt(dir, 'relationship_state.json') || [];
        const stateChanges = readStoreJSONAt(dir, 'meta/state_changes.json') || [];
        // 同步到 SQLite
        try {
            if (timeline.length > 0)
                getDB().saveTimelineEvents(id, timeline);
            if (foreshadow.length > 0)
                getDB().saveForeshadowEntries(id, foreshadow);
            if (relationships.length > 0)
                getDB().saveRelationshipEntries(id, relationships);
            if (stateChanges.length > 0)
                getDB().saveStateChanges(id, stateChanges);
        }
        catch { }
        return { timeline, foreshadow, relationships, stateChanges };
    });
    // 评审 IPC
    ipcMain.handle('get-book-reviews', async (_e, id) => {
        const dir = getBookDirById(id);
        if (!dir)
            return [];
        // 优先从 SQLite 读取
        try {
            const reviews = getDB().getReviews(id);
            if (reviews && reviews.length > 0)
                return reviews;
        }
        catch { }
        // 回退到 JSON
        const reviewDir = join(dir, 'reviews');
        if (!existsSync(reviewDir))
            return [];
        const reviews = readdirSync(reviewDir).filter(f => f.endsWith('.json')).map(file => {
            try {
                return { ...JSON.parse(readFileSync(join(reviewDir, file), 'utf8')), _file: file };
            }
            catch {
                return null;
            }
        }).filter(Boolean).sort((a, b) => (a.chapter || 0) - (b.chapter || 0));
        // 同步到 SQLite
        try {
            if (reviews.length > 0)
                getDB().saveReviews(id, reviews);
        }
        catch { }
        return reviews;
    });
    // ── 仿写画像 IPC ──
    ipcMain.handle('get-simulation-profile', async (_e, bookId) => {
        try {
            // 优先从 SQLite 读取
            const db = getDB();
            const row = db.getSimulationProfile(bookId);
            if (row)
                return row;
        }
        catch { }
        // 回退到 JSON 文件
        const dir = getBookDirById(bookId);
        if (!dir)
            return null;
        const profile = readStoreJSONAt(dir, 'simulation_profile.json');
        if (profile) {
            // 同步到 SQLite
            try {
                getDB().saveSimulationProfile(bookId, profile);
            }
            catch { }
            return profile;
        }
        return null;
    });
    ipcMain.handle('save-simulation-profile', async (_e, bookId, profile) => {
        try {
            getDB().saveSimulationProfile(bookId, profile);
            // 同步到 JSON
            const dir = getBookDirById(bookId);
            if (dir) {
                const { writeFileSync } = require('fs');
                const { join } = require('path');
                writeFileSync(join(dir, 'simulation_profile.json'), JSON.stringify(profile, null, 2));
            }
            return true;
        }
        catch {
            return false;
        }
    });
    // ── 用户规则 IPC ──
    ipcMain.handle('get-user-rules', async (_e, bookId) => {
        try {
            return getDB().getUserRules(bookId);
        }
        catch {
            return null;
        }
    });
    ipcMain.handle('save-user-rules', async (_e, bookId, rules) => {
        try {
            getDB().saveUserRules(bookId, rules);
            return true;
        }
        catch {
            return false;
        }
    });
    // ── 封面图片 IPC ──
    const coverExts = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'];
    ipcMain.handle('select-cover-image', async () => {
        const result = await dialog.showOpenDialog({
            properties: ['openFile'],
            title: '选择封面图片',
            filters: [{ name: '图片', extensions: ['png', 'jpg', 'jpeg', 'gif', 'webp'] }],
        });
        if (result.canceled || result.filePaths.length === 0)
            return null;
        return result.filePaths[0];
    });
    ipcMain.handle('save-book-cover', async (_e, id, imagePath) => {
        const dir = getBookDirById(id);
        if (!dir) {
            console.error('[cover] dir not found for', id);
            return false;
        }
        if (!existsSync(imagePath)) {
            console.error('[cover] image not found:', imagePath);
            return false;
        }
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        const ext = coverExts.find(e => imagePath.toLowerCase().endsWith(e)) || '.png';
        const dest = join(dir, 'cover' + ext);
        // 删除旧封面
        for (const e of coverExts) {
            const old = join(dir, 'cover' + e);
            if (old !== dest && existsSync(old))
                try {
                    unlinkSync(old);
                }
                catch { }
        }
        try {
            copyFileSync(imagePath, dest);
            return true;
        }
        catch (e) {
            console.error('[cover] copy failed:', e.message);
            return e.message;
        }
    });
    ipcMain.handle('get-book-cover', async (_e, id) => {
        const dir = getBookDirById(id);
        if (!dir)
            return null;
        for (const ext of coverExts) {
            const coverFile = join(dir, 'cover' + ext);
            if (existsSync(coverFile)) {
                const data = readFileSync(coverFile);
                const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.gif' ? 'image/gif' : ext === '.webp' ? 'image/webp' : 'image/bmp';
                return `data:${mime};base64,${data.toString('base64')}`;
            }
        }
        return null;
    });
    // ── 模型管理 IPC ──
    const CONFIG_PATH = join(home, '.ainovel', 'config.json');
    ipcMain.handle('fetch-models', async (_e, baseUrl, apiKey, protocol) => {
        try {
            const url = protocol === 'openai'
                ? baseUrl.replace(/\/+$/, '') + '/models'
                : baseUrl.replace(/\/+$/, '') + '/v1/models';
            const headers = { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' };
            const resp = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
            if (!resp.ok)
                return { error: 'HTTP ' + resp.status + ': ' + resp.statusText };
            const data = await resp.json();
            const models = (data.data || data.models || []).map(m => m.id || m.name).filter(Boolean);
            return { models };
        }
        catch (e) {
            return { error: e.message || '请求失败' };
        }
    });
    ipcMain.handle('load-provider-config', async () => {
        const db = getDB();
        // 优先从 SQLite 读取
        try {
            const config = db.getConfig('provider_config');
            if (config)
                return config;
        }
        catch { }
        // 回退到 JSON 并同步到 SQLite
        if (!existsSync(CONFIG_PATH))
            return null;
        try {
            const jsonConfig = JSON.parse(readFileSync(CONFIG_PATH, 'utf8'));
            db.setConfig('provider_config', jsonConfig);
            return jsonConfig;
        }
        catch {
            return null;
        }
    });
    ipcMain.handle('save-provider-config', async (_e, config) => {
        // SQLite
        try {
            getDB().setConfig('provider_config', config);
        }
        catch { }
        // JSON (ainovel-cli 兼容)
        const dir = dirname(CONFIG_PATH);
        if (!existsSync(dir))
            mkdirSync(dir, { recursive: true });
        writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
        return true;
    });
    // ── 配角名册 IPC ──
    ipcMain.handle('get-book-cast', async (_e, bookId) => {
        try {
            return getDB().getCastEntries(bookId);
        }
        catch {
            return [];
        }
    });
    ipcMain.handle('save-book-cast', async (_e, bookId, entries) => {
        try {
            getDB().saveCastEntries(bookId, entries);
            return true;
        }
        catch {
            return false;
        }
    });
    // ── 世界观/风格规则 IPC ──
    ipcMain.handle('get-world-rules', async (_e, bookId) => {
        try {
            return getDB().getWorldRules(bookId);
        }
        catch {
            return [];
        }
    });
    ipcMain.handle('save-world-rules', async (_e, bookId, rules) => {
        try {
            getDB().saveWorldRules(bookId, rules);
            return true;
        }
        catch {
            return false;
        }
    });
    ipcMain.handle('get-style-rules', async (_e, bookId) => {
        try {
            return getDB().getStyleRules(bookId);
        }
        catch {
            return null;
        }
    });
    ipcMain.handle('save-style-rules', async (_e, bookId, rules) => {
        try {
            getDB().saveStyleRules(bookId, rules);
            return true;
        }
        catch {
            return false;
        }
    });
    // ── 运行元信息/用量统计 IPC ──
    ipcMain.handle('get-run-meta', async (_e, bookId) => {
        try {
            return getDB().getRunMeta(bookId);
        }
        catch {
            return null;
        }
    });
    ipcMain.handle('save-run-meta', async (_e, bookId, meta) => {
        try {
            getDB().saveRunMeta(bookId, meta);
            return true;
        }
        catch {
            return false;
        }
    });
    ipcMain.handle('get-usage-stats', async (_e, bookId) => {
        try {
            return getDB().getUsageStats(bookId);
        }
        catch {
            return null;
        }
    });
    ipcMain.handle('save-usage-stats', async (_e, bookId, stats) => {
        try {
            getDB().saveUsageStats(bookId, stats);
            return true;
        }
        catch {
            return false;
        }
    });
    // ── 书籍编辑 IPC ──
    ipcMain.handle('update-book', async (_e, id, fields) => {
        try {
            getDB().updateBook(id, fields);
            return true;
        }
        catch {
            return false;
        }
    });
    // ── 摘要管理 IPC ──
    ipcMain.handle('get-book-summaries', async (_e, bookId) => {
        try {
            return getDB().getSummaries(bookId);
        }
        catch {
            return [];
        }
    });
    ipcMain.handle('save-book-summaries', async (_e, bookId, summaries) => {
        try {
            getDB().saveSummaries(bookId, summaries);
            return true;
        }
        catch {
            return false;
        }
    });
    // ── 用户指令 IPC ──
    ipcMain.handle('get-user-directives', async (_e, bookId) => {
        try {
            return getDB().getUserDirectives(bookId);
        }
        catch {
            return [];
        }
    });
    ipcMain.handle('save-user-directives', async (_e, bookId, directives) => {
        try {
            getDB().saveUserDirectives(bookId, directives);
            return true;
        }
        catch {
            return false;
        }
    });
    // ── 自动更新 IPC ──
    // semver 比较: 返回 true 如果 a > b
    function semverGt(a, b) {
        const pa = a.replace(/^v/, '').split('.').map(Number);
        const pb = b.replace(/^v/, '').split('.').map(Number);
        for (let i = 0; i < 3; i++) {
            if ((pa[i] || 0) > (pb[i] || 0))
                return true;
            if ((pa[i] || 0) < (pb[i] || 0))
                return false;
        }
        return false;
    }
    // 当前版本
    const APP_VERSION = '0.1.0';
    const UPDATE_MANIFEST_URL = 'https://github.com/crazytreeChen/ainovel-gui/releases/download/v' +
        '{version}/download.json';
    ipcMain.handle('check-update', async () => {
        try {
            // 先获取最新版本号，再拼接 download.json 地址
            const apiUrl = 'https://api.github.com/repos/crazytreeChen/ainovel-gui/releases/latest';
            const apiResp = await fetch(apiUrl, {
                headers: { 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'ainovel-gui' },
                signal: AbortSignal.timeout(10000),
            });
            if (!apiResp.ok)
                return { available: false, error: 'HTTP ' + apiResp.status };
            const release = await apiResp.json();
            const latestVersion = (release.tag_name || '').replace(/^v/, '') || '0.0.0';
            // 拉取 download.json
            const manifestUrl = `https://github.com/crazytreeChen/ainovel-gui/releases/download/v${latestVersion}/download.json`;
            const manifestResp = await fetch(manifestUrl, {
                signal: AbortSignal.timeout(10000),
            });
            if (!manifestResp.ok)
                return { available: false, error: '无法获取版本清单' };
            const manifest = await manifestResp.json();
            const platform = os.platform() === 'darwin' ? (os.arch() === 'arm64' ? 'mac-arm64' : 'mac-x64')
                : os.platform() === 'win32' ? 'win-x64' : 'linux-x64';
            const download = manifest.downloads?.[platform];
            const available = semverGt(latestVersion, APP_VERSION);
            return {
                available,
                currentVersion: APP_VERSION,
                latestVersion,
                url: download?.url || '',
                notes: manifest.release_notes || '',
                releaseDate: manifest.release_date || '',
                size: download?.size || 0,
                sha256: download?.sha256 || '',
            };
        }
        catch (e) {
            return { available: false, error: e.message || '检查更新失败' };
        }
    });
    ipcMain.handle('download-update', async (_e, url, expectedSha256) => {
        try {
            const crypto = require('crypto');
            const destDir = app.getPath('downloads');
            const filename = url.split('/').pop() || 'ainovel-update';
            const destPath = join(destDir, filename);
            const response = await fetch(url, { signal: AbortSignal.timeout(600000) });
            if (!response.ok)
                return { success: false, error: 'HTTP ' + response.status };
            const totalSize = parseInt(response.headers.get('content-length') || '0');
            const chunks = [];
            let downloaded = 0;
            // @ts-ignore
            for await (const chunk of response.body) {
                chunks.push(Buffer.from(chunk));
                downloaded += chunk.length;
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.webContents.send('download-progress', {
                        percent: totalSize > 0 ? Math.round((downloaded / totalSize) * 100) : 0,
                        bytesPerSecond: 0,
                        downloaded,
                        total: totalSize,
                    });
                }
            }
            const fileBuffer = Buffer.concat(chunks);
            writeFileSync(destPath, fileBuffer);
            // SHA256 校验
            if (expectedSha256) {
                const actualHash = crypto.createHash('sha256').update(fileBuffer).digest('hex');
                if (actualHash !== expectedSha256.toLowerCase()) {
                    unlinkSync(destPath);
                    return { success: false, error: 'SHA256 校验失败，文件可能已损坏' };
                }
            }
            return { success: true, path: destPath, size: fileBuffer.length };
        }
        catch (e) {
            return { success: false, error: e.message || '下载失败' };
        }
    });
    ipcMain.handle('install-update', async (_e, filePath) => {
        try {
            const { shell } = require('electron');
            if (os.platform() === 'win32') {
                // Windows: 静默安装
                const { spawn } = require('child_process');
                spawn(filePath, ['/S'], { detached: true, stdio: 'ignore' });
                return { success: true };
            }
            else {
                // macOS: 打开 DMG
                shell.openPath(filePath);
                return { success: true };
            }
        }
        catch (e) {
            return { success: false, error: e.message || '启动安装失败' };
        }
    });
}
async function stopAinovelProcess() {
    if (!ainovelProcess)
        return;
    try {
        ainovelProcess.kill('SIGTERM');
        await new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(), 5000);
            ainovelProcess.on('exit', () => { clearTimeout(timeout); resolve(); });
        });
    }
    catch { /* ignore */ }
    ainovelProcess = null;
    // 清空事件缓冲区
    engineEvents.length = 0;
    stopRuntimeSync();
}
function createEmptySnapshot() {
    return {
        novelName: '', provider: '', modelName: '', style: '',
        phase: 'init', flow: '', runtimeState: 'idle', isRunning: false,
        completedCount: 0, totalChapters: 0, totalWordCount: 0,
        inProgressChapter: 0, currentChapter: 0,
        pendingRewrites: [], rewriteReason: '', layered: false,
        currentVolumeArc: '', premise: '', outline: [], characters: [],
        compassDirection: '', compassScale: '',
        totalInputTokens: 0, totalOutputTokens: 0, totalCostUSD: 0, totalSavedUSD: 0,
        cacheReadTokens: 0, cacheWriteTokens: 0,
        contextPercent: 0, contextTokens: 0, contextWindow: 0,
        lastCommitSummary: '', lastReviewSummary: '', pendingSteer: '',
        statusLabel: 'READY', agents: [], recentSummaries: [],
    };
}
function deriveStatusLabel(snap) {
    if (snap.phase === 'complete')
        return 'COMPLETE';
    if (snap.flow === 'reviewing')
        return 'REVIEW';
    if (snap.flow === 'rewriting' || snap.flow === 'polishing')
        return 'REWRITE';
    if (snap.runtimeState === 'running')
        return 'RUNNING';
    return 'READY';
}
// ── 轮询 ──
let pollTimer = null;
function startSnapshotPolling() {
    if (pollTimer)
        clearInterval(pollTimer);
    pollTimer = setInterval(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('snapshot-tick', Date.now());
        }
    }, 2000);
}
// ── 运行时数据实时同步到 SQLite ──
let syncTimer = null;
function startRuntimeSync() {
    if (syncTimer)
        clearInterval(syncTimer);
    syncTimer = setInterval(() => {
        if (!ainovelProcess || ainovelProcess.exitCode !== null)
            return;
        try {
            const progress = readStoreJSON('meta/progress.json');
            if (!progress)
                return;
            // 查找当前书籍 ID
            const books = getDB().listBooks();
            if (books.length === 0)
                return;
            const bookId = books[0].id;
            // 1. 更新进度
            const completed = progress.completed_chapters || [];
            const wordCounts = progress.chapter_word_counts || {};
            const totalWords = Object.values(wordCounts).reduce((a, b) => a + (Number(b) || 0), 0);
            getDB().database.prepare(`
        UPDATE progress SET 
          novel_name=?, phase=?, current_chapter=?, total_chapters=?,
          completed_chapters=?, total_word_count=?, chapter_word_counts=?,
          in_progress_chapter=?, flow=?, pending_rewrites=?, rewrite_reason=?,
          current_volume=?, current_arc=?
        WHERE book_id=?
      `).run(progress.novel_name || '', progress.phase || '', progress.current_chapter || 0, progress.total_chapters || 0, JSON.stringify(completed), totalWords, JSON.stringify(wordCounts), progress.in_progress_chapter || 0, progress.flow || '', JSON.stringify(progress.pending_rewrites || []), progress.rewrite_reason || '', progress.current_volume || 0, progress.current_arc || 0, bookId);
            // 更新 books 表字数
            getDB().database.prepare('UPDATE books SET total_word_count=? WHERE id=?').run(totalWords, bookId);
            // 2. 检测新章节并导入
            const bookDir = findActiveBookDir();
            if (bookDir) {
                const chDir = join(bookDir, 'chapters');
                if (existsSync(chDir)) {
                    const files = readdirSync(chDir).filter(f => f.endsWith('.md')).sort();
                    for (const file of files) {
                        const num = parseInt(file.replace('.md', ''), 10);
                        if (isNaN(num))
                            continue;
                        const existing = getDB().database.prepare('SELECT id FROM chapters WHERE book_id=? AND num=?').get(bookId, num);
                        if (existing)
                            continue;
                        // 新章节，导入到 SQLite
                        try {
                            const content = readFileSync(join(chDir, file), 'utf8');
                            const title = content.split('\n')[0]?.replace(/^#\s*/, '').trim() || `第${num}章`;
                            getDB().saveChapter(bookId, num, content, title);
                            console.log('[sync] 新章节导入:', num, title);
                        }
                        catch { }
                    }
                }
            }
        }
        catch { }
    }, 10000); // 每 10 秒同步一次
}
function stopRuntimeSync() {
    if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
    }
}
// ── 窗口 ──
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1100,
        minHeight: 700,
        title: 'AINovel',
        backgroundColor: '#1a1a2e',
        show: false,
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: false,
        },
    });
    if (isDev) {
        mainWindow.loadURL('http://localhost:5173');
        mainWindow.webContents.openDevTools({ mode: 'detach' });
    }
    else {
        mainWindow.loadFile(join(__dirname, '../dist/index.html'));
    }
    mainWindow.on('ready-to-show', () => mainWindow?.show());
    mainWindow.on('closed', () => { mainWindow = null; });
    const homeConfig = join(app.getPath('home'), '.ainovel', 'config.json');
    if (existsSync(homeConfig))
        configPath = homeConfig;
}
// ── 生命周期 ──
app.whenReady().then(() => {
    setupIPC();
    createWindow();
    startSnapshotPolling();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
});
app.on('window-all-closed', () => {
    if (pollTimer)
        clearInterval(pollTimer);
    if (process.platform !== 'darwin')
        app.quit();
});
app.on('before-quit', async () => {
    if (pollTimer)
        clearInterval(pollTimer);
    await stopAinovelProcess();
});
//# sourceMappingURL=main.js.map
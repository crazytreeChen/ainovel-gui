"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// 暴露给渲染进程的安全 API
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // 书籍管理
    listBooks: () => electron_1.ipcRenderer.invoke('list-books'),
    createBook: (name, style, phase, premise, tags) => electron_1.ipcRenderer.invoke('create-book', name, style, phase, premise, tags),
    deleteBook: (id) => electron_1.ipcRenderer.invoke('delete-book', id),
    getBookDir: (id) => electron_1.ipcRenderer.invoke('get-book-dir', id),
    getGuiDataDir: () => electron_1.ipcRenderer.invoke('get-gui-data-dir'),
    // 大纲管理
    getBookOutline: (id) => electron_1.ipcRenderer.invoke('get-book-outline', id),
    saveBookOutline: (id, data) => electron_1.ipcRenderer.invoke('save-book-outline', id, data),
    // 章节管理
    getBookChapters: (id) => electron_1.ipcRenderer.invoke('get-book-chapters', id),
    getBookChapter: (id, num) => electron_1.ipcRenderer.invoke('get-book-chapter', id, num),
    saveBookChapter: (id, num, content) => electron_1.ipcRenderer.invoke('save-book-chapter', id, num, content),
    // 角色管理
    getBookCharacters: (id) => electron_1.ipcRenderer.invoke('get-book-characters', id),
    saveBookCharacters: (id, chars) => electron_1.ipcRenderer.invoke('save-book-characters', id, chars),
    // 配角名册
    getBookCast: (id) => electron_1.ipcRenderer.invoke('get-book-cast', id),
    saveBookCast: (id, entries) => electron_1.ipcRenderer.invoke('save-book-cast', id, entries),
    // 时间线管理
    getBookTimeline: (id) => electron_1.ipcRenderer.invoke('get-book-timeline', id),
    // 评审管理
    getBookReviews: (id) => electron_1.ipcRenderer.invoke('get-book-reviews', id),
    // 封面图片
    selectCoverImage: () => electron_1.ipcRenderer.invoke('select-cover-image'),
    saveBookCover: (id, imagePath) => electron_1.ipcRenderer.invoke('save-book-cover', id, imagePath),
    getBookCover: (id) => electron_1.ipcRenderer.invoke('get-book-cover', id),
    // 仿写画像
    getSimulationProfile: (id) => electron_1.ipcRenderer.invoke('get-simulation-profile', id),
    saveSimulationProfile: (id, profile) => electron_1.ipcRenderer.invoke('save-simulation-profile', id, profile),
    // 用户规则
    getUserRules: (id) => electron_1.ipcRenderer.invoke('get-user-rules', id),
    saveUserRules: (id, rules) => electron_1.ipcRenderer.invoke('save-user-rules', id, rules),
    // 模型管理
    fetchModels: (baseUrl, apiKey, protocol) => electron_1.ipcRenderer.invoke('fetch-models', baseUrl, apiKey, protocol),
    loadProviderConfig: () => electron_1.ipcRenderer.invoke('load-provider-config'),
    saveProviderConfig: (config) => electron_1.ipcRenderer.invoke('save-provider-config', config),
    // 快照和状态
    getSnapshot: () => electron_1.ipcRenderer.invoke('get-snapshot'),
    getEvents: () => electron_1.ipcRenderer.invoke('get-events'),
    readChapter: (chapterNum) => electron_1.ipcRenderer.invoke('read-chapter', chapterNum),
    listChapters: () => electron_1.ipcRenderer.invoke('list-chapters'),
    // 创作控制
    startWriting: (prompt, bookId) => electron_1.ipcRenderer.invoke('start-writing', prompt, bookId),
    resumeWriting: (bookId) => electron_1.ipcRenderer.invoke('resume-writing', bookId),
    sendInput: (text) => electron_1.ipcRenderer.invoke('send-input', text),
    pauseWriting: () => electron_1.ipcRenderer.invoke('pause-writing'),
    stopWriting: () => electron_1.ipcRenderer.invoke('stop-writing'),
    // 诊断
    runDiag: () => electron_1.ipcRenderer.invoke('run-diag'),
    readDiagReport: () => electron_1.ipcRenderer.invoke('read-diag-report'),
    // 导出
    runExport: (args) => electron_1.ipcRenderer.invoke('run-export', args),
    // 目录管理
    selectDirectory: () => electron_1.ipcRenderer.invoke('select-directory'),
    scanWorkspace: (dir) => electron_1.ipcRenderer.invoke('scan-workspace', dir),
    importWorkspace: (dir) => electron_1.ipcRenderer.invoke('import-workspace', dir),
    setDirectory: (dir) => electron_1.ipcRenderer.invoke('set-directory', dir),
    getDirectory: () => electron_1.ipcRenderer.invoke('get-directory'),
    openDirectory: (dir) => electron_1.ipcRenderer.invoke('open-directory', dir),
    // 系统
    checkBinary: () => electron_1.ipcRenderer.invoke('check-binary'),
    // 调试
    debugDb: () => electron_1.ipcRenderer.invoke('debug-db'),
    // 世界观/风格规则
    getWorldRules: (id) => electron_1.ipcRenderer.invoke('get-world-rules', id),
    saveWorldRules: (id, rules) => electron_1.ipcRenderer.invoke('save-world-rules', id, rules),
    getStyleRules: (id) => electron_1.ipcRenderer.invoke('get-style-rules', id),
    saveStyleRules: (id, rules) => electron_1.ipcRenderer.invoke('save-style-rules', id, rules),
    // 运行元信息/用量
    getRunMeta: (id) => electron_1.ipcRenderer.invoke('get-run-meta', id),
    saveRunMeta: (id, meta) => electron_1.ipcRenderer.invoke('save-run-meta', id, meta),
    getUsageStats: (id) => electron_1.ipcRenderer.invoke('get-usage-stats', id),
    saveUsageStats: (id, stats) => electron_1.ipcRenderer.invoke('save-usage-stats', id, stats),
    // 书籍编辑
    updateBook: (id, fields) => electron_1.ipcRenderer.invoke('update-book', id, fields),
    // 摘要管理
    getBookSummaries: (id) => electron_1.ipcRenderer.invoke('get-book-summaries', id),
    saveBookSummaries: (id, summaries) => electron_1.ipcRenderer.invoke('save-book-summaries', id, summaries),
    // 用户指令
    getUserDirectives: (id) => electron_1.ipcRenderer.invoke('get-user-directives', id),
    saveUserDirectives: (id, directives) => electron_1.ipcRenderer.invoke('save-user-directives', id, directives),
    // 自动更新
    checkUpdate: () => electron_1.ipcRenderer.invoke('check-update'),
    downloadUpdate: (url, sha256) => electron_1.ipcRenderer.invoke('download-update', url, sha256),
    installUpdate: (path) => electron_1.ipcRenderer.invoke('install-update', path),
    onDownloadProgress: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('download-progress', handler);
        return () => electron_1.ipcRenderer.removeListener('download-progress', handler);
    },
    // 事件监听
    onProcessExited: (callback) => {
        electron_1.ipcRenderer.on('process-exited', callback);
        return () => electron_1.ipcRenderer.removeListener('process-exited', callback);
    },
    onSnapshotUpdate: (callback) => {
        electron_1.ipcRenderer.on('snapshot-update', (_event, data) => callback(data));
        return () => electron_1.ipcRenderer.removeListener('snapshot-update', callback);
    },
    onStreamOutput: (callback) => {
        const handler = (_event, data) => callback(data);
        electron_1.ipcRenderer.on('stream-output', handler);
        return () => electron_1.ipcRenderer.removeListener('stream-output', handler);
    },
});
//# sourceMappingURL=preload.js.map
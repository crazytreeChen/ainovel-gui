import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 书籍管理
  listBooks: () => ipcRenderer.invoke('list-books'),
  createBook: (name: string, style: string, phase?: string, premise?: string, tags?: string) => ipcRenderer.invoke('create-book', name, style, phase, premise, tags),
  deleteBook: (id: string) => ipcRenderer.invoke('delete-book', id),
  getBook: (id: string) => ipcRenderer.invoke('get-book', id),
  getBookDir: (id: string) => ipcRenderer.invoke('get-book-dir', id),
  getGuiDataDir: () => ipcRenderer.invoke('get-gui-data-dir'),

  // 大纲管理
  getBookOutline: (id: string) => ipcRenderer.invoke('get-book-outline', id),
  saveBookOutline: (id: string, data: any) => ipcRenderer.invoke('save-book-outline', id, data),

  // 章节管理
  getBookChapters: (id: string) => ipcRenderer.invoke('get-book-chapters', id),
  getBookChapter: (id: string, num: number) => ipcRenderer.invoke('get-book-chapter', id, num),
  saveBookChapter: (id: string, num: number, content: string, title?: string) => ipcRenderer.invoke('save-book-chapter', id, num, content, title),

  // 角色管理
  getBookCharacters: (id: string) => ipcRenderer.invoke('get-book-characters', id),
  saveBookCharacters: (id: string, chars: any[]) => ipcRenderer.invoke('save-book-characters', id, chars),

  // 配角名册
  getBookCast: (id: string) => ipcRenderer.invoke('get-book-cast', id),
  saveBookCast: (id: string, entries: any[]) => ipcRenderer.invoke('save-book-cast', id, entries),

  // 时间线管理
  getBookTimeline: (id: string) => ipcRenderer.invoke('get-book-timeline', id),
  saveBookTimeline: (id: string, data: any) => ipcRenderer.invoke('save-book-timeline', id, data),

  // 评审管理
  getBookReviews: (id: string) => ipcRenderer.invoke('get-book-reviews', id),
  saveBookReview: (id: string, review: any) => ipcRenderer.invoke('save-book-review', id, review),

  // 图片生成
  generateImage: (providerKey: string, model: string, prompt: string, options?: { size?: string; style?: string }) =>
    ipcRenderer.invoke('generate-image', providerKey, model, prompt, options),
  saveImageProviderConfig: (imageProvider: string, imageModel: string, imageFormat?: string) =>
    ipcRenderer.invoke('save-image-provider-config', imageProvider, imageModel, imageFormat),

  // 封面图片
  selectCoverImage: () => ipcRenderer.invoke('select-cover-image'),
  saveBookCover: (id: string, imagePath: string) => ipcRenderer.invoke('save-book-cover', id, imagePath),
  getBookCover: (id: string) => ipcRenderer.invoke('get-book-cover', id),

  // 仿写画像
  getSimulationProfile: (id: string) => ipcRenderer.invoke('get-simulation-profile', id),
  saveSimulationProfile: (id: string, profile: any) => ipcRenderer.invoke('save-simulation-profile', id, profile),

  // 用户规则
  getUserRules: (id: string) => ipcRenderer.invoke('get-user-rules', id),
  saveUserRules: (id: string, rules: any) => ipcRenderer.invoke('save-user-rules', id, rules),

  // 模型管理
  fetchModels: (baseUrl: string, apiKey: string, protocol: string) => ipcRenderer.invoke('fetch-models', baseUrl, apiKey, protocol),
  loadProviderConfig: () => ipcRenderer.invoke('load-provider-config'),
  saveProviderConfig: (config: any) => ipcRenderer.invoke('save-provider-config', config),

  // 全局配置
  saveConfigValue: (key: string, value: any) => ipcRenderer.invoke('save-config-value', key, value),
  loadConfigValue: (key: string) => ipcRenderer.invoke('load-config-value', key),

  // 快照和状态
  getSnapshot: () => ipcRenderer.invoke('get-snapshot'),
  getEvents: () => ipcRenderer.invoke('get-events'),
  readChapter: (chapterNum: number) => ipcRenderer.invoke('read-chapter', chapterNum),
  listChapters: () => ipcRenderer.invoke('list-chapters'),

  // 创作控制
  startWriting: (prompt: string, bookId?: string) => ipcRenderer.invoke('start-writing', prompt, bookId),
  resumeWriting: (bookId: string) => ipcRenderer.invoke('resume-writing', bookId),
  sendInput: (text: string) => ipcRenderer.invoke('send-input', text),
  pauseWriting: () => ipcRenderer.invoke('pause-writing'),
  stopWriting: () => ipcRenderer.invoke('stop-writing'),

  // 诊断
  runDiag: () => ipcRenderer.invoke('run-diag'),
  readDiagReport: () => ipcRenderer.invoke('read-diag-report'),
  runSimulate: (bookId: string) => ipcRenderer.invoke('run-simulate', bookId),

  // 导出
  runExport: (args: string) => ipcRenderer.invoke('run-export', args),

  // 目录管理
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  scanWorkspace: (dir: string) => ipcRenderer.invoke('scan-workspace', dir),
  importWorkspace: (dir: string) => ipcRenderer.invoke('import-workspace', dir),
  setDirectory: (dir: string) => ipcRenderer.invoke('set-directory', dir),
  getDirectory: () => ipcRenderer.invoke('get-directory'),
  openDirectory: (dir: string) => ipcRenderer.invoke('open-directory', dir),

  // 系统
  checkBinary: () => ipcRenderer.invoke('check-binary'),

  // 批量操作
  batchCleanTitles: (id: string) => ipcRenderer.invoke('batch-clean-titles', id),
  batchGenerateTitles: (id: string) => ipcRenderer.invoke('batch-generate-titles', id),
  batchAuditBook: (id: string) => ipcRenderer.invoke('batch-audit-book', id),

  // 调试
  debugDb: () => ipcRenderer.invoke('debug-db'),

  // 世界观/风格规则
  getWorldRules: (id: string) => ipcRenderer.invoke('get-world-rules', id),
  saveWorldRules: (id: string, rules: any[]) => ipcRenderer.invoke('save-world-rules', id, rules),
  getStyleRules: (id: string) => ipcRenderer.invoke('get-style-rules', id),
  saveStyleRules: (id: string, rules: any) => ipcRenderer.invoke('save-style-rules', id, rules),

  // 运行元信息/用量
  getRunMeta: (id: string) => ipcRenderer.invoke('get-run-meta', id),
  saveRunMeta: (id: string, meta: any) => ipcRenderer.invoke('save-run-meta', id, meta),
  getUsageStats: (id: string) => ipcRenderer.invoke('get-usage-stats', id),
  saveUsageStats: (id: string, stats: any) => ipcRenderer.invoke('save-usage-stats', id, stats),

  // 书籍编辑
  updateBook: (id: string, fields: any) => ipcRenderer.invoke('update-book', id, fields),

  // 摘要管理
  getBookSummaries: (id: string) => ipcRenderer.invoke('get-book-summaries', id),
  saveBookSummaries: (id: string, summaries: any[]) => ipcRenderer.invoke('save-book-summaries', id, summaries),

  // 用户指令
  getUserDirectives: (id: string) => ipcRenderer.invoke('get-user-directives', id),
  saveUserDirectives: (id: string, directives: any[]) => ipcRenderer.invoke('save-user-directives', id, directives),

  // 自动更新
  checkUpdate: () => ipcRenderer.invoke('check-update'),
  downloadUpdate: (url: string, sha256: string) => ipcRenderer.invoke('download-update', url, sha256),
  installUpdate: (path: string) => ipcRenderer.invoke('install-update', path),
  onDownloadProgress: (callback: (data: any) => void) => {
    const handler = (_event: any, data: any) => callback(data)
    ipcRenderer.on('download-progress', handler)
    return () => ipcRenderer.removeListener('download-progress', handler)
  },

  // 全局搜索
  searchBook: (id: string, query: string) => ipcRenderer.invoke('search-book', id, query),

  // 数据备份与恢复
  backupData: () => ipcRenderer.invoke('backup-data'),
  restoreData: () => ipcRenderer.invoke('restore-data'),

  // 事件监听
  onProcessExited: (callback: () => void) => {
    ipcRenderer.on('process-exited', callback)
    return () => ipcRenderer.removeListener('process-exited', callback)
  },
  onSnapshotUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('snapshot-update', (_event, data) => callback(data))
    return () => ipcRenderer.removeListener('snapshot-update', callback)
  },
  onStreamOutput: (callback: (data: string) => void) => {
    const handler = (_event: any, data: string) => callback(data)
    ipcRenderer.on('stream-output', handler)
    return () => ipcRenderer.removeListener('stream-output', handler)
  },

  // 运行时同步推送（减少前端轮询）
  onRuntimeUpdate: (callback: () => void) => {
    const handler = () => callback()
    ipcRenderer.on('runtime-update', handler)
    return () => ipcRenderer.removeListener('runtime-update', handler)
  },
})

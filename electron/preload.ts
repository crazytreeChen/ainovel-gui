import { contextBridge, ipcRenderer } from 'electron'

// 暴露给渲染进程的安全 API
contextBridge.exposeInMainWorld('electronAPI', {
  // 书籍管理
  listBooks: () => ipcRenderer.invoke('list-books'),
  createBook: (name: string, style: string) => ipcRenderer.invoke('create-book', name, style),
  deleteBook: (id: string) => ipcRenderer.invoke('delete-book', id),
  getBookDir: (id: string) => ipcRenderer.invoke('get-book-dir', id),
  getGuiDataDir: () => ipcRenderer.invoke('get-gui-data-dir'),

  // 大纲管理
  getBookOutline: (id: string) => ipcRenderer.invoke('get-book-outline', id),
  saveBookOutline: (id: string, data: any) => ipcRenderer.invoke('save-book-outline', id, data),

  // 章节管理
  getBookChapters: (id: string) => ipcRenderer.invoke('get-book-chapters', id),
  getBookChapter: (id: string, num: number) => ipcRenderer.invoke('get-book-chapter', id, num),
  saveBookChapter: (id: string, num: number, content: string) => ipcRenderer.invoke('save-book-chapter', id, num, content),

  // 角色管理
  getBookCharacters: (id: string) => ipcRenderer.invoke('get-book-characters', id),
  saveBookCharacters: (id: string, chars: any[]) => ipcRenderer.invoke('save-book-characters', id, chars),

  // 配角名册
  getBookCast: (id: string) => ipcRenderer.invoke('get-book-cast', id),
  saveBookCast: (id: string, entries: any[]) => ipcRenderer.invoke('save-book-cast', id, entries),

  // 时间线管理
  getBookTimeline: (id: string) => ipcRenderer.invoke('get-book-timeline', id),

  // 评审管理
  getBookReviews: (id: string) => ipcRenderer.invoke('get-book-reviews', id),

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

  // 快照和状态
  getSnapshot: () => ipcRenderer.invoke('get-snapshot'),
  getEvents: () => ipcRenderer.invoke('get-events'),
  readChapter: (chapterNum: number) => ipcRenderer.invoke('read-chapter', chapterNum),
  listChapters: () => ipcRenderer.invoke('list-chapters'),

  // 创作控制
  startWriting: (prompt: string) => ipcRenderer.invoke('start-writing', prompt),
  sendInput: (text: string) => ipcRenderer.invoke('send-input', text),
  pauseWriting: () => ipcRenderer.invoke('pause-writing'),
  stopWriting: () => ipcRenderer.invoke('stop-writing'),

  // 诊断
  runDiag: () => ipcRenderer.invoke('run-diag'),
  readDiagReport: () => ipcRenderer.invoke('read-diag-report'),

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

  // 事件监听
  onProcessExited: (callback: () => void) => {
    ipcRenderer.on('process-exited', callback)
    return () => ipcRenderer.removeListener('process-exited', callback)
  },
  onSnapshotUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on('snapshot-update', (_event, data) => callback(data))
    return () => ipcRenderer.removeListener('snapshot-update', callback)
  },
})

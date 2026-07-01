import * as fs from 'fs/promises'
import * as path from 'path'
import { existsSync, mkdirSync } from 'fs'

/**
 * IO 基座 — JSON 文件原子读写
 * 对应 ainovel-cli internal/store/io.go
 */
export class IO {
  private baseDir: string

  constructor(baseDir: string) {
    this.baseDir = baseDir
  }

  dir(): string { return this.baseDir }

  private fullPath(rel: string): string {
    return path.join(this.baseDir, rel)
  }

  async readFile(rel: string): Promise<Buffer> {
    return fs.readFile(this.fullPath(rel))
  }

  async readText(rel: string): Promise<string | null> {
    try {
      return await fs.readFile(this.fullPath(rel), 'utf8')
    } catch (e: any) {
      if (e.code === 'ENOENT') return null
      throw e
    }
  }

  async readJSON<T>(rel: string): Promise<T | null> {
    try {
      const data = await fs.readFile(this.fullPath(rel), 'utf8')
      return JSON.parse(data) as T
    } catch (e: any) {
      if (e.code === 'ENOENT') return null
      throw e
    }
  }

  async writeFile(rel: string, data: Buffer | string): Promise<void> {
    const p = this.fullPath(rel)
    await fs.mkdir(path.dirname(p), { recursive: true })
    // 原子写入: tmp + rename
    const tmp = p + '.tmp-' + Date.now()
    await fs.writeFile(tmp, data, 'utf8')
    await fs.rename(tmp, p)
  }

  async writeJSON(rel: string, data: any): Promise<void> {
    await this.writeFile(rel, JSON.stringify(data, null, 2))
  }

  async writeMarkdown(rel: string, content: string): Promise<void> {
    await this.writeFile(rel, content)
  }

  async appendLine(rel: string, line: string): Promise<void> {
    const p = this.fullPath(rel)
    await fs.mkdir(path.dirname(p), { recursive: true })
    await fs.appendFile(p, line + '\n', 'utf8')
  }

  async removeFile(rel: string): Promise<void> {
    try {
      await fs.unlink(this.fullPath(rel))
    } catch (e: any) {
      if (e.code !== 'ENOENT') throw e
    }
  }

  async ensureDirs(dirs: string[]): Promise<void> {
    for (const d of dirs) {
      await fs.mkdir(this.fullPath(d), { recursive: true })
    }
  }

  async exists(rel: string): Promise<boolean> {
    return existsSync(this.fullPath(rel))
  }
}

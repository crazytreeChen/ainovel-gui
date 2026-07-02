import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as os from 'os'
import * as path from 'path'
import * as fs from 'fs'
import * as crypto from 'crypto'

const { AppDatabase } = require('./database')

describe('AppDatabase core CRUD', () => {
  let db: InstanceType<typeof AppDatabase>
  let tempDir: string
  let dbPath: string

  beforeEach(() => {
    tempDir = path.join(os.tmpdir(), `ainovel-test-${crypto.randomUUID()}`)
    fs.mkdirSync(tempDir, { recursive: true })
    dbPath = path.join(tempDir, 'test.db')
    db = new AppDatabase(dbPath)
  })

  afterEach(() => {
    try { db.close() } catch {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }) } catch {}
  })

  it('should instantiate with a temp SQLite file and run migration', () => {
    expect(db).toBeInstanceOf(AppDatabase)
    expect(fs.existsSync(dbPath)).toBe(true)

    const rawDb = require('better-sqlite3')(dbPath)
    const row = rawDb.prepare('SELECT value FROM _meta WHERE key = ?').get('schema_version')
    expect(row.value).toBe('1')
    rawDb.close()
  })

  it('should roundtrip createBook + getBook', () => {
    const book = makeBook({ id: 'book-1', name: 'Test Novel' })
    db.createBook(book)

    const got = db.getBook('book-1')
    expect(got).not.toBeNull()
    expect(got.id).toBe('book-1')
    expect(got.name).toBe('Test Novel')
    expect(got.premise).toBe('A test premise')
    expect(got.style).toBe('default')
    expect(got.phase).toBe('init')
  })

  it('should list created books', () => {
    const b1 = makeBook({ id: 'book-a', name: 'Alpha' })
    const b2 = makeBook({ id: 'book-b', name: 'Beta' })
    db.createBook(b1)
    db.createBook(b2)

    const list = db.listBooks()
    expect(list).toHaveLength(2)
    expect(list.map((b: any) => b.name)).toContain('Alpha')
    expect(list.map((b: any) => b.name)).toContain('Beta')
  })

  it('should delete a book and remove it from list', () => {
    const book = makeBook({ id: 'book-del', name: 'To Delete' })
    db.createBook(book)
    expect(db.listBooks()).toHaveLength(1)

    db.deleteBook('book-del')
    expect(db.listBooks()).toHaveLength(0)
    expect(db.getBook('book-del')).toBeUndefined()
  })

  it('should update book fields', () => {
    const book = makeBook({ id: 'book-up', name: 'Original' })
    db.createBook(book)

    db.updateBook('book-up', { name: 'Updated Name', phase: 'writing', tags: 'sci-fi' })

    const got = db.getBook('book-up')
    expect(got.name).toBe('Updated Name')
    expect(got.phase).toBe('writing')
    expect(got.tags).toBe('sci-fi')
  })

  it('should roundtrip setConfig + getConfig', () => {
    db.setConfig('providers', [{ name: 'openai', apiKey: 'sk-test' }])
    db.setConfig('theme', 'dark')

    expect(db.getConfig('providers')).toEqual([{ name: 'openai', apiKey: 'sk-test' }])
    expect(db.getConfig('theme')).toBe('dark')
    expect(db.getConfig('missing')).toBeNull()
  })
})

function makeBook(overrides: Partial<ReturnType<typeof baseBook>> = {}) {
  return { ...baseBook(), ...overrides }
}

function baseBook(): Record<string, any> {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    name: 'Test Book',
    premise: 'A test premise',
    style: 'default',
    planning_tier: 'short',
    phase: 'init',
    flow: 'writing',
    layered: false,
    total_word_count: 0,
    workspace_dir: '',
    created_at: now,
    updated_at: now,
    last_opened_at: now,
    tags: '',
  }
}

import { db, getMeta } from '../data/db'
import { importBookmarksToNewPage, type BookmarkImportItem } from '../data/repository'
import { decryptSecret } from '../shared/crypto'
import { faviconUrl, titleFromUrl } from '../shared/favicon'
import { classifyByRules } from './ruleFallback'

interface RawBrowserBookmark {
  title: string
  url: string
  path: string[]
  dateAdded?: number
}

interface CandidateBookmark extends RawBrowserBookmark {
  cleanUrl: string
  canonicalUrl: string
}

interface LLMDecision {
  index: number
  keep: boolean
  title?: string
  category?: string
  reason?: string
}

interface ImportPlan {
  items: BookmarkImportItem[]
  skippedLowQuality: number
  source: 'llm' | 'rule' | 'mixed'
}

export interface BrowserBookmarkImportReport {
  scanned: number
  candidates: number
  skippedInvalid: number
  skippedDuplicate: number
  skippedExisting: number
  skippedLowQuality: number
  imported: number
  sections: number
  pageTitle?: string
  source: 'llm' | 'rule' | 'mixed'
}

const BATCH_SIZE = 24
const TIMEOUT_MS = 25_000
const TRACKING_PARAMS = [
  /^utm_/i,
  /^spm$/i,
  /^fbclid$/i,
  /^gclid$/i,
  /^yclid$/i,
  /^mc_cid$/i,
  /^mc_eid$/i,
  /^igshid$/i,
  /^ref$/i,
  /^from$/i,
  /^source$/i,
]

export async function importExistingBrowserBookmarks(
  onProgress?: (message: string) => void,
): Promise<BrowserBookmarkImportReport> {
  onProgress?.('正在读取浏览器书签…')
  const raw = await readBrowserBookmarks()
  const prepared = await prepareCandidates(raw)

  if (prepared.candidates.length === 0) {
    return {
      scanned: raw.length,
      candidates: 0,
      skippedInvalid: prepared.skippedInvalid,
      skippedDuplicate: prepared.skippedDuplicate,
      skippedExisting: prepared.skippedExisting,
      skippedLowQuality: prepared.skippedLowQuality,
      imported: 0,
      sections: 0,
      source: 'rule',
    }
  }

  onProgress?.(`已找到 ${prepared.candidates.length} 条可导入书签，开始清洗分类…`)
  const existingCategories = (
    await db.categories.filter((category) => !category.deleted).toArray()
  ).map((category) => category.name)
  const plan = await buildImportPlan(prepared.candidates, existingCategories, onProgress)

  if (plan.items.length === 0) {
    return {
      scanned: raw.length,
      candidates: prepared.candidates.length,
      skippedInvalid: prepared.skippedInvalid,
      skippedDuplicate: prepared.skippedDuplicate,
      skippedExisting: prepared.skippedExisting,
      skippedLowQuality: prepared.skippedLowQuality + plan.skippedLowQuality,
      imported: 0,
      sections: 0,
      source: plan.source,
    }
  }

  const pageTitle = `AI 导入书签 ${new Date().toLocaleDateString('zh-CN')}`
  onProgress?.(`正在写入 ${plan.items.length} 条书签…`)
  const result = await importBookmarksToNewPage(pageTitle, plan.items)

  return {
    scanned: raw.length,
    candidates: prepared.candidates.length,
    skippedInvalid: prepared.skippedInvalid,
    skippedDuplicate: prepared.skippedDuplicate,
    skippedExisting: prepared.skippedExisting,
    skippedLowQuality: prepared.skippedLowQuality + plan.skippedLowQuality,
    imported: result.bookmarks,
    sections: result.sections,
    pageTitle,
    source: plan.source,
  }
}

async function readBrowserBookmarks(): Promise<RawBrowserBookmark[]> {
  if (!chrome.bookmarks?.getTree) {
    throw new Error('当前扩展没有浏览器书签读取权限，请重新加载扩展并确认授权')
  }

  const tree = await new Promise<chrome.bookmarks.BookmarkTreeNode[]>(
    (resolve, reject) => {
      chrome.bookmarks.getTree((nodes) => {
        const err = chrome.runtime.lastError
        if (err) reject(new Error(err.message))
        else resolve(nodes)
      })
    },
  )

  return flattenBookmarkTree(tree)
}

function flattenBookmarkTree(
  nodes: chrome.bookmarks.BookmarkTreeNode[],
  path: string[] = [],
): RawBrowserBookmark[] {
  const result: RawBrowserBookmark[] = []
  for (const node of nodes) {
    const nextPath = node.title ? [...path, node.title] : path
    if (node.url) {
      result.push({
        title: node.title,
        url: node.url,
        path,
        dateAdded: node.dateAdded,
      })
    }
    if (node.children?.length) {
      result.push(...flattenBookmarkTree(node.children, nextPath))
    }
  }
  return result
}

async function prepareCandidates(raw: RawBrowserBookmark[]) {
  const existingBookmarks = await db.bookmarks
    .filter((bookmark) => !bookmark.deleted)
    .toArray()
  const existingUrls = new Set(
    existingBookmarks
      .map((bookmark) => normalizeBookmarkUrl(bookmark.url)?.canonicalUrl)
      .filter((url): url is string => Boolean(url)),
  )
  const seen = new Set<string>()
  const candidates: CandidateBookmark[] = []
  let skippedInvalid = 0
  let skippedDuplicate = 0
  let skippedExisting = 0
  let skippedLowQuality = 0

  for (const item of raw) {
    const normalized = normalizeBookmarkUrl(item.url)
    if (!normalized) {
      skippedInvalid += 1
      continue
    }
    if (seen.has(normalized.canonicalUrl)) {
      skippedDuplicate += 1
      continue
    }
    seen.add(normalized.canonicalUrl)
    if (existingUrls.has(normalized.canonicalUrl)) {
      skippedExisting += 1
      continue
    }
    if (isLowQualityByRules(item.title, normalized.cleanUrl)) {
      skippedLowQuality += 1
      continue
    }
    candidates.push({ ...item, ...normalized })
  }

  return {
    candidates,
    skippedInvalid,
    skippedDuplicate,
    skippedExisting,
    skippedLowQuality,
  }
}

function normalizeBookmarkUrl(input: string): { cleanUrl: string; canonicalUrl: string } | null {
  try {
    const url = new URL(input.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null

    url.hash = ''
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, '')
    if (url.pathname !== '/') url.pathname = url.pathname.replace(/\/+$/, '')

    const params = new URLSearchParams(url.search)
    for (const key of Array.from(params.keys())) {
      if (TRACKING_PARAMS.some((rule) => rule.test(key))) params.delete(key)
    }
    const sortedParams = new URLSearchParams(
      Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b)),
    )
    url.search = sortedParams.toString()

    const path = url.pathname === '/' ? '' : url.pathname
    const query = url.search ? url.search : ''
    return {
      cleanUrl: url.toString(),
      canonicalUrl: `${url.protocol}//${url.hostname}${path}${query}`,
    }
  } catch {
    return null
  }
}

function isLowQualityByRules(title: string, url: string) {
  const normalizedTitle = title.trim().toLowerCase()
  if (/^(untitled|new tab|about:blank|无标题|新标签页|空白页)$/i.test(normalizedTitle)) {
    return true
  }
  return url.length > 2048
}

async function buildImportPlan(
  candidates: CandidateBookmark[],
  existingCategories: string[],
  onProgress?: (message: string) => void,
): Promise<ImportPlan> {
  const meta = await getMeta()
  const cfg = meta.llmConfig
  if (!cfg.enabled || !cfg.endpoint || !cfg.apiKeyCipher || !navigator.onLine) {
    return buildRulePlan(candidates)
  }

  const apiKey = await decryptSecret(cfg.apiKeyCipher, meta.deviceId)
  if (!apiKey) return buildRulePlan(candidates)

  const items: BookmarkImportItem[] = []
  let skippedLowQuality = 0
  let usedLLM = false
  let usedRule = false

  for (let start = 0; start < candidates.length; start += BATCH_SIZE) {
    const batch = candidates.slice(start, start + BATCH_SIZE)
    try {
      const decisions = await callLLMBatch(
        cfg.endpoint,
        cfg.model,
        apiKey,
        batch,
        existingCategories,
      )
      const mapped = new Map(decisions.map((decision) => [decision.index, decision]))
      for (let i = 0; i < batch.length; i++) {
        const candidate = batch[i]
        const decision = mapped.get(i)
        if (decision?.keep === false) {
          skippedLowQuality += 1
          continue
        }
        items.push(toImportItem(candidate, decision?.category, decision?.title))
      }
      usedLLM = true
    } catch (e) {
      console.warn('[bookmarkImport] LLM cleanup failed, fallback to rules:', e)
      items.push(...buildRulePlan(batch).items)
      usedRule = true
    }
    onProgress?.(`已处理 ${Math.min(start + BATCH_SIZE, candidates.length)} / ${candidates.length} 条书签…`)
  }

  return {
    items,
    skippedLowQuality,
    source: usedLLM && usedRule ? 'mixed' : usedLLM ? 'llm' : 'rule',
  }
}

function buildRulePlan(candidates: CandidateBookmark[]): ImportPlan {
  return {
    items: candidates.map((candidate) => toImportItem(candidate)),
    skippedLowQuality: 0,
    source: 'rule',
  }
}

function toImportItem(
  candidate: CandidateBookmark,
  category?: string,
  title?: string,
): BookmarkImportItem {
  const folderText = candidate.path.join(' / ')
  const cleanTitle = sanitizeTitle(title || candidate.title, candidate.cleanUrl)
  const categoryName = sanitizeCategory(
    category || classifyByRules(`${candidate.title} ${folderText}`, candidate.cleanUrl),
  )
  return {
    title: cleanTitle,
    url: candidate.cleanUrl,
    icon: faviconUrl(candidate.cleanUrl),
    note: folderText ? `来源：${folderText}` : undefined,
    categoryName,
  }
}

async function callLLMBatch(
  endpoint: string,
  model: string,
  apiKey: string,
  batch: CandidateBookmark[],
  existingCategories: string[],
): Promise<LLMDecision[]> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const url = endpoint.replace(/\/+$/, '') + '/chat/completions'
    const payload = batch.map((bookmark, index) => ({
      index,
      title: bookmark.title,
      url: bookmark.cleanUrl,
      folder: bookmark.path.join(' / '),
    }))
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '你是书签导入清洗助手。请为浏览器存量书签去掉低质量链接，并给保留链接分类。' +
              '低质量链接包括：失效占位页、无意义临时页、重复广告追踪页、明显无法复用的登录/跳转噪音。' +
              '不要因为小众、个人工具、外文页面而删除。分类用简短中文，优先复用已有分类。' +
              '只返回 JSON：{"items":[{"index":0,"keep":true,"title":"标题","category":"分类","reason":"原因"}]}。',
          },
          {
            role: 'user',
            content: JSON.stringify({
              existingCategories: existingCategories.slice(0, 60),
              bookmarks: payload,
            }),
          },
        ],
        temperature: 0.15,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    return parseLLMDecisions(content, batch.length)
  } finally {
    clearTimeout(timer)
  }
}

function parseLLMDecisions(content: string, batchLength: number): LLMDecision[] {
  const parsed = safeParse(content)
  const rawItems = Array.isArray(parsed?.items) ? parsed.items : []
  return rawItems
    .map((item) => {
      const obj = isRecord(item) ? item : {}
      return {
        index: Number(obj.index),
        keep: obj.keep !== false,
        title: typeof obj.title === 'string' ? obj.title : undefined,
        category: typeof obj.category === 'string' ? obj.category : undefined,
        reason: typeof obj.reason === 'string' ? obj.reason : undefined,
      }
    })
    .filter((item) => Number.isInteger(item.index) && item.index >= 0 && item.index < batchLength)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function safeParse(content: string): { items?: unknown[] } | null {
  try {
    return JSON.parse(content)
  } catch {
    const start = content.indexOf('{')
    const end = content.lastIndexOf('}')
    if (start < 0 || end <= start) return null
    try {
      return JSON.parse(content.slice(start, end + 1))
    } catch {
      return null
    }
  }
}

function sanitizeTitle(title: string, url: string) {
  const clean = title.replace(/\s+/g, ' ').trim()
  return (clean || titleFromUrl(url)).slice(0, 120)
}

function sanitizeCategory(category: string) {
  const clean = category.replace(/[「」“”"'{}[\]]/g, '').replace(/\s+/g, '').trim()
  return (clean || '未分类').slice(0, 12)
}

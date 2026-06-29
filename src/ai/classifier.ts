import { getMeta } from '../data/db'
import { decryptSecret } from '../shared/crypto'
import { classifyByRules } from './ruleFallback'
import { tr } from '../shared/i18n'
import type { Locale } from '../shared/types'

export interface ClassifyInput {
  title: string
  url: string
}

export interface ClassifyResult {
  categoryName: string
  source: 'llm' | 'rule'
}

const TIMEOUT_MS = 12_000

/**
 * 书签自动分类。
 * 优先调用用户自填的 OpenAI 兼容接口；未配置/超时/失败时降级到本地规则。
 * 始终可用 —— 离线也能给出粗分类。
 */
export async function classifyBookmark(
  input: ClassifyInput,
  existingCategories: string[],
): Promise<ClassifyResult> {
  const meta = await getMeta()
  const cfg = meta.llmConfig
  const locale = meta.locale
  const ruleResult: ClassifyResult = {
    categoryName: classifyByRules(input.title, input.url, locale),
    source: 'rule',
  }

  if (!cfg.enabled || !cfg.endpoint || !cfg.apiKeyCipher) return ruleResult
  if (!navigator.onLine) return ruleResult

  try {
    const apiKey = await decryptSecret(cfg.apiKeyCipher, meta.deviceId)
    if (!apiKey) return ruleResult
    const name = await callLLM(cfg.endpoint, cfg.model, apiKey, input, existingCategories, locale)
    if (name) return { categoryName: name, source: 'llm' }
  } catch (e) {
    console.warn('[classifier] LLM failed, fallback to rules:', e)
  }
  return ruleResult
}

async function callLLM(
  endpoint: string,
  model: string,
  apiKey: string,
  input: ClassifyInput,
  existing: string[],
  locale: Locale = 'zh-CN',
): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const sys =
      locale === 'en'
        ? 'You are a bookmark classification assistant. Based on the page title and URL, return the best short English category name, usually 1-3 words. Prefer existing categories. Return only JSON: {"category":"Category"} with no explanation.'
        : '你是书签分类助手。根据网页标题和 URL，返回一个最合适的简短中文分类名（2-6 字）。优先复用已有分类。只返回 JSON：{"category":"分类名"}，不要解释。'
    const user =
      locale === 'en'
        ? `Title: ${input.title}\nURL: ${input.url}\n`
          + (existing.length ? `Existing categories: ${existing.join(', ')}` : 'No existing categories')
        : `标题：${input.title}\nURL：${input.url}\n`
          + (existing.length ? `已有分类：${existing.join('、')}` : '暂无已有分类')

    const url = endpoint.replace(/\/+$/, '') + '/chat/completions'
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: sys },
          { role: 'user', content: user },
        ],
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const data = await resp.json()
    const content: string = data?.choices?.[0]?.message?.content ?? ''
    const parsed = safeParse(content)
    const name = (parsed?.category ?? '').toString().trim()
    return name || null
  } finally {
    clearTimeout(timer)
  }
}

function safeParse(s: string): { category?: string } | null {
  try {
    return JSON.parse(s)
  } catch {
    const m = s.match(/"category"\s*:\s*"([^"]+)"/)
    return m ? { category: m[1] } : null
  }
}

/** 测试连通性：返回 ok 或错误信息 */
export async function testLLMConnection(
  endpoint: string,
  model: string,
  apiKey: string,
  locale: Locale = 'zh-CN',
): Promise<{ ok: boolean; message: string }> {
  try {
    const name = await callLLM(
      endpoint,
      model,
      apiKey,
      { title: 'GitHub', url: 'https://github.com' },
      locale === 'en' ? ['Development', 'Reading'] : ['开发', '阅读'],
      locale,
    )
    return name
      ? { ok: true, message: tr(locale, 'connectionSucceeded', { category: name }) }
      : { ok: false, message: tr(locale, 'emptyResponse') }
  } catch (e) {
    return { ok: false, message: (e as Error).message }
  }
}

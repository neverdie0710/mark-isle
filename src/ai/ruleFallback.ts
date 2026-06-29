import { domainOf } from '../shared/favicon'
import type { Locale } from '../shared/types'

/** 域名 → 分类的内置映射 */
const DOMAIN_RULES: Array<[RegExp, string, string]> = [
  [/github\.com|gitlab\.com|bitbucket\.org/, '开发', 'Development'],
  [/stackoverflow\.com|stackexchange\.com/, '开发', 'Development'],
  [/developer\.mozilla\.org|npmjs\.com|pypi\.org/, '开发', 'Development'],
  [/youtube\.com|bilibili\.com|netflix\.com|iqiyi\.com/, '影音', 'Media'],
  [/twitter\.com|x\.com|weibo\.com|facebook\.com|instagram\.com|zhihu\.com/, '社交', 'Social'],
  [/google\.com|bing\.com|baidu\.com|duckduckgo\.com/, '搜索', 'Search'],
  [/amazon\.|taobao\.com|jd\.com|tmall\.com/, '购物', 'Shopping'],
  [/notion\.so|feishu\.cn|larksuite\.com|trello\.com|asana\.com/, '效率', 'Productivity'],
  [/medium\.com|substack\.com|juejin\.cn|csdn\.net/, '阅读', 'Reading'],
  [/openai\.com|anthropic\.com|huggingface\.co/, 'AI', 'AI'],
]

/** 关键词 → 分类（标题/URL 命中） */
const KEYWORD_RULES: Array<[RegExp, string, string]> = [
  [/doc|文档|手册|guide|tutorial|教程/i, '文档', 'Docs'],
  [/news|新闻|资讯/i, '资讯', 'News'],
  [/blog|博客/i, '阅读', 'Reading'],
  [/mail|邮箱|gmail|outlook/i, '邮箱', 'Mail'],
  [/bank|银行|pay|支付/i, '金融', 'Finance'],
]

/** 纯本地规则分类，离线可用。返回分类名，未命中返回「未分类」。 */
export function classifyByRules(
  title: string,
  url: string,
  locale: Locale = 'zh-CN',
): string {
  const d = domainOf(url)
  const index = locale === 'en' ? 2 : 1
  for (const rule of DOMAIN_RULES) {
    if (rule[0].test(d)) return rule[index]
  }
  const hay = `${title} ${url}`
  for (const rule of KEYWORD_RULES) {
    if (rule[0].test(hay)) return rule[index]
  }
  return locale === 'en' ? 'Uncategorized' : '未分类'
}

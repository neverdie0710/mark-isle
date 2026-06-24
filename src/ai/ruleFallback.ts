import { domainOf } from '../shared/favicon'

/** 域名 → 分类的内置映射 */
const DOMAIN_RULES: Array<[RegExp, string]> = [
  [/github\.com|gitlab\.com|bitbucket\.org/, '开发'],
  [/stackoverflow\.com|stackexchange\.com/, '开发'],
  [/developer\.mozilla\.org|npmjs\.com|pypi\.org/, '开发'],
  [/youtube\.com|bilibili\.com|netflix\.com|iqiyi\.com/, '影音'],
  [/twitter\.com|x\.com|weibo\.com|facebook\.com|instagram\.com|zhihu\.com/, '社交'],
  [/google\.com|bing\.com|baidu\.com|duckduckgo\.com/, '搜索'],
  [/amazon\.|taobao\.com|jd\.com|tmall\.com/, '购物'],
  [/notion\.so|feishu\.cn|larksuite\.com|trello\.com|asana\.com/, '效率'],
  [/medium\.com|substack\.com|juejin\.cn|csdn\.net/, '阅读'],
  [/openai\.com|anthropic\.com|huggingface\.co/, 'AI'],
]

/** 关键词 → 分类（标题/URL 命中） */
const KEYWORD_RULES: Array<[RegExp, string]> = [
  [/doc|文档|手册|guide|tutorial|教程/i, '文档'],
  [/news|新闻|资讯/i, '资讯'],
  [/blog|博客/i, '阅读'],
  [/mail|邮箱|gmail|outlook/i, '邮箱'],
  [/bank|银行|pay|支付/i, '金融'],
]

/** 纯本地规则分类，离线可用。返回分类名，未命中返回「未分类」。 */
export function classifyByRules(title: string, url: string): string {
  const d = domainOf(url)
  for (const [re, cat] of DOMAIN_RULES) {
    if (re.test(d)) return cat
  }
  const hay = `${title} ${url}`
  for (const [re, cat] of KEYWORD_RULES) {
    if (re.test(hay)) return cat
  }
  return '未分类'
}

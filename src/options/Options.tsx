import { useEffect, useRef, useState } from 'react'
import { getMeta, updateMeta } from '../data/db'
import { DEFAULT_APPEARANCE, type AppearanceConfig, type BackgroundMode } from '../shared/types'
import {
  isFileSystemAccessSupported,
  pickSyncDirectory,
  getSyncStatus,
  clearSyncDirectory,
  sync,
  type SyncStatus,
} from '../data/fileSync'
import { exportBackup, downloadBackup, importBackup } from '../data/backup'
import { testLLMConnection } from '../ai/classifier'
import {
  importExistingBrowserBookmarks,
  type BrowserBookmarkImportReport,
} from '../ai/bookmarkImport'
import { encryptSecret, decryptSecret } from '../shared/crypto'

const card = 'rounded-xl border border-line bg-white p-5'
const input =
  'w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent'
const btn = 'rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90'
const btnGhost = 'rounded-lg bg-canvas px-4 py-2 text-sm text-ink hover:bg-line'

export default function Options() {
  const [deviceId, setDeviceId] = useState('')
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('unconfigured')

  const [llmEnabled, setLlmEnabled] = useState(false)
  const [endpoint, setEndpoint] = useState('https://api.openai.com/v1')
  const [model, setModel] = useState('gpt-4o-mini')
  const [apiKey, setApiKey] = useState('')
  const [testMsg, setTestMsg] = useState('')
  const [savedMsg, setSavedMsg] = useState('')
  const [importingBookmarks, setImportingBookmarks] = useState(false)
  const [bookmarkImportMsg, setBookmarkImportMsg] = useState('')
  const [bookmarkImportReport, setBookmarkImportReport] =
    useState<BrowserBookmarkImportReport | null>(null)
  const [appearance, setAppearance] = useState<AppearanceConfig>(DEFAULT_APPEARANCE)
  const fileRef = useRef<HTMLInputElement>(null)
  const bgFileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    ;(async () => {
      const meta = await getMeta()
      setDeviceId(meta.deviceId)
      setLlmEnabled(meta.llmConfig.enabled)
      setEndpoint(meta.llmConfig.endpoint || 'https://api.openai.com/v1')
      setModel(meta.llmConfig.model || 'gpt-4o-mini')
      if (meta.llmConfig.apiKeyCipher) {
        setApiKey(await decryptSecret(meta.llmConfig.apiKeyCipher, meta.deviceId))
      }
      setAppearance(meta.appearance)
      setSyncStatus(await getSyncStatus())
    })()
  }, [])

  const connectDir = async () => {
    const handle = await pickSyncDirectory()
    if (handle) {
      await sync({ requestPermission: true })
      setSyncStatus(await getSyncStatus())
    }
  }
  const disconnectDir = async () => {
    await clearSyncDirectory()
    setSyncStatus('unconfigured')
  }
  const syncNow = async () => {
    const s = await sync({ requestPermission: true })
    setSyncStatus(s)
    setSavedMsg(s === 'ok' ? '同步完成' : '同步未成功（见状态）')
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const saveLLM = async () => {
    const cipher = apiKey ? await encryptSecret(apiKey, deviceId) : undefined
    await updateMeta({
      llmConfig: { enabled: llmEnabled, endpoint, model, apiKeyCipher: cipher },
    })
    setSavedMsg('已保存')
    setTimeout(() => setSavedMsg(''), 2000)
  }
  const testLLM = async () => {
    setTestMsg('测试中…')
    const r = await testLLMConnection(endpoint, model, apiKey)
    setTestMsg(r.message)
  }

  const saveAppearance = async () => {
    await updateMeta({ appearance })
    setSavedMsg('外观设置已保存，刷新新标签页后生效')
    setTimeout(() => setSavedMsg(''), 2500)
  }
  const resetAppearance = async () => {
    setAppearance(DEFAULT_APPEARANCE)
    await updateMeta({ appearance: DEFAULT_APPEARANCE })
    setSavedMsg('外观设置已重置')
    setTimeout(() => setSavedMsg(''), 2500)
  }
  const updateAppearance = <K extends keyof AppearanceConfig>(
    key: K,
    value: AppearanceConfig[K],
  ) => {
    setAppearance((cur) => ({ ...cur, [key]: value }))
  }
  const useBackgroundFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setSavedMsg('请选择图片文件')
      setTimeout(() => setSavedMsg(''), 2000)
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateAppearance('backgroundImage', String(reader.result || ''))
    }
    reader.readAsDataURL(file)
  }

  const doExport = async () => downloadBackup(await exportBackup())
  const doImport = async (file: File) => {
    const text = await file.text()
    try {
      const r = await importBackup(text)
      setSavedMsg(`导入完成，合并 ${r.added} 条`)
    } catch (e) {
      setSavedMsg(`导入失败：${(e as Error).message}`)
    }
    setTimeout(() => setSavedMsg(''), 3000)
  }

  const importBrowserBookmarks = async () => {
    setImportingBookmarks(true)
    setBookmarkImportReport(null)
    setBookmarkImportMsg('准备导入浏览器书签…')
    try {
      const report = await importExistingBrowserBookmarks(setBookmarkImportMsg)
      setBookmarkImportReport(report)
      setBookmarkImportMsg(
        report.imported
          ? `导入完成：新增 ${report.imported} 条，生成 ${report.sections} 个分类区块`
          : '没有可导入的新书签',
      )
    } catch (e) {
      setBookmarkImportMsg(`导入失败：${(e as Error).message}`)
    } finally {
      setImportingBookmarks(false)
    }
  }

  const statusText: Record<SyncStatus, string> = {
    ok: '已连接，可正常同步',
    unconfigured: '未连接同步目录',
    'permission-needed': '已选目录但需重新授权',
    error: '当前浏览器不支持目录同步',
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-5 p-8">
      <h1 className="text-xl font-medium text-ink">签屿设置</h1>
      {savedMsg && (
        <div className="rounded-lg bg-accent/10 px-4 py-2 text-sm text-accent">
          {savedMsg}
        </div>
      )}

      {/* 云盘目录同步 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">云盘目录同步</h2>
        <p className="mb-4 text-xs text-muted">
          选择一个位于 iCloud Drive / 坚果云 / Dropbox / OneDrive 等云盘内的本地文件夹。
          本机数据会写入该文件夹，由云盘客户端负责同步到其它设备。无中心化服务，
          云盘不可用时本地仍可正常使用。
        </p>
        {!isFileSystemAccessSupported() ? (
          <div className="text-sm text-red-500">
            当前浏览器不支持 File System Access API，无法使用目录同步。请用 Chrome / Edge。
          </div>
        ) : (
          <>
            <div className="mb-3 text-sm">
              状态：<span className="text-ink">{statusText[syncStatus]}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {syncStatus === 'unconfigured' ? (
                <button className={btn} onClick={connectDir}>
                  选择云盘文件夹
                </button>
              ) : (
                <>
                  <button className={btn} onClick={syncNow}>
                    立即同步
                  </button>
                  <button className={btnGhost} onClick={connectDir}>
                    更换文件夹
                  </button>
                  <button className={btnGhost} onClick={disconnectDir}>
                    断开
                  </button>
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">
              本机标识：{deviceId}（写入 device-{deviceId}.json）
            </p>
          </>
        )}
      </section>

      {/* 外观设置 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">外观与背景</h2>
        <p className="mb-4 text-xs text-muted">
          可配置新标签页背景图、显示方式、遮罩强度和区块透明度。图片 URL 最轻量；本地图片会以 data URL 形式保存在本机浏览器数据库。
        </p>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs text-muted">背景图 URL</span>
            <input
              className={input}
              value={appearance.backgroundImage || ''}
              onChange={(e) => updateAppearance('backgroundImage', e.target.value)}
              placeholder="https://example.com/background.jpg"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => bgFileRef.current?.click()}>
              上传本地图片
            </button>
            <button
              className={btnGhost}
              onClick={() => updateAppearance('backgroundImage', '')}
            >
              清除背景图
            </button>
            <input
              ref={bgFileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) useBackgroundFile(f)
                e.target.value = ''
              }}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-xs text-muted">
              显示方式
              <select
                className={`${input} mt-1`}
                value={appearance.backgroundMode}
                onChange={(e) =>
                  updateAppearance('backgroundMode', e.target.value as BackgroundMode)
                }
              >
                <option value="cover">铺满裁切</option>
                <option value="contain">完整显示</option>
                <option value="repeat">平铺</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              背景遮罩 {Math.round(appearance.overlay * 100)}%
              <input
                className="mt-3 w-full accent-[#534ab7]"
                type="range"
                min="0"
                max="0.7"
                step="0.05"
                value={appearance.overlay}
                onChange={(e) => updateAppearance('overlay', Number(e.target.value))}
              />
            </label>
            <label className="text-xs text-muted">
              区块透明度 {Math.round(appearance.panelOpacity * 100)}%
              <input
                className="mt-3 w-full accent-[#534ab7]"
                type="range"
                min="0.65"
                max="1"
                step="0.05"
                value={appearance.panelOpacity}
                onChange={(e) => updateAppearance('panelOpacity', Number(e.target.value))}
              />
            </label>
          </div>
          {appearance.backgroundImage && (
            <div
              className="h-28 rounded-xl border border-line bg-cover bg-center"
              style={{ backgroundImage: `url(${appearance.backgroundImage})` }}
            />
          )}
        </div>
        <div className="mt-4 flex gap-2">
          <button className={btn} onClick={saveAppearance}>
            保存外观
          </button>
          <button className={btnGhost} onClick={resetAppearance}>
            恢复默认
          </button>
        </div>
      </section>

      {/* AI 自动分类 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">AI 自动分类</h2>
        <p className="mb-4 text-xs text-muted">
          填写任意 OpenAI 兼容接口。未启用或调用失败时，自动降级为本地域名/关键词规则分类，
          离线也能用。API Key 会加密后存于本地，不会上传。
        </p>
        <label className="mb-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(e) => setLlmEnabled(e.target.checked)}
          />
          启用 LLM 分类
        </label>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs text-muted">接口地址（base URL）</span>
            <input
              className={input}
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">模型</span>
            <input
              className={input}
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gpt-4o-mini"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">API Key</span>
            <input
              className={input}
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <button className={btn} onClick={saveLLM}>
            保存
          </button>
          <button className={btnGhost} onClick={testLLM}>
            测试连接
          </button>
          {testMsg && <span className="text-xs text-muted">{testMsg}</span>}
        </div>
      </section>

      {/* AI 导入存量书签 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">AI 导入存量书签</h2>
        <p className="mb-4 text-xs text-muted">
          一键读取浏览器现有书签，自动去重、跳过无效/低质量链接，并按 AI 或本地规则分类后导入为新的导航页。建议先在上方启用并保存 LLM 配置；未启用时会使用本地规则分类。
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={btn}
            onClick={importBrowserBookmarks}
            disabled={importingBookmarks}
          >
            {importingBookmarks ? '导入中…' : '导入浏览器书签'}
          </button>
          {bookmarkImportMsg && (
            <span className="text-xs text-muted">{bookmarkImportMsg}</span>
          )}
        </div>
        {bookmarkImportReport && (
          <div className="mt-4 grid gap-2 rounded-lg bg-canvas p-3 text-xs text-muted sm:grid-cols-2">
            <div>扫描书签：{bookmarkImportReport.scanned} 条</div>
            <div>候选书签：{bookmarkImportReport.candidates} 条</div>
            <div>跳过无效：{bookmarkImportReport.skippedInvalid} 条</div>
            <div>跳过重复：{bookmarkImportReport.skippedDuplicate} 条</div>
            <div>已存在跳过：{bookmarkImportReport.skippedExisting} 条</div>
            <div>低质量过滤：{bookmarkImportReport.skippedLowQuality} 条</div>
            <div>新增导入：{bookmarkImportReport.imported} 条</div>
            <div>分类来源：{bookmarkImportReport.source === 'llm' ? 'AI' : bookmarkImportReport.source === 'mixed' ? 'AI + 规则' : '本地规则'}</div>
            {bookmarkImportReport.pageTitle && (
              <div className="sm:col-span-2">新导航页：{bookmarkImportReport.pageTitle}</div>
            )}
          </div>
        )}
      </section>

      {/* 导入导出 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">备份与恢复</h2>
        <p className="mb-4 text-xs text-muted">
          导出全部数据为 JSON 文件；导入时按版本与时间智能合并，不会粗暴覆盖。
        </p>
        <div className="flex gap-2">
          <button className={btn} onClick={doExport}>
            导出 JSON
          </button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>
            导入 JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) doImport(f)
              e.target.value = ''
            }}
          />
        </div>
      </section>
    </div>
  )
}

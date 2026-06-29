import { useEffect, useRef, useState } from 'react'
import { getMeta, updateMeta, updateAppearance as saveAppearanceConfig } from '../data/db'
import {
  DEFAULT_APPEARANCE,
  type AppearanceConfig,
  type BackgroundMode,
  type Locale,
} from '../shared/types'
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
import { APP_NAME_EN, appIconUrl } from '../shared/brand'
import { localeLabel } from '../shared/i18n'
import { useI18n } from '../shared/useI18n'

const card = 'rounded-xl border border-line bg-white p-5'
const input =
  'w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-accent'
const btn = 'rounded-lg bg-accent px-4 py-2 text-sm text-white hover:opacity-90'
const btnGhost = 'rounded-lg bg-canvas px-4 py-2 text-sm text-ink hover:bg-line'

export default function Options() {
  const { locale, setLocale, t } = useI18n()
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

  useEffect(() => {
    document.title = t('appSettings')
  }, [t])

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
    setSavedMsg(s === 'ok' ? t('syncDone') : t('syncFailedStatus'))
    setTimeout(() => setSavedMsg(''), 2000)
  }

  const saveLLM = async () => {
    const cipher = apiKey ? await encryptSecret(apiKey, deviceId) : undefined
    await updateMeta({
      llmConfig: { enabled: llmEnabled, endpoint, model, apiKeyCipher: cipher },
    })
    setSavedMsg(t('saved'))
    setTimeout(() => setSavedMsg(''), 2000)
  }
  const testLLM = async () => {
    setTestMsg(t('testing'))
    const r = await testLLMConnection(endpoint, model, apiKey, locale)
    setTestMsg(r.message)
  }

  const saveAppearance = async () => {
    await saveAppearanceConfig(appearance)
    setSavedMsg(t('appearanceSaved'))
    setTimeout(() => setSavedMsg(''), 2500)
  }
  const resetAppearance = async () => {
    setAppearance(DEFAULT_APPEARANCE)
    await saveAppearanceConfig(DEFAULT_APPEARANCE)
    setSavedMsg(t('appearanceReset'))
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
      setSavedMsg(t('chooseImageFile'))
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
      setSavedMsg(t('importMergeDone', { count: r.added }))
    } catch (e) {
      setSavedMsg(t('importFailed', { message: (e as Error).message }))
    }
    setTimeout(() => setSavedMsg(''), 3000)
  }

  const importBrowserBookmarks = async () => {
    setImportingBookmarks(true)
    setBookmarkImportReport(null)
    setBookmarkImportMsg(t('preparingImport'))
    try {
      const report = await importExistingBrowserBookmarks(setBookmarkImportMsg, locale)
      setBookmarkImportReport(report)
      setBookmarkImportMsg(
        report.imported
          ? t('importDone', { imported: report.imported, sections: report.sections })
          : t('noNewBookmarks'),
      )
    } catch (e) {
      setBookmarkImportMsg(t('importFailed', { message: (e as Error).message }))
    } finally {
      setImportingBookmarks(false)
    }
  }

  const statusText: Record<SyncStatus, string> = {
    ok: t('syncOkLong'),
    unconfigured: t('syncUnconfiguredLong'),
    'permission-needed': t('syncPermissionLong'),
    error: t('syncErrorLong'),
  }

  return (
    <div className="mx-auto max-w-[720px] space-y-5 p-8">
      <div className="flex items-center gap-3">
        <img src={appIconUrl(48)} alt="" className="h-10 w-10 rounded-xl" />
        <div>
          <h1 className="text-xl font-medium text-ink">{t('appSettings')}</h1>
          <p className="text-xs text-muted">{APP_NAME_EN}</p>
        </div>
      </div>
      {savedMsg && (
        <div className="rounded-lg bg-accent/10 px-4 py-2 text-sm text-accent">
          {savedMsg}
        </div>
      )}

      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">{t('language')}</h2>
        <p className="mb-4 text-xs text-muted">{t('languageHelp')}</p>
        <select
          className={input}
          value={locale}
          onChange={(e) => {
            void setLocale(e.target.value as Locale)
            setSavedMsg(t('saved'))
            setTimeout(() => setSavedMsg(''), 2000)
          }}
        >
          {(['zh-CN', 'en'] as Locale[]).map((item) => (
            <option key={item} value={item}>
              {localeLabel(item)}
            </option>
          ))}
        </select>
      </section>

      {/* 云盘目录同步 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">{t('syncSection')}</h2>
        <p className="mb-4 text-xs text-muted">{t('syncDescription')}</p>
        {!isFileSystemAccessSupported() ? (
          <div className="text-sm text-red-500">
            {t('fsUnsupported')}
          </div>
        ) : (
          <>
            <div className="mb-3 text-sm">
              {t('status')}：<span className="text-ink">{statusText[syncStatus]}</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {syncStatus === 'unconfigured' ? (
                <button className={btn} onClick={connectDir}>
                  {t('chooseCloudFolder')}
                </button>
              ) : (
                <>
                  <button className={btn} onClick={syncNow}>
                    {t('syncNow')}
                  </button>
                  <button className={btnGhost} onClick={connectDir}>
                    {t('changeFolder')}
                  </button>
                  <button className={btnGhost} onClick={disconnectDir}>
                    {t('disconnect')}
                  </button>
                </>
              )}
            </div>
            <p className="mt-3 text-xs text-muted">
              {t('deviceId', { deviceId })}
            </p>
          </>
        )}
      </section>

      {/* 外观设置 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">{t('appearanceSection')}</h2>
        <p className="mb-4 text-xs text-muted">{t('appearanceDescription')}</p>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs text-muted">{t('backgroundUrl')}</span>
            <input
              className={input}
              value={appearance.backgroundImage || ''}
              onChange={(e) => updateAppearance('backgroundImage', e.target.value)}
              placeholder="https://example.com/background.jpg"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button className={btnGhost} onClick={() => bgFileRef.current?.click()}>
              {t('uploadLocalImage')}
            </button>
            <button
              className={btnGhost}
              onClick={() => updateAppearance('backgroundImage', '')}
            >
              {t('clearBackground')}
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
              {t('backgroundMode')}
              <select
                className={`${input} mt-1`}
                value={appearance.backgroundMode}
                onChange={(e) =>
                  updateAppearance('backgroundMode', e.target.value as BackgroundMode)
                }
              >
                <option value="cover">{t('cover')}</option>
                <option value="contain">{t('contain')}</option>
                <option value="repeat">{t('repeat')}</option>
              </select>
            </label>
            <label className="text-xs text-muted">
              {t('overlay', { value: Math.round(appearance.overlay * 100) })}
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
              {t('panelOpacity', { value: Math.round(appearance.panelOpacity * 100) })}
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
            {t('saveAppearance')}
          </button>
          <button className={btnGhost} onClick={resetAppearance}>
            {t('restoreDefault')}
          </button>
        </div>
      </section>

      {/* AI 自动分类 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">{t('aiClassification')}</h2>
        <p className="mb-4 text-xs text-muted">{t('aiDescription')}</p>
        <label className="mb-3 flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={llmEnabled}
            onChange={(e) => setLlmEnabled(e.target.checked)}
          />
          {t('enableLlm')}
        </label>
        <div className="space-y-3">
          <div>
            <span className="mb-1 block text-xs text-muted">{t('endpoint')}</span>
            <input
              className={input}
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <div>
            <span className="mb-1 block text-xs text-muted">{t('model')}</span>
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
            {t('save')}
          </button>
          <button className={btnGhost} onClick={testLLM}>
            {t('testConnection')}
          </button>
          {testMsg && <span className="text-xs text-muted">{testMsg}</span>}
        </div>
      </section>

      {/* AI 导入存量书签 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">{t('aiImport')}</h2>
        <p className="mb-4 text-xs text-muted">{t('aiImportDescription')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className={btn}
            onClick={importBrowserBookmarks}
            disabled={importingBookmarks}
          >
            {importingBookmarks ? t('importing') : t('importBrowserBookmarks')}
          </button>
          {bookmarkImportMsg && (
            <span className="text-xs text-muted">{bookmarkImportMsg}</span>
          )}
        </div>
        {bookmarkImportReport && (
          <div className="mt-4 grid gap-2 rounded-lg bg-canvas p-3 text-xs text-muted sm:grid-cols-2">
            <div>{t('scannedBookmarks', { count: bookmarkImportReport.scanned })}</div>
            <div>{t('candidateBookmarks', { count: bookmarkImportReport.candidates })}</div>
            <div>{t('skippedInvalid', { count: bookmarkImportReport.skippedInvalid })}</div>
            <div>{t('skippedDuplicate', { count: bookmarkImportReport.skippedDuplicate })}</div>
            <div>{t('skippedExisting', { count: bookmarkImportReport.skippedExisting })}</div>
            <div>{t('skippedLowQuality', { count: bookmarkImportReport.skippedLowQuality })}</div>
            <div>{t('importedCount', { count: bookmarkImportReport.imported })}</div>
            <div>{t('categorySource', { source: bookmarkImportReport.source === 'llm' ? 'AI' : bookmarkImportReport.source === 'mixed' ? 'AI + Rules' : t('localRules') })}</div>
            {bookmarkImportReport.pageTitle && (
              <div className="sm:col-span-2">{t('newImportedPage', { title: bookmarkImportReport.pageTitle })}</div>
            )}
          </div>
        )}
      </section>

      {/* 导入导出 */}
      <section className={card}>
        <h2 className="mb-1 text-base font-medium text-ink">{t('backupRestore')}</h2>
        <p className="mb-4 text-xs text-muted">{t('backupDescription')}</p>
        <div className="flex gap-2">
          <button className={btn} onClick={doExport}>
            {t('exportJson')}
          </button>
          <button className={btnGhost} onClick={() => fileRef.current?.click()}>
            {t('importJson')}
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

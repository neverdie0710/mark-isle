import type { NavPage } from '../../shared/types'
import type { SyncStatus } from '../../data/fileSync'
import { APP_NAME, APP_NAME_EN, appIconUrl } from '../../shared/brand'
import { useI18n } from '../../shared/useI18n'

interface Props {
  pages: NavPage[]
  activePageId: string | null
  search: string
  syncStatus: SyncStatus
  onSelectPage: (id: string) => void
  onAddPage: () => void
  onRenamePage: (id: string) => void
  onDeletePage: (id: string) => void
  onSearch: (q: string) => void
  onAddSection: () => void
  onSyncClick: () => void
  onOpenOptions: () => void
}

const SYNC_CLASS: Record<SyncStatus, string> = {
  ok: 'bg-emerald-500/90 text-white',
  unconfigured: 'bg-black/25 text-white',
  'permission-needed': 'bg-amber-500/90 text-white',
  error: 'bg-red-500/90 text-white',
}

const SYNC_KEY: Record<SyncStatus, 'synced' | 'unsynced' | 'permissionNeeded' | 'unavailable'> = {
  ok: 'synced',
  unconfigured: 'unsynced',
  'permission-needed': 'permissionNeeded',
  error: 'unavailable',
}

export function Toolbar({
  pages,
  activePageId,
  search,
  syncStatus,
  onSelectPage,
  onAddPage,
  onRenamePage,
  onDeletePage,
  onSearch,
  onAddSection,
  onSyncClick,
  onOpenOptions,
}: Props) {
  const { t } = useI18n()
  return (
    <header className="sticky top-0 z-30 px-3 py-2 text-white">
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(260px,520px)_minmax(0,1fr)] items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex shrink-0 items-center gap-2 rounded-xl bg-black/30 px-3 py-1.5 text-sm font-medium backdrop-blur">
            <img src={appIconUrl(48)} alt="" className="h-5 w-5 rounded-md" />
            <span className="hidden sm:inline">{APP_NAME}</span>
            <span className="sr-only">{APP_NAME_EN}</span>
          </span>
          <div className="flex min-w-0 items-center gap-1 overflow-x-auto">
            {pages.map((p) => (
              <button
                key={p.id}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm backdrop-blur ${
                  p.id === activePageId
                    ? 'bg-white text-ink shadow-sm'
                    : 'bg-black/20 text-white hover:bg-black/30'
                }`}
                onClick={() => onSelectPage(p.id)}
                onDoubleClick={() => onRenamePage(p.id)}
                title={t('doubleClickRename')}
              >
                {p.title}
              </button>
            ))}
            <button
              className="shrink-0 rounded-full bg-black/25 px-2.5 py-1.5 text-sm text-white backdrop-blur hover:bg-black/35"
              onClick={onAddPage}
              title={t('newPage')}
            >
              +
            </button>
            {activePageId && pages.length > 1 && (
              <button
                className="shrink-0 rounded-lg bg-black/20 px-2 py-1.5 text-xs text-white/75 backdrop-blur hover:bg-red-500/80 hover:text-white"
                onClick={() => onDeletePage(activePageId)}
                title={t('deleteCurrentPage')}
              >
                {t('deletePage')}
              </button>
            )}
          </div>
        </div>

        <label className="mx-auto flex w-full items-center gap-2 rounded-2xl bg-white/95 px-4 py-2.5 text-ink shadow-lg shadow-black/10 backdrop-blur">
          <span className="text-sm">⌕</span>
          <input
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => onSearch(e.target.value)}
          />
        </label>

        <div className="flex min-w-0 justify-end gap-2">
          <button
            className="rounded-full bg-black/25 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/35"
            onClick={onAddSection}
            title={t('addSectionTitle')}
          >
            {t('addSection')}
          </button>
          <button
            className={`rounded-full px-3 py-1.5 text-xs backdrop-blur ${SYNC_CLASS[syncStatus]}`}
            onClick={onSyncClick}
            title={t('syncTitle')}
          >
            ● {t(SYNC_KEY[syncStatus])}
          </button>
          <button
            className="rounded-full bg-black/25 px-3 py-1.5 text-sm text-white backdrop-blur hover:bg-black/35"
            onClick={onOpenOptions}
            title={t('settingsTitle')}
          >
            {t('settings')}
          </button>
        </div>
      </div>
    </header>
  )
}

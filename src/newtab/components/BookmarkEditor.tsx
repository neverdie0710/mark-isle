import { useEffect, useState } from 'react'
import type { Bookmark, UploadedIcon } from '../../shared/types'
import { Modal, Field, inputCls, btnPrimary, btnGhost } from './Modal'
import { faviconUrl, normalizeUrl, titleFromUrl } from '../../shared/favicon'

interface Props {
  open: boolean
  /** 传入已有书签为编辑模式，否则为新建 */
  bookmark: Bookmark | null
  uploadedIcons: UploadedIcon[]
  onClose: () => void
  onUploadIcon: (data: {
    name: string
    dataUrl: string
    mimeType: string
  }) => Promise<UploadedIcon>
  onDeleteUploadedIcon: (id: string) => Promise<void>
  onSave: (data: { title: string; url: string; note?: string; icon?: string }) => void
}

const MAX_ICON_FILE_SIZE = 2 * 1024 * 1024
const ICON_SIZE = 64

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('读取图标失败'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('无法解析图片'))
    img.src = src
  })
}

async function resizeIconFile(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) throw new Error('请选择图片文件')
  if (file.size > MAX_ICON_FILE_SIZE) throw new Error('图标文件不能超过 2MB')

  const source = await fileToDataUrl(file)
  const img = await loadImage(source)
  const canvas = document.createElement('canvas')
  canvas.width = ICON_SIZE
  canvas.height = ICON_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器无法处理图片')

  const w = img.naturalWidth || ICON_SIZE
  const h = img.naturalHeight || ICON_SIZE
  const scale = Math.min(ICON_SIZE / w, ICON_SIZE / h)
  const dw = Math.max(1, Math.round(w * scale))
  const dh = Math.max(1, Math.round(h * scale))
  const dx = Math.round((ICON_SIZE - dw) / 2)
  const dy = Math.round((ICON_SIZE - dh) / 2)
  ctx.clearRect(0, 0, ICON_SIZE, ICON_SIZE)
  ctx.drawImage(img, dx, dy, dw, dh)
  return canvas.toDataURL('image/png')
}

function iconNameFromFile(file: File): string {
  return file.name.replace(/\.[^.]+$/, '').trim() || '自定义图标'
}

export function BookmarkEditor({
  open,
  bookmark,
  uploadedIcons,
  onClose,
  onUploadIcon,
  onDeleteUploadedIcon,
  onSave,
}: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [icon, setIcon] = useState('')
  const [uploading, setUploading] = useState(false)
  const [iconError, setIconError] = useState('')

  useEffect(() => {
    if (open) {
      setUrl(bookmark?.url ?? '')
      setTitle(bookmark?.title ?? '')
      setNote(bookmark?.note ?? '')
      setIcon(bookmark?.icon ?? '')
      setIconError('')
      setUploading(false)
    }
  }, [open, bookmark])

  const submit = () => {
    const finalUrl = normalizeUrl(url)
    if (!finalUrl) return
    onSave({
      url: finalUrl,
      title: title.trim() || titleFromUrl(finalUrl),
      note: note.trim() || undefined,
      icon: icon.trim() || undefined,
    })
  }

  const uploadIcon = async (file: File | undefined) => {
    if (!file) return
    setIconError('')
    setUploading(true)
    try {
      const dataUrl = await resizeIconFile(file)
      const saved = await onUploadIcon({
        name: iconNameFromFile(file),
        dataUrl,
        mimeType: 'image/png',
      })
      setIcon(saved.dataUrl)
    } catch (e) {
      setIconError(e instanceof Error ? e.message : '上传图标失败')
    } finally {
      setUploading(false)
    }
  }

  const previewIcon = icon.trim() || (url.trim() ? faviconUrl(normalizeUrl(url)) : '')

  return (
    <Modal
      open={open}
      title={bookmark ? '编辑书签' : '添加书签'}
      onClose={onClose}
      footer={
        <>
          <button className={btnGhost} onClick={onClose}>
            取消
          </button>
          <button className={btnPrimary} onClick={submit}>
            保存
          </button>
        </>
      }
    >
      <Field label="网址">
        <input
          className={inputCls}
          value={url}
          autoFocus
          placeholder="https://example.com"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
      </Field>
      <Field label="标题">
        <input
          className={inputCls}
          value={title}
          placeholder="留空则自动取域名"
          onChange={(e) => setTitle(e.target.value)}
        />
      </Field>
      <Field label="备注（可选）">
        <input
          className={inputCls}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </Field>
      <Field label="图标（可选）">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-line bg-canvas">
            {previewIcon ? (
              <img
                src={previewIcon}
                alt=""
                className="h-8 w-8 rounded"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).style.visibility = 'hidden'
                }}
                onLoad={(e) => {
                  ;(e.target as HTMLImageElement).style.visibility = 'visible'
                }}
              />
            ) : (
              <span className="text-xs text-muted">图标</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <input
              className={inputCls}
              value={icon}
              placeholder="留空则自动抓取 favicon"
              onChange={(e) => setIcon(e.target.value)}
            />
          </div>
        </div>
      </Field>

      <div className="flex flex-wrap items-center gap-2">
        <button className={btnGhost} type="button" onClick={() => setIcon('')}>
          自动 favicon
        </button>
        <label className={`${btnGhost} cursor-pointer`}>
          {uploading ? '处理中…' : '上传图标'}
          <input
            className="hidden"
            type="file"
            accept="image/*"
            onChange={(e) => {
              void uploadIcon(e.target.files?.[0])
              e.currentTarget.value = ''
            }}
          />
        </label>
        {iconError && <span className="text-xs text-red-500">{iconError}</span>}
      </div>

      {uploadedIcons.length > 0 && (
        <div>
          <div className="mb-1 text-xs text-muted">已上传图标</div>
          <div className="grid max-h-28 grid-cols-8 gap-1.5 overflow-y-auto rounded-lg border border-line bg-canvas p-2">
            {uploadedIcons.map((item) => (
              <div key={item.id} className="group relative">
                <button
                  type="button"
                  className={`flex h-8 w-8 items-center justify-center rounded-md border bg-white hover:border-accent ${
                    icon === item.dataUrl ? 'border-accent' : 'border-line'
                  }`}
                  title={item.name}
                  onClick={() => setIcon(item.dataUrl)}
                >
                  <img src={item.dataUrl} alt="" className="h-5 w-5 rounded-sm" />
                </button>
                <button
                  type="button"
                  className="absolute -right-1 -top-1 hidden h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] leading-none text-white group-hover:flex"
                  title="删除上传图标"
                  onClick={() => {
                    if (icon === item.dataUrl) setIcon('')
                    void onDeleteUploadedIcon(item.id)
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  )
}

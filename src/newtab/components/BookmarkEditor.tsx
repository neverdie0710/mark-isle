import { useEffect, useState } from 'react'
import type { Bookmark } from '../../shared/types'
import { Modal, Field, inputCls, btnPrimary, btnGhost } from './Modal'
import { normalizeUrl, titleFromUrl } from '../../shared/favicon'

interface Props {
  open: boolean
  /** 传入已有书签为编辑模式，否则为新建 */
  bookmark: Bookmark | null
  onClose: () => void
  onSave: (data: { title: string; url: string; note?: string; icon?: string }) => void
}

export function BookmarkEditor({ open, bookmark, onClose, onSave }: Props) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [icon, setIcon] = useState('')

  useEffect(() => {
    if (open) {
      setUrl(bookmark?.url ?? '')
      setTitle(bookmark?.title ?? '')
      setNote(bookmark?.note ?? '')
      setIcon(bookmark?.icon ?? '')
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
      <Field label="自定义图标 URL（可选）">
        <input
          className={inputCls}
          value={icon}
          placeholder="留空则自动抓取 favicon"
          onChange={(e) => setIcon(e.target.value)}
        />
      </Field>
    </Modal>
  )
}

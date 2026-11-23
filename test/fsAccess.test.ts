import { describe, expect, it } from 'vitest'
import {
  FsTimeoutError,
  MAX_SYNCED_DATA_URL,
  permissionAllowsUse,
  snapshotForDisk,
  withTimeout,
} from '../src/data/fsAccess'
import type { DeviceSnapshot } from '../src/shared/types'

function snapshot(backgroundImage: string): DeviceSnapshot {
  return {
    deviceId: 'Mac-test',
    deviceLabel: 'Mac',
    exportedAt: 1,
    appearance: {
      id: 'appearance',
      config: {
        backgroundImage,
        backgroundMode: 'cover',
        overlay: 0.18,
        panelOpacity: 0.88,
      },
      updatedAt: 1,
      lamport: 1,
      modifiedBy: 'Mac-test',
      version: 1,
      deleted: false,
    },
    navPages: [],
    sections: [],
    bookmarks: [],
    categories: [],
  }
}

describe('withTimeout', () => {
  it('returns the value when the operation finishes in time', async () => {
    await expect(withTimeout(Promise.resolve('ok'), 50)).resolves.toBe('ok')
  })

  it('stops waiting when the operation never settles', async () => {
    await expect(withTimeout(new Promise(() => {}), 20, 'queryPermission')).rejects.toBeInstanceOf(
      FsTimeoutError,
    )
  })
})

describe('permissionAllowsUse', () => {
  it('does not touch a folder whose permission query never returns', () => {
    expect(permissionAllowsUse('granted')).toBe(true)
    expect(permissionAllowsUse('unresponsive')).toBe(false)
    expect(permissionAllowsUse('prompt')).toBe(false)
    expect(permissionAllowsUse('denied')).toBe(false)
  })
})

describe('snapshotForDisk', () => {
  it('leaves ordinary backgrounds in the cloud snapshot', () => {
    const source = snapshot('https://example.com/bg.jpg')
    expect(snapshotForDisk(source)).toBe(source)
  })

  it('drops oversized data URLs so the cloud file stays small', () => {
    const source = snapshot(`data:image/jpeg;base64,${'a'.repeat(MAX_SYNCED_DATA_URL + 1)}`)
    expect(snapshotForDisk(source).appearance?.config.backgroundImage).toBe('')
    expect(source.appearance?.config.backgroundImage?.startsWith('data:')).toBe(true)
  })
})

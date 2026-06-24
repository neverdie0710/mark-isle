import { describe, it, expect } from 'vitest'
import { pickNewer, mergeWithLocal } from '../src/data/merge'
import type { Bookmark } from '../src/shared/types'

function bm(
  id: string,
  updatedAt: number,
  lamport: number,
  modifiedBy = 'devA',
  deleted = false,
): Bookmark {
  return {
    id,
    sectionId: 's1',
    title: id,
    url: `https://${id}.com`,
    order: 0,
    updatedAt,
    lamport,
    modifiedBy,
    version: 1,
    deleted,
  }
}

describe('pickNewer — LWW + Lamport', () => {
  it('updatedAt 大者胜（谁后改谁赢）', () => {
    expect(pickNewer(bm('a', 100, 9), bm('a', 200, 1)).updatedAt).toBe(200)
  })

  it('关键场景：改得多但更早的，输给改得少但更晚的', () => {
    // 旧 version 策略会让“改 5 次”的赢；新策略按时间，应该是更晚的赢
    const editedMoreButEarlier = bm('a', 100, 5, 'PC')
    const editedOnceButLater = bm('a', 200, 1, 'Mac')
    expect(pickNewer(editedMoreButEarlier, editedOnceButLater).modifiedBy).toBe('Mac')
  })

  it('updatedAt 相同 → lamport 大者胜（同毫秒/时钟回拨）', () => {
    expect(pickNewer(bm('a', 100, 3), bm('a', 100, 8)).lamport).toBe(8)
  })

  it('updatedAt+lamport 都相同 → modifiedBy 决定，保证确定性', () => {
    const r1 = pickNewer(bm('a', 100, 3, 'PC'), bm('a', 100, 3, 'Mac'))
    const r2 = pickNewer(bm('a', 100, 3, 'Mac'), bm('a', 100, 3, 'PC'))
    expect(r1.modifiedBy).toBe(r2.modifiedBy) // 与传入顺序无关
    expect(r1.modifiedBy).toBe('PC') // 字典序大者
  })

  it('删除（更晚的时间戳）能覆盖旧记录 —— 删除传播', () => {
    const local = bm('a', 100, 1, 'PC', false)
    const remoteDeleted = bm('a', 200, 2, 'Mac', true)
    expect(pickNewer(local, remoteDeleted).deleted).toBe(true)
  })

  it('但旧的删除不会覆盖更晚的恢复/编辑', () => {
    const oldDelete = bm('a', 100, 1, 'PC', true)
    const laterEdit = bm('a', 200, 2, 'Mac', false)
    expect(pickNewer(oldDelete, laterEdit).deleted).toBe(false)
  })
})

describe('mergeWithLocal', () => {
  it('合并新增远端记录', () => {
    const local = [bm('a', 100, 1)]
    const remote = [bm('a', 100, 1), bm('b', 120, 2)]
    const { merged, changed } = mergeWithLocal(local, [remote])
    expect(merged.map((m) => m.id).sort()).toEqual(['a', 'b'])
    expect(changed.map((c) => c.id)).toEqual(['b'])
  })

  it('远端更晚的改动覆盖本地，并进入 changed', () => {
    const local = [bm('a', 100, 1, 'PC')]
    const remote = [{ ...bm('a', 300, 2, 'Mac'), title: 'updated' }]
    const { changed } = mergeWithLocal(local, [remote])
    expect(changed).toHaveLength(1)
    expect(changed[0].title).toBe('updated')
  })

  it('本地更晚时不被旧远端覆盖', () => {
    const local = [bm('a', 500, 9, 'PC')]
    const remote = [bm('a', 200, 2, 'Mac')]
    const { merged, changed } = mergeWithLocal(local, [remote])
    expect(merged[0].updatedAt).toBe(500)
    expect(changed).toHaveLength(0)
  })

  it('多设备合并取全局最新', () => {
    const local = [bm('a', 100, 1, 'PC')]
    const dev2 = [bm('a', 200, 2, 'Mac')]
    const dev3 = [bm('a', 400, 3, 'Linux')]
    const { merged } = mergeWithLocal(local, [dev2, dev3])
    expect(merged[0].updatedAt).toBe(400)
    expect(merged[0].modifiedBy).toBe('Linux')
  })

  it('合并收敛性：不同处理顺序得到相同结果', () => {
    const a = bm('x', 100, 1, 'PC')
    const b = bm('x', 100, 1, 'Mac')
    const c = bm('x', 100, 2, 'Linux')
    const r1 = mergeWithLocal([a], [[b], [c]]).merged[0]
    const r2 = mergeWithLocal([c], [[a], [b]]).merged[0]
    expect(r1.modifiedBy).toBe(r2.modifiedBy)
    expect(r1.lamport).toBe(r2.lamport)
  })

  it('maxLamport 反映合并中见过的最大逻辑时钟', () => {
    const local = [bm('a', 100, 3)]
    const remote = [bm('b', 100, 7)]
    const { maxLamport } = mergeWithLocal(local, [remote])
    expect(maxLamport).toBe(7)
  })
})

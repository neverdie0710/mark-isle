import type { SyncFields } from '../shared/types'

type Entity = SyncFields & { id: string }

/**
 * 跨设备冲突解决（LWW + Lamport 逻辑时钟）。
 *
 * 为什么不用 version？version 是每台设备各自从 0 自增的本地计数，跨设备不可比：
 * 设备 A 改 5 次(version=5)、设备 B 改 1 次(version=1) 但改得更晚，
 * 若按 version 高者胜会错误丢掉 B 更晚的改动。
 *
 * 因此跨设备一律按下面三级判据，保证「谁后改谁赢」且所有设备收敛到同一结果：
 *   1) updatedAt 大者胜          —— 物理时间戳，符合直觉
 *   2) updatedAt 相同 → lamport 大者胜  —— 逻辑时钟，解决同毫秒/时钟回拨
 *   3) 仍相同 → modifiedBy 字典序大者胜 —— 最终 tiebreaker，保证确定性
 */
export function pickNewer<T extends Entity>(a: T, b: T): T {
  if (a.updatedAt !== b.updatedAt) return a.updatedAt > b.updatedAt ? a : b
  if (a.lamport !== b.lamport) return a.lamport > b.lamport ? a : b
  if (a.modifiedBy !== b.modifiedBy) return a.modifiedBy > b.modifiedBy ? a : b
  return a // 完全等价，任取（结果一致）
}

/** 合并多个来源（本地 + 各设备文件）的同类实体集合，返回 id -> 胜出实体 */
export function mergeEntities<T extends Entity>(sources: T[][]): Map<string, T> {
  const map = new Map<string, T>()
  for (const list of sources) {
    for (const item of list) {
      const cur = map.get(item.id)
      map.set(item.id, cur ? pickNewer(cur, item) : item)
    }
  }
  return map
}

/** 合并结果转数组（含已软删记录，软删记录仍需保留以便继续向其它设备传播） */
export function toArray<T extends Entity>(map: Map<string, T>): T[] {
  return [...map.values()]
}

export interface MergeResult<T extends Entity> {
  merged: T[]
  /** 相对本地发生变化、需要写回本地库的记录 */
  changed: T[]
  /** 合并过程中见到的最大 lamport，用于推进本机逻辑时钟 */
  maxLamport: number
}

/** 把远端各设备数据并入本地，计算需要写回本地的差异 */
export function mergeWithLocal<T extends Entity>(
  local: T[],
  remotes: T[][],
): MergeResult<T> {
  const localMap = new Map(local.map((e) => [e.id, e]))
  const map = mergeEntities([local, ...remotes])
  const merged = toArray(map)
  const changed: T[] = []
  let maxLamport = 0
  for (const item of merged) {
    if (item.lamport > maxLamport) maxLamport = item.lamport
    const prev = localMap.get(item.id)
    // 胜出者不是本地原记录 → 需要写回本地
    if (!prev || pickNewer(prev, item) !== prev) changed.push(item)
  }
  return { merged, changed, maxLamport }
}

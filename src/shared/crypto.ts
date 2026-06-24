/**
 * 用 Web Crypto 对 API Key 做对称加密后再存 IndexedDB，避免明文落盘。
 * 密钥由固定盐 + 设备 id 派生（非高安全级别，仅防明文泄露）。
 */
const enc = new TextEncoder()
const dec = new TextDecoder()

async function deriveKey(deviceId: string): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    enc.encode(`bookmark-nav::${deviceId}`),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('bn-static-salt-v1'),
      iterations: 100_000,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptSecret(plain: string, deviceId: string): Promise<string> {
  if (!plain) return ''
  const key = await deriveKey(deviceId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plain),
  )
  const out = new Uint8Array(iv.length + cipher.byteLength)
  out.set(iv, 0)
  out.set(new Uint8Array(cipher), iv.length)
  return btoa(String.fromCharCode(...out))
}

export async function decryptSecret(cipherB64: string, deviceId: string): Promise<string> {
  if (!cipherB64) return ''
  try {
    const raw = Uint8Array.from(atob(cipherB64), (c) => c.charCodeAt(0))
    const iv = raw.slice(0, 12)
    const data = raw.slice(12)
    const key = await deriveKey(deviceId)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return dec.decode(plain)
  } catch {
    return ''
  }
}

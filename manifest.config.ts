import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: '签屿 · Mark Isle',
  version: '0.1.0',
  description: 'Local-first 书签管理新标签页：云盘目录同步，AI 自动分类',
  icons: {
    16: 'public/icons/icon16.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: '收藏当前页到签屿',
    default_icon: {
      16: 'public/icons/icon16.png',
      48: 'public/icons/icon48.png',
    },
  },
  chrome_url_overrides: {
    newtab: 'src/newtab/index.html',
  },
  options_page: 'src/options/index.html',
  background: {
    service_worker: 'src/background/index.ts',
    type: 'module',
  },
  permissions: ['tabs', 'contextMenus', 'storage', 'bookmarks'],
  commands: {
    'save-current-tab': {
      suggested_key: { default: 'Ctrl+Shift+S', mac: 'Command+Shift+S' },
      description: '收藏当前标签页',
    },
  },
})

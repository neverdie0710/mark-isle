import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  default_locale: 'en',
  name: '__MSG_extName__',
  version: '0.1.1',
  description: '__MSG_extDescription__',
  icons: {
    16: 'public/icons/icon16.png',
    48: 'public/icons/icon48.png',
    128: 'public/icons/icon128.png',
  },
  action: {
    default_popup: 'src/popup/index.html',
    default_title: '__MSG_actionTitle__',
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
  permissions: ['tabs', 'contextMenus', 'bookmarks'],
  commands: {
    'save-current-tab': {
      suggested_key: { default: 'Ctrl+Shift+S', mac: 'Command+Shift+S' },
      description: '__MSG_commandSaveCurrentTab__',
    },
  },
})

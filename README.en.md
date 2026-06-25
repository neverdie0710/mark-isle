# Mark Isle

[简体中文](README.md) | English

<img src="public/icons/icon128.png" alt="Mark Isle Logo" width="96" height="96">

> A local-first **Chrome bookmark manager and new tab dashboard** for organizing links, syncing through your own cloud folder, using sticky-note style sections, and classifying bookmarks with optional AI.

[Download latest release](https://github.com/neverdie0710/mark-isle/releases/latest) · [Chrome Web Store release notes](docs/chrome-web-store-release.md)

**Mark Isle** is a **local-first** Chrome bookmark manager and new tab dashboard. It replaces the new tab page with a customizable navigation board, keeps data local-first, syncs across devices through a user-owned cloud folder, and optionally uses an OpenAI-compatible LLM for bookmark classification.

## Overview

Mark Isle is built for personal knowledge entry points and everyday productivity. It turns the Chrome new tab page into a draggable, section-based, multi-page bookmark dashboard where frequently used sites, work links, learning resources, and temporary saves can live in one local-first workspace.

The project focuses on three problems: messy bookmark organization, opaque multi-device sync, and heavy reliance on third-party services. Mark Isle stores data in browser IndexedDB, writes device snapshots to a cloud folder selected by the user through the File System Access API, and lets iCloud Drive, Dropbox, OneDrive, or other sync clients move those files across devices. There is no centralized backend, and the extension remains usable offline. For imported or newly saved bookmarks, Mark Isle can call an OpenAI-compatible endpoint for AI classification, with local rule-based classification as a fallback.

## Keywords

Chrome extension, bookmark manager, new tab dashboard, start page, bookmark sync, cloud sync, local-first, offline-first, File System Access API, AI bookmark classification, browser extension, productivity tool, personal knowledge management.

## Who It Is For

- People who want to turn Chrome's new tab page into a personal navigation dashboard.
- People who want bookmark sync through iCloud Drive, Dropbox, OneDrive, or another cloud folder without depending on a centralized server.
- People who want AI-assisted bookmark classification while keeping local control of their data.

## Features

- **Offline-first**: Data is stored in browser IndexedDB as the source of truth, so network issues or cloud sync failures do not block searching or editing.
- **Navigation board**: Multiple pages -> sections per page -> bookmark cards per section. Supports custom titles, logos, colors, notes, drag sorting, and cross-section moves.
- **Cloud-folder sync without a central server**: Uses the File System Access API to write JSON snapshots into a local cloud-sync folder. Each device writes its own `device-<id>.json`, then merges snapshots locally.
- **Quick save**: Save the current page from the toolbar popup, context menu, or keyboard shortcut (`Command+Shift+S` / `Ctrl+Shift+S`).
- **AI classification**: Configure any OpenAI-compatible endpoint and API key. New bookmarks can be categorized automatically; when AI is unavailable, local domain and keyword rules keep the app usable.
- **Backup and restore**: Export/import JSON backups and merge by version and update time.

## Tech Stack

React 18 + Vite + TypeScript + Tailwind, Dexie(IndexedDB), dnd-kit, Zustand, Manifest V3(CRXJS).

## Development

```bash
npm install
npm run dev      # development mode with HMR
npm run build    # build dist/
npm run test     # run merge tests
```

## Load In Chrome

1. Run `npm run build` to generate `dist/`.
2. Open `chrome://extensions` in Chrome and enable Developer mode.
3. Choose "Load unpacked" and select the `dist/` directory.
4. Open a new tab to use Mark Isle.

## Configure Cloud Sync

1. Open the options page and choose a cloud folder.
2. Select a folder inside a local cloud-sync directory, for example:
   - iCloud: `~/Library/Mobile Documents/com~apple~CloudDocs/Mark Isle`
   - Dropbox / OneDrive: any folder under the corresponding local sync directory
3. Install the extension on other devices and point them to the same cloud folder.
4. Data is written to the `mark-isle/` subdirectory.

> Note: Browser extension sandboxing prevents fully silent background directory sync. Sync is triggered when the new tab page or options page is opened.

## Data And Privacy

- Bookmark data is stored only in local IndexedDB and the cloud folder you choose. There is no third-party backend.
- The LLM API key is encrypted with Web Crypto before being stored locally and is only sent to the endpoint you configure.

## Project Structure

```text
mark-isle/
├─ manifest.config.ts     # MV3 manifest
├─ src/
│  ├─ newtab/             # new tab dashboard
│  ├─ popup/              # toolbar quick save
│  ├─ options/            # cloud sync / LLM / import-export settings
│  ├─ background/         # service worker: context menu / shortcut save
│  ├─ data/               # db / repository / fileSync / merge / backup
│  ├─ ai/                 # classifier(LLM) / ruleFallback(local rules)
│  ├─ store/              # Zustand
│  └─ shared/             # types / id / favicon / crypto
└─ test/                  # merge tests
```

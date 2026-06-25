# Chrome Web Store 发布资料：签屿 · Mark Isle

更新时间：2026-06-24

本文件按 Chrome Web Store Developer Dashboard 的发布顺序整理。可直接复制其中的字段到官方后台。

## 0. 当前发布包

- 扩展名：签屿 · Mark Isle
- 版本号：0.1.0
- Manifest：MV3
- 已生成上传包：`release/mark-isle-0.1.0-chrome-web-store.zip`
- 包大小：约 436 KB
- ZIP 内容根目录包含 `manifest.json`，可直接上传。
- 已验证：
  - `npm test`：通过，12 tests passed
  - `npm run build`：通过
  - `dist/manifest.json` 权限：`tabs`, `contextMenus`, `bookmarks`

本次发布前修复：

- 移除了 `src/data/fileSync.ts` 中未落地的 `uploadedIcons` 同步引用。项目没有对应类型、Dexie 表或 UI 功能，该引用会导致 TypeScript 构建失败。
- 从 `manifest.config.ts` 移除了未使用的 `storage` 权限，降低审核权限面。

## 1. 官方发布流程

1. 登录 Chrome Developer Dashboard：<https://chrome.google.com/webstore/devconsole>
2. 如果是第一次发布，先注册/设置开发者账号。官方发布文档要求注册并配置开发者账号后才能上传项目；上传入口是 Dashboard 的 `Add new item`。
3. 上传 `release/mark-isle-0.1.0-chrome-web-store.zip`。
4. 填写 `Store listing`：
   - 名称、简短描述、详细描述、分类、语言、图标、截图、宣传图。
5. 填写 `Privacy practices`：
   - 单一用途说明。
   - 每个 manifest 权限的用途说明。
   - 远程代码声明。
   - 数据收集/使用声明。
   - 隐私政策 URL。
6. 填写 `Distribution`：
   - 可见性：首次建议 `Unlisted` 或 `Public`。如果想先小范围测试，用 `Trusted testers`。
   - 地区：默认全地区，或按你的目标市场选择。
7. 填写 `Test instructions`：
   - 本插件无需账号；可提供下面的审核测试步骤。
8. 点击 `Submit for Review`。
9. 如希望审核通过后手动发布，提交时选择 deferred publishing；官方文档说明审核完成后最多有 30 天手动发布窗口。

参考：

- 发布流程：<https://developer.chrome.com/docs/webstore/publish>
- 隐私字段：<https://developer.chrome.com/docs/webstore/cws-dashboard-privacy>
- 测试说明：<https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions>
- 图片规范：<https://developer.chrome.com/docs/webstore/images>

## 2. Store Listing 可复制资料

### 名称

签屿 · Mark Isle

### 简短描述

本地优先的 Chrome 书签管理与新标签页导航扩展，支持云盘目录同步和可选 AI 自动分类。

### 详细描述

签屿 · Mark Isle 是一个本地优先的书签管理与新标签页导航扩展。它把 Chrome 新标签页变成可自定义的导航看板，让常用网站、工作链接、学习资料和临时收藏都能按导航页、区域和卡片整理。

核心能力：

- 新标签页导航看板：支持多导航页、多区域、书签卡片、备注、图标、搜索、拖拽排序和跨区域移动。
- 快速收藏：可通过工具栏弹窗、右键菜单或快捷键收藏当前网页。
- 浏览器书签导入：可读取 Chrome 现有书签，清洗重复/无效链接，并导入到签屿的新导航页。
- 本地优先：书签、分类和布局数据保存在浏览器 IndexedDB 中，无需登录账号，离线也可使用。
- 云盘目录同步：用户可选择 iCloud Drive、Dropbox、OneDrive、坚果云等本地云盘同步文件夹，扩展会把设备快照写入该文件夹，由用户自己的云盘客户端完成跨设备同步。
- 可选 AI 分类：用户可自行填写 OpenAI 兼容接口和 API Key，用于新书签或存量书签导入时的分类建议。未配置、离线或调用失败时，会自动回退到本地域名/关键词规则分类。
- 备份恢复：支持 JSON 备份导出和导入合并。

隐私设计：

- 没有中心化后端。
- 默认不需要账号。
- 数据优先保存在本机浏览器中。
- 只有在用户主动选择云盘文件夹时，数据才会写入用户指定的本地文件夹。
- 只有在用户启用 AI 分类并填写接口时，书签标题、URL、分类上下文才会发送到用户配置的 OpenAI 兼容接口。

适合人群：

- 想把新标签页变成个人导航看板的用户。
- 想整理 Chrome 书签但不想依赖中心化账号系统的用户。
- 想通过自己的云盘目录同步书签数据的用户。
- 想用可选 AI 辅助大量书签分类的用户。

### 分类建议

Productivity

### 语言建议

主语言：中文（简体）

如果后台允许补英文 listing，可使用 `README.en.md` 的内容作为英文基础。

### 官方图片资产要求

官方图片规范显示：

- 128×128 PNG 扩展图标：必须包含在 ZIP 内。本项目已有 `public/icons/icon128.png`，并已进入 `dist/public/icons/icon128.png`。
- 小宣传图：440×280 PNG/JPG，必须上传。
- 截图：至少 1 张，建议最多 5 张；尺寸为 1280×800 或 640×400，官方更推荐 1280×800。
- Marquee 宣传图：1400×560，可选。

本项目当前已有图标，仍需准备截图和宣传图。

建议截图清单：

1. `1280x800` 新标签页导航看板：展示多导航页、多个区域、书签卡片、搜索栏。
2. `1280x800` 快速收藏弹窗：展示当前页 URL、标题编辑、分类建议、保存按钮。
3. `1280x800` 设置页云盘同步：展示选择云盘文件夹、同步状态、本机标识。
4. `1280x800` 设置页 AI 分类与导入浏览器书签：展示 OpenAI 兼容接口配置、导入按钮。
5. `1280x800` 外观设置：展示背景图、遮罩、区块透明度设置。

建议小宣传图：

- 尺寸：440×280
- 画面：左侧放签屿图标和品牌名，右侧放简化的新标签页看板界面。
- 文案尽量少；官方建议宣传图避免大量文字。

## 3. Privacy Practices 可复制资料

### Single purpose description

签屿 · Mark Isle 的单一用途是提供本地优先的 Chrome 书签管理和新标签页导航体验，让用户保存、整理、搜索、导入和同步自己的书签数据。

### Permission justifications

`tabs`

用于读取当前活动标签页的标题、URL 和 favicon，以便用户点击工具栏弹窗或快捷键时，将当前网页保存为签屿书签。扩展不会持续监控用户浏览历史。

`contextMenus`

用于在网页或链接上提供“收藏此页到签屿”的右键菜单，让用户主动将当前页面或链接保存到本地书签看板。

`bookmarks`

用于用户在设置页点击“导入浏览器书签”时读取 Chrome 原生书签树，并把用户已有书签导入签屿。该权限只用于导入和去重，不会修改或删除 Chrome 原生书签。

### Remote code

选择：No, I am not using remote code.

说明：

扩展不加载或执行远程托管的 JavaScript、WASM 或其他可执行代码。所有扩展代码均随发布包打包。可选 AI 分类功能只会在用户主动启用并填写 OpenAI 兼容接口后，通过 HTTPS 请求发送书签标题、URL 和分类上下文以获取分类结果；返回内容作为数据处理，不作为代码执行。

### Data usage disclosure

建议勾选的数据类型：

- Website content：书签 URL、网页标题、favicon URL、用户保存的备注、分类名称、用户导入的浏览器书签路径等。
- User activity：用户在扩展内创建、编辑、删除、排序、导入和同步书签的操作会反映为本地数据更新时间、逻辑时钟和设备标识，用于本地合并同步。

不建议勾选：

- Personally identifiable information：扩展没有账号系统，不主动收集姓名、邮箱、电话号码等身份信息。
- Authentication information：扩展不收集网站登录凭据。用户可选填写的 LLM API Key 仅保存在本地并用于调用用户配置的接口，不属于网站账号凭据；隐私政策中需要单独说明。
- Financial and payment information：没有支付功能。
- Health information：没有。
- Personal communications：没有。
- Location：没有。
- Web history：扩展只在用户主动保存当前页或导入浏览器书签时读取相关 URL，不持续收集浏览历史。

Limited use 声明建议全部确认：

- 数据仅用于提供或改进本扩展的核心功能。
- 数据不会出售给第三方。
- 数据不会用于与核心功能无关的广告。
- 数据不会用于信用评估或借贷目的。

### Privacy policy URL

后台必须填写公开可访问 URL。建议在 GitHub Pages 或网站上发布下面第 4 节隐私政策，然后填写该 URL。

如果暂时没有官网，建议：

1. 在仓库新增 `PRIVACY.md`。
2. 打开 GitHub 仓库 Pages，发布为公开页面。
3. 后台填写 GitHub Pages 的隐私政策 URL，而不是本地文件路径。

## 4. 隐私政策草案

# 签屿 · Mark Isle 隐私政策

生效日期：2026-06-24

签屿 · Mark Isle 是一个本地优先的 Chrome 书签管理与新标签页导航扩展。本政策说明扩展如何处理用户数据。

## 我们收集或处理的数据

扩展会在用户设备本地处理以下数据：

- 用户创建、编辑或导入的书签标题、URL、备注、分类、排序和页面布局。
- 用户在扩展内设置的背景图 URL 或本地背景图 data URL。
- 用户设备标识、更新时间和逻辑时钟，用于本地数据合并和云盘目录同步。
- 用户可选填写的 OpenAI 兼容接口地址、模型名称和 API Key。

扩展没有账号系统，不要求用户登录，不主动收集姓名、邮箱、电话号码、付款信息、精确位置、健康信息或个人通信内容。

## 数据存储位置

默认情况下，数据保存在用户浏览器本地 IndexedDB 中。

如果用户主动选择云盘同步文件夹，扩展会把书签数据快照写入该本地文件夹下的 `mark-isle/` 子目录。跨设备同步由用户自己的云盘客户端完成，例如 iCloud Drive、Dropbox、OneDrive 或坚果云。签屿没有中心化同步服务器。

用户可通过扩展设置页导出或导入 JSON 备份文件。

## AI 分类

AI 分类是可选功能。只有在用户主动启用并填写 OpenAI 兼容接口和 API Key 后，扩展才会向用户配置的接口发送书签标题、URL、已有分类等必要上下文，用于生成分类建议。

API Key 会经过浏览器 Web Crypto 加密后保存在本地。扩展不会把 API Key 上传到签屿服务器，因为签屿没有中心化服务器。

如果用户未启用 AI、离线或接口调用失败，扩展会使用本地域名和关键词规则进行分类。

## 浏览器书签权限

当用户在设置页点击“导入浏览器书签”时，扩展会读取 Chrome 原生书签树，用于导入、清洗重复链接和生成分类。扩展不会修改或删除 Chrome 原生书签。

## 第三方服务

扩展可能使用以下第三方请求：

- Google favicon 服务：用于根据书签域名显示网站图标。
- 用户自行配置的 OpenAI 兼容接口：仅在用户启用 AI 分类时使用。
- 用户自行选择的云盘客户端：同步发生在用户设备和云盘客户端之间，扩展只写入用户授权的本地文件夹。

## 数据共享和出售

我们不会出售用户数据。扩展不会将用户数据用于广告、信用评估或与书签管理无关的目的。

## 用户控制

用户可以：

- 在扩展内编辑或删除书签、区域和导航页。
- 断开云盘同步目录。
- 关闭 AI 分类并清除 API Key。
- 导出备份或导入备份。
- 卸载扩展以移除扩展本地数据，具体数据清理行为以 Chrome 浏览器为准。

## 联系方式

如有隐私问题，请通过 GitHub Issues 联系：

<https://github.com/neverdie0710/mark-isle/issues>

## 5. Test Instructions 可复制资料

本扩展无需账号、付费订阅或受限凭据。审核人员可按以下步骤测试核心功能：

1. 安装扩展后打开新标签页，确认出现签屿导航看板和示例书签。
2. 点击右上角添加区域，创建一个新区域。
3. 在区域内添加一个书签，输入标题和 URL，保存后确认卡片显示在看板中。
4. 点击工具栏扩展图标，在弹窗中确认当前标签页标题和 URL 可读取；点击“收藏到签屿”后回到新标签页确认已保存。
5. 在网页上右键，选择“收藏此页到签屿”，确认可保存到本地。
6. 打开扩展设置页，测试“导出备份”是否下载 JSON 文件；再用导入功能导入该文件，确认不会报错。
7. 如需测试云盘目录同步，点击“选择云盘文件夹”，选择任意本地临时文件夹，确认扩展会创建 `mark-isle/device-<id>.json` 文件。
8. 如需测试浏览器书签导入，点击设置页“导入浏览器书签”，确认扩展会读取 Chrome 书签并导入到新的导航页。
9. AI 自动分类为可选功能。未配置 API Key 时，扩展会自动使用本地规则分类；审核无需外部账号即可完成核心功能测试。

## 6. 上线前人工检查清单

- [x] `npm test` 通过。
- [x] `npm run build` 通过。
- [x] 上传包已生成：`release/mark-isle-0.1.0-chrome-web-store.zip`。
- [x] `storage` 未使用权限已移除。
- [ ] 准备至少 1 张 1280×800 截图，建议 3-5 张。
- [ ] 准备 440×280 小宣传图。
- [ ] 发布隐私政策为公开 URL。
- [ ] 在 Chrome 本地加载 `dist/`，手动测试 newtab、popup、右键菜单、设置页、导入/导出。
- [ ] 确认开发者账号邮箱、支持邮箱、主页/支持 URL。
- [ ] 确认上架地区和可见性：`Public` / `Unlisted` / `Trusted testers`。

## 7. 可选优化建议

这些不是本次上架的硬阻断，但能降低审核风险或提升转化：

1. 将 `bookmarks` 改为 `optional_permissions`，只在用户点击“导入浏览器书签”时请求。这样普通用户安装时权限更轻，审核解释也更漂亮。
2. 新增仓库根目录 `PRIVACY.md`，与公开隐私政策 URL 内容保持一致。
3. 新增 `release` 脚本：自动 build、test、zip、打印 checksum。
4. 手动截图前准备一套干净示例数据，让商店截图更像真实使用场景。

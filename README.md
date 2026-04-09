# OpenClaw Dashboard

個人視覺化看板，純靜態頁面，部署於 Cloudflare Pages。

**Live: https://openclaw-dashboard-dv8.pages.dev/**

---

## 資料架構

本專案採用**單一 `data.json`** 作為唯一資料介面，由 `scripts/generate-dashboard-data.cjs` 從 workspace 動態產生。

```
scripts/generate-dashboard-data.cjs
        ↓（讀取 workspace 各目錄）
public/data/data.json
        ↓（GitHub Actions 自動部署）
Cloudflare Pages → 線上展示
```

> ⚠️ **不要手動編輯 `data.json`**，改動會在下次 `generate-dashboard-data.cjs` 執行後被覆蓋。
> 若要修改內容，請編輯 workspace 中的源頭檔案（`notes/projects/*.md`、`MEMORY.md`、`HEARTBEAT.md` 等），然後重新執行 generator。

---

## `data.json` 欄位說明

```json
{
  "meta": {
    "generated": "2026-04-09T07:00:00.000Z",   // 資料產生時間（ISO 格式）
    "workspace": "/Users/downtoearth/.openclaw/workspace"
  },
  "projects": [...],     // 專案概覽（來自 MEMORY.md + notes/projects/）
  "memory": [...],       // 統一記憶（notes/ + financial_notes/ + memory/ + Obsidian/）
  "relationships": [...], // 記憶圖譜連線（shared tags 建立關聯）
  "jobs": {
    "items": [...],       // 所有定時作業（heartbeat / github backup / launchctl）
    "heartbeat": {...},   // Heartbeat 專用攔位
    "cron": { "items": [], "history": [] },
    "launchctl": { "items": [], "history": [] }
  }
}
```

### `meta`
| 欄位 | 說明 |
|------|------|
| `generated` | generator 執行時間 |
| `workspace` | 來源 workspace 路徑 |

### `projects[]`
| 欄位 | 說明 |
|------|------|
| `id` | 唯一識別碼（slug） |
| `title` | 專案名稱 |
| `status` | `active` / `planning` / `completed` / `onhold` |
| `progress` | 進度百分比（0-100） |
| `description` | 一句話描述 |
| `tags` | 分類標籤 |
| `completed` | 已完成的事項陣列 |
| `pending` | 待完成的事項陣列 |
| `body` | 完整 Markdown 內容（來自 notes/projects/*.md） |
| `files` | 該專案相關的檔案連結（`{ name, url, path, type }`） |
| `lastUpdated` | 最後更新日期 |

### `memory[]`（統一記憶）
| 欄位 | 說明 |
|------|------|
| `id` | 唯一識別碼（格式：`{source}-{slug}`） |
| `title` | 標題 |
| `description` | 自動摘要（取第一段有意義的文字，最多 120 字） |
| `tags` | 標籤（`#tag` 格式自動擷取） |
| `source` | 來源：`notes` / `twse` / `memory` / `obsidian` |
| `stockId` | 股號（TWSE 專屬，非必備） |
| `companyName` | 公司名稱（TWSE 專屬，非必備） |
| `path` | 檔案相對路徑 |
| `date` | 檔案日期 |
| `body` | 完整 Markdown 內容 |
| `connections` | 相關聯的其他記憶 ID（由 shared tags 計算） |

### `relationships[]`（圖譜連線）
| 欄位 | 說明 |
|------|------|
| `from` | 起點節點 ID |
| `to` | 終點節點 ID |
| `type` | 連線類型：`tag` / `project-note` |
| `tags` | 共享的標籤 |
| `strength` | 連線強度（shared tags 越多越強） |

### `jobs.items[]`
| 欄位 | 說明 |
|------|------|
| `id` | 作業唯一 ID |
| `name` | 作業顯示名稱（中文） |
| `trigger` | 觸發方式（如 `LaunchAgent: 每週六`、`HOOK: session:compact:before`） |
| `schedule` | 排程描述 |
| `nextRun` | 下次執行時間 |
| `lastRun` | 上次執行時間 |
| `status` | `active` / `running` / `stopped` |
| `history[]` | 歷史記錄（ok: true/false, message, hash?, time?） |

---

## 資料來源對應表

| JSON 欄位 | 來源檔案 |
|-----------|---------|
| `projects[].body` | `notes/projects/*.md` |
| `projects[].description` | `notes/projects/*.md` 第一段有意義文字 |
| `projects[].progress` | `notes/projects/*.md` 中的「進度」 |
| `projects[].status` | `notes/projects/*.md` 中的「狀態」 |
| `memory[].body` | `notes/*.md`、`memory/*.md`、`Obsidian/**/*.md`、`financial_notes/**/*.md` |
| `jobs.items` | `HEARTBEAT.md`（heartbeat）、GitHub backup plist + git log（github-backup）、`launchctl list`（launchctl jobs） |
| `relationships[]` | 自動從 `notes/` + `memory/` 中 shared tags 計算 |

---

## 更新流程

```bash
# 1. 執行 generator（從 workspace 根目錄）
node scripts/generate-dashboard-data.cjs

# 2. 檢查產出
cat public/data/data.json | python3 -m json.tool | head -50

# 3. 提交並推送（觸發 GitHub Actions → Cloudflare Pages 部署）
cd public/data && git add data.json && git commit -m "update data.json $(date +%Y-%m-%d)" && git push
```

---

## 本地開發

```bash
# 安裝依賴
npm install

# 產生資料
node scripts/generate-dashboard-data.cjs

# 部署到 Cloudflare Pages
npx wrangler pages deploy . --project-name=openclaw-dashboard
```

---

## Cloudflare Pages 部署設定

- **Repository:** `openclawGit200/openclaw-dashboard`
- **Build command:** （純靜態，無需 build）
- **Output directory:** `public`
- **觸發方式:** 每次 `git push` 到 `main` branch 自動部署

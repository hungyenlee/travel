# 給 AI 開發代理的專案須知

> 本檔是給所有 AI 開發代理（Claude Code、Codex…）的共用指示，為單一真相來源。
> Claude Code 透過 `CLAUDE.md` 匯入本檔；Codex 會自動讀取本檔（`AGENTS.md`）。

「台灣散步筆記」——以台灣各縣市為單位、整理景點與美食店家的靜態旅遊資訊網站
（純 HTML/CSS/原生 JS + Leaflet），部署於 GitHub Pages。

## 語言

一律使用**繁體中文**（台灣用語）回覆；程式碼、指令、識別碼維持原文。

## 開發流程（重要）

本專案採**受保護的 PR 流程，不直接動 `main`**。完整規則見
[CONTRIBUTING.md](CONTRIBUTING.md)，理由見 [docs/adr/0005-dev-workflow.md](docs/adr/0005-dev-workflow.md)。
關鍵邊界：

- **討論／釐清階段自由，不套流程。** 只有使用者明確說「**開始實作**」才啟動下列流程。
- 啟動後：bug／功能／重構先開 **Issue**（瑣事可略過）→ 開 `<類型>/<說明>` **分支** →
  實作 + 實測（本機預覽或等效方式）+ 補文件 → 開 **PR**（填模板、有 Issue 就 `Closes #n`）→ **就停手**。
- **Merge 權在使用者**：代理不自行 merge，也**不直接 push `main`**（分支保護會擋）。
- 分支／commit 字首用 Conventional Commits：`feat` / `fix` / `docs` / `refactor` / `chore`。

## 文件地圖

- `CONTEXT.md`：領域用語表（地點／景點／美食店家／允許清單…）。
- `docs/decisions.md`：設計決策總表；較重大的另有 `docs/adr/`。
- `CONTRIBUTING.md`：開發流程操作細則。

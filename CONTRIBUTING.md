# 開發流程（Contributing）

這份文件規範「台灣散步筆記」的開發流程。**為什麼**採用這套流程見
[ADR-0005](docs/adr/0005-dev-workflow.md)；這裡只講**怎麼做**。

## 總覽

```text
（自由討論／釐清需求）
        │
        ▼   ← 你說「開始實作」才啟動下面流程
   [ Issue ]        （只有 bug／功能／重構才需要；瑣事可略過）
        │
        ▼
  [ Branch ]        <類型>/<簡短說明>，從最新的 main 開
        │
        ▼
 實作 → preview 實測 → 補文件
        │
        ▼
   [ PR ]           填 PR 模板、有 Issue 就 Closes #n
        │
        ▼
 你 review + Squash merge  ← 只有你能 merge 到 main
        │
        ▼
 自動部署到 GitHub Pages
```

## 分支（Branch）

- 整合分支一律是 **`main`**；`main` 受保護，**不可直接 push**，一切經 PR。
- 分支從最新的 `main` 開，命名為 `<類型>/<簡短說明>`（全小寫、連字號）：
  - `feat/` 新功能，例：`feat/pin-places`
  - `fix/` 修 bug，例：`fix/mobile-marker-preview`
  - `docs/` 文件，例：`docs/dev-workflow`
  - `refactor/` 重構、`chore/` 雜項（設定、工具、依賴）
- 合併後分支自動刪除。

## Issue

- **只有 bug、功能、重構**這類「值得追蹤的工作」才開 Issue。
- 錯字、文案、小樣式等**瑣事可略過 Issue**，直接開 Branch + PR，但 PR 說明要交代清楚。
- 開 Issue 時套用模板（bug／feature／backlog）。

## Backlog（待開發項目）

「未來想做／考慮做」的項目一律用 **GitHub Issues** 追蹤，**不寫進 `docs/decisions.md`**
（`decisions.md` 只記「已採用的決策」）。理由見 [ADR-0008](docs/adr/0008-backlog-via-issues.md)。

- **怎麼開**：用「Backlog／日後再議」模板（`.github/ISSUE_TEMPLATE/backlog.md`），
  會自動掛上 `enhancement` + [`icebox`](https://github.com/hungyenlee/travel/labels/icebox) 標籤。
  標題沿用 Conventional Commits 風格（`feat:` / `refactor:` …）。
- **`icebox` 的意思**：日後再議、**尚未排入實作**。放進 backlog **不等於「開始實作」**——
  討論／存點子階段自由，不套實作流程。
- **由 AI 代理開立時，須先徵得維護者同意**才建立 Issue（見 [AGENTS.md](AGENTS.md)）。
- **撿起來做**：決定要做時，把該 Issue 的 `icebox` 標籤**移除**（代表排進來了），
  **重用同一則 Issue**（不另開）接續既有流程：開 `<類型>/<說明>` 分支 → 實作 → PR 用
  `Closes #n` 連結 → 你 review + Squash merge。

## Commit 訊息

- 採 [Conventional Commits](https://www.conventionalcommits.org/)：`<類型>: <摘要>`。
- 類型對齊分支字首（`feat` / `fix` / `docs` / `refactor` / `chore`）。
- 開發途中的零碎 commit 不必講究——因為採 **Squash merge**，最終只會壓成一顆
  以 PR 標題為訊息的 commit 進 `main`。

## Pull Request

送 PR 前，請確認達到**完成定義（Definition of Done）**：

1. **可運作**：改動已在本機 preview 實測，PR 說明附上驗證方式與結果。
2. **文件同步**：
   - 有設計取捨 → 補 ADR（`docs/adr/`）、更新 `docs/decisions.md`。
   - 動到用語 → 更新 `CONTEXT.md`。
   - 動到功能／網址 → 更新 `README.md`。
3. **說明清楚**：PR 說明講 What / Why / 驗證方式；有對應 Issue 就寫 `Closes #<編號>`。

PR 一開，GitHub Actions 會自動跑檢查（見下）。**檢查通過**且**你 review 後**，由**你**用
**Squash and merge** 合併——只有你能 merge 到 `main`。

## 自動檢查（CI）

每個 PR 會透過 [`.github/workflows/ci.yml`](.github/workflows/ci.yml) 自動執行：

- 對所有 `.js` 跑 `node --check`（語法檢查），擋掉語法錯誤直接上線。
- 檢查 `.html` 引用的本機檔案（CSS／JS／圖片）是否存在，擋掉斷掉的路徑。

檢查是合併的必要條件；沒過不能 merge。

## 部署

`main` 一經合併，GitHub Pages 會自動部署到
<https://hungyenlee.github.io/travel/>。因此**不要把壞掉的東西 merge 進 `main`**——
這也是上面 CI 與 review 的用意。

## 緊急狀況

線上壞掉需要秒修時，可到 GitHub 的 **Settings → Branches** 暫時關閉 `main` 的保護規則，
修好後**立刻重新開啟**。這是刻意設計的摩擦，避免「緊急」變成常態性繞過。

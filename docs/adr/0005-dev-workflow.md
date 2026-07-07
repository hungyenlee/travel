# 開發流程：Issue → Branch → PR → Review → Squash merge，並以分支保護強制

## 決策

從此專案不再直接 commit 到 `main`，改採受保護的 PR 流程。**怎麼操作**的細節見
[CONTRIBUTING.md](../../CONTRIBUTING.md)；這則 ADR 記錄**為什麼**這樣定，以及各項取捨。

要點：

1. **整合分支統一 `main`**（非 `master`）：repo 預設分支、GitHub Pages 部署來源都已是 `main`，沿用即可、零遷移成本。
2. **以分支保護「強制」而非「自律」**：`main` 開啟保護，禁止直接 push、合併前須 PR 且須通過 CI，**連管理員也不可繞過**。因為規則若不強制，破例零成本，等於沒規範。緊急時才臨時關閉保護。
3. **Issue 只用於 bug／功能／重構**；瑣事（錯字、文案、小樣式）可略過 Issue，但仍走 Branch + PR。讓儀式與工作份量成比例。
4. **分支命名 `<類型>/<簡短說明>`**，類型對齊 Conventional Commits。
5. **PR 以 `Closes #n` 連結並自動關閉 Issue**，省手動、可雙向追溯。
6. **完成定義 + PR 模板**：可運作（preview 實測）＋文件同步（ADR/decisions/CONTEXT/README）＋說明 What/Why/驗證。
7. **Squash and merge + 合併後自動刪分支，且只允許 squash**：維持 `main` 線性、一顆 commit 對應一件完整工作，開發途中的零碎 commit 不污染主線。
8. **最小 CI**：對所有 JS 跑 `node --check`、檢查 HTML 引用的本機檔案存在，設為合併必要條件。
9. **不要求 Approve 數**：單人 repo 無法核准自己開的 PR，硬性要求會把自己卡死；「你確認」＝你讀完 PR 後自行按 Squash merge。

## 為什麼記錄

這是專案第一個「流程」層級的決策（前面 ADR 都是技術決策）。未來若有人（包含未來的自己或協作者）覺得「單人專案搞 PR 很麻煩、直接推 `main` 比較快」，這則 ADR 說明為何刻意接受這點摩擦。

## 理由與取捨

- **為什麼對單人專案也要這麼正式**：站台一 merge 就自動部署到線上，沒有關卡時一個語法錯誤就直接讓線上壞掉。PR + CI + review 把「上線」變成有審查的動作，而不是隨手 push。同時也讓「我（Claude）如何幫忙改動」有明確、可預期的交接點。
- **強制（連管理員不可繞過）的代價**：緊急修復也得走 PR 或臨時關規則。刻意選擇這個摩擦，避免「緊急」成為長期繞過的藉口。逃生門是「臨時關保護 → 修 → 立刻開回」。
- **Squash 的取捨**：犧牲分支上的逐 commit 過程紀錄，換取 `main` 的乾淨線性歷史；過程若需回顧，PR 本身已保留。
- **AI 協作的邊界**：討論／釐清階段自由不套流程；使用者明確說「開始實作」才啟動流程。Claude 一路做到開 PR 就停手，**merge 權保留在使用者**，且 Claude 不直接動 `main`（分支保護連用其憑證的操作也一併擋下）。

## 相關

- 操作細則：[CONTRIBUTING.md](../../CONTRIBUTING.md)
- CI：[.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- 模板：[.github/pull_request_template.md](../../.github/pull_request_template.md)、`.github/ISSUE_TEMPLATE/`

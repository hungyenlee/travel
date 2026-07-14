# 待開發項目改用 GitHub Issues 追蹤，不寫進 decisions.md

## 決策

「未來想做／考慮做」的項目（backlog），一律用 **GitHub Issues** 追蹤，**不再寫進
`docs/decisions.md`**。`decisions.md` 從此只保留「**已採用的決策**」；原本的「尚未採用（可日後再議）」段落移除，改留一句指向 Issues 的指路。

要點：

1. **兩者分工**：`decisions.md` = 已拍板、往回看的決策紀錄；GitHub Issues = 未來要做、往前看的待辦。
2. **標籤**：新增 `icebox` 標籤＝「日後再議、尚未排入實作」。Backlog 項目掛「類型標籤（`enhancement` 等）＋ `icebox`」。
3. **模板**：新增 `.github/ISSUE_TEMPLATE/backlog.md`，frontmatter 預設 `labels: enhancement, icebox`；標題沿用 Conventional Commits 風格（`feat:` / `refactor:` …）。
4. **生命週期**：撿起來做時把 `icebox` 拿掉、**重用同一則 Issue**（不另開）接既有 PR 流程（分支 → 實作 → PR `Closes #n` → Squash merge）。放進 backlog **不等於「開始實作」**。
5. **AI 代理**：代理要建立 backlog Issue 前**須先徵得維護者同意**（見 [AGENTS.md](../../AGENTS.md)）。

## 為什麼記錄

開發流程（[ADR-0005](./0005-dev-workflow.md)）原本沒有明確規範「未來想做的事」記在哪，實務上散在 `decisions.md` 的「尚未採用」段落。這次把它正式改到 Issues，是對開發流程的一次調整；記下來讓日後看的人知道「為什麼 backlog 不在 `decisions.md`、而在 Issues」。

## 理由與取捨

1. **為什麼用 Issues 而非 `decisions.md` 散文**：散文清單沒有狀態、指派、標籤、討論串，也無法連到實作它的 PR。Issues 是 GitHub 原生的待辦機制——可篩選（`icebox`）、可討論、可用 `Closes #n` 與 PR 綁定、關閉即代表完成，天生比一段 Markdown 清單好追蹤。
2. **為什麼保留 `decisions.md`**：它仍是「已採用決策」的總表（為什麼現在長這樣），這個價值不變；只是把「還沒做的事」抽離，讓兩種性質不同的內容各安其位、不再混雜。
3. **為什麼加 `icebox` 而不是直接用 `enhancement`**：要能一眼分出「總有一天（日後再議）」與「排進來、近期要做」。`icebox` 有無即代表這條分界；撿起來做只需拿掉標籤，不必搬家或改狀態。
4. **為什麼代理開 Issue 要先同意**：避免討論中每個閃過的想法都被自動開成一堆 Issue 洗版；由維護者把關「這個值得追蹤」再開。
5. **取捨**：backlog 從此不在 git 倉庫的檔案裡（不隨 clone 帶著走、也不進版本歷史），而在 GitHub 平台上。對這個以 GitHub 為家的專案可接受；若哪天要離開 GitHub，需另行匯出 Issues。

## 相關

- 開發流程主體：[ADR-0005](./0005-dev-workflow.md)、[CONTRIBUTING.md](../../CONTRIBUTING.md)
- 決策總表對應條目：[decisions.md](../decisions.md) #31
- 給 AI 代理的規則：[AGENTS.md](../../AGENTS.md)

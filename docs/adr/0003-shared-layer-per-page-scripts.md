# 共用層 shared.js + 每頁一支 JS，取代單一 script.js

## 決策

JavaScript 分成一個**共用層 `shared.js`** ＋ **每個頁面各一支**（`home.js`、`city.js`、`detail.js`），而非規劃書原本設想的單一 `script.js`。

- `shared.js`：三頁共用的邏輯——資料查詢（`getPlaceById`、`getPlacesByCity`⋯⋯）、卡片與預覽卡渲染（`renderCard`、`renderPreview`）、網址組合（`detailUrl`、`cityUrl`）、允許清單檢查（`findTaxonomyViolations`）。每頁都在自己的頁面 JS 之前載入它。
- 頁面 JS：只放該頁專屬邏輯，一律呼叫 `shared.js`，不重造輪子。

載入順序：`data.js → shared.js → 頁面 JS`。

## 為什麼記錄

規劃書寫的是單一 `script.js`，未來讀者會疑惑為何拆成多支。記錄下來以免有人為了「照規劃書」又合併回去。

## 理由與取捨

- 三個頁面當初是**平行分工、由不同作業各自建立**。若共用單一 `script.js`，多方會互相覆蓋、衝突。拆成「一個凍結的共用層 + 每頁獨占一支」後，各作業只寫自己的檔案、彼此不打架，共用邏輯也早已凍結一致。
- 代價是檔案數變多；但每支職責清楚、對新手反而更好讀。
- 容易回頭：真要合併回單一檔，把各頁 JS 併入並以頁面判斷分流即可，成本低。此處記錄重點在「這是刻意選擇」。

# 台灣散步筆記

以台灣各縣市為單位，整理景點與美食店家的旅遊資訊網站。第一版聚焦**台南**，其他縣市保留入口、標示「即將新增」。

**🌐 線上瀏覽：<https://hungyenlee.github.io/travel/>**

## 網站功能

- **首頁**：城市入口 + 台南隨機精選景點與店家。
- **城市頁**：互動地圖（Leaflet + OpenStreetMap）＋篩選＋卡片列表，三者連動。景點藍點、美食橘點。
- **詳細頁**：景點／店家共用版型，含地址、營業時間、Google 地圖連結。

## 如何瀏覽

- **本機**：直接雙擊 `index.html` 用瀏覽器開啟即可。
  （城市頁的地圖需要連上網路載入圖磚；其餘頁面離線也能看。）
- **線上**：<https://hungyenlee.github.io/travel/> —— 由 GitHub Pages 部署，每次 `git push` 後自動更新。

## 技術

純 HTML + CSS + JavaScript，無需建置工具、無後端、無資料庫。唯一的外部相依是地圖用的 **Leaflet**（免費、免金鑰）與 **OpenStreetMap** 圖磚。

## 專案結構

```text
index.html  city.html  detail.html   頁面（留在根目錄）
README.md   CONTEXT.md               說明、領域用語表
assets/
├── css/
│   └── style.css       全站樣式與設計系統
├── js/
│   ├── shared.js       三頁共用的工具函式
│   ├── home.js         首頁邏輯
│   ├── city.js         城市頁邏輯（地圖、篩選、預覽卡）
│   └── detail.js       詳細頁邏輯
└── images/             圖片（含缺圖用的 placeholder.svg）
data/
└── data.js             ★ 內容資料（地點清冊 + 允許清單）
docs/
├── plan.md             最初的規劃書
├── decisions.md        設計決策總表
└── adr/                架構決策記錄（ADR）
```

## 如何維護內容（改 `data/data.js` 就好）

所有內容都在 [`data/data.js`](data/data.js)，檔案開頭有詳細中文說明。常見操作：

- **新增地點**：複製 `places` 裡一筆物件貼上、修改內容。
  - `type` 只能是 `"attraction"`（景點）或 `"restaurant"`（美食店家）。
  - `categories`、`tags` 必須從 `taxonomy` 允許清單裡挑；若要用新詞，請**先**把它加進 `taxonomy`（否則城市頁會浮出警告橫幅提醒）。
- **放照片**：把照片命名成該地點 `image` 欄位對應的檔名（例如 `assets/images/chihkan-tower.jpg`）放進 `assets/images/`，網站會自動顯示；還沒放的會用佔位圖。
- **開放新城市**：把 `cities` 裡該城市的 `available` 改成 `true`，並補上該城市的地點與行政區清單即可。

## 文件

- [`CONTEXT.md`](CONTEXT.md)：術語定義（地點、景點、店家、允許清單、遊客 vs 維護者⋯⋯）。
- [`docs/decisions.md`](docs/decisions.md)：所有設計決策的總表。
- [`docs/adr/`](docs/adr/)：重大決策的來龍去脈（固定允許清單、地圖預覽卡自製、共用層架構）。
- [`docs/plan.md`](docs/plan.md)：最初的規劃書。

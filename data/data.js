/*
 * data.js — 台灣散步筆記 的資料檔
 * ============================================================
 * 這是整個網站的內容來源，由維護者手動編輯。每個頁面都會先載入本檔
 * （<script src="data/data.js">，於 shared.js 與頁面 JS 之前），
 * 因此這裡宣告三個全域常數：cities、places、taxonomy。
 *
 * 重要規則：
 *   1. 每個地點（place）的「分類 categories」與「特色標籤 tags」，
 *      都必須從下方 taxonomy 允許清單裡挑選既有的詞。
 *      若打了清單外的詞（例如把「老店」誤打成「老舖」），
 *      城市頁最上方會浮出警告橫幅提醒維護者（見 ADR 0001）。
 *   2. 「招牌品項 signatureDishes」可自由填寫，不受允許清單限制，
 *      只有美食店家（restaurant）才有這個欄位。
 *
 * 如何新增一個地點：
 *   1. 若要用到新的行政區、分類或標籤，請「先」加進 taxonomy。
 *   2. 在 places 陣列複製一個現有物件，依欄位順序修改：
 *        id, type, name, city, district, categories, tags,
 *        signatureDishes（僅店家）, image, description,
 *        address, openingHours, mapUrl, location:{lat,lng}
 *   3. id 為唯一英文識別碼（用於網址），例如 "chihkan-tower"。
 *   4. type 只能是 "attraction"（景點）或 "restaurant"（美食店家）。
 *   5. image 指向 assets/images/ 資料夾內的照片檔；若檔案還沒放上去，
 *      頁面會自動改用 assets/images/placeholder.svg 佔位圖。
 */

/* 城市清單：第一版僅台南可瀏覽，其餘保留入口（即將新增）。 */
const cities = [
  { slug: "tainan",    name: "台南", available: true  },
  { slug: "kaohsiung", name: "高雄", available: false },
  { slug: "taichung",  name: "台中", available: false },
  { slug: "taipei",    name: "台北", available: false },
  { slug: "hualien",   name: "花蓮", available: false },
  { slug: "taitung",   name: "台東", available: true  },
];

/* 允許清單（taxonomy）：篩選按鈕只從這裡產生。
 * 地點的 categories / tags 必須取自本清單。 */
const taxonomy = {
  // 各城市的行政區清單（以城市 slug 為 key）
  districts: {
    tainan: ["中西區", "安南區", "仁德區", "安平區", "東區"],
    taitung: ["太麻里鄉", "成功鎮", "鹿野鄉", "池上鄉"],
  },
  // 景點分類（景點用）
  attractionCategories: ["古蹟", "自然景觀", "博物館", "觀景台"],
  // 料理分類（美食店家用）
  restaurantCategories: ["牛肉湯", "居酒屋", "串燒", "酒吧"],
  // 特色標籤（景點與店家共用，可篩選）
  tags: [
    "老店", "排隊名店", "可外帶", "宵夜", "深夜",
    "需門票", "免費", "適合拍照", "親子", "生態", "雨天適合",
  ],
};

/* 地點清單（places）：台南為第一版主力，台東為第二批新增（景點）。 */
const places = [
  {
    id: "chihkan-tower",
    type: "attraction",
    name: "赤崁樓",
    city: "tainan",
    district: "中西區",
    categories: ["古蹟"],
    tags: ["需門票", "適合拍照", "親子"],
    image: "assets/images/chihkan-tower.jpg",
    description: "認識台南歷史的重要古蹟，前身為荷蘭時期的普羅民遮城。",
    address: "台南市中西區民族路二段212號",
    openingHours: "每日 08:30–21:30",
    mapUrl: "https://maps.app.goo.gl/KFkHY6nMK56H7uU27",
    location: { lat: 22.997478, lng: 120.2025433 },
  },
  {
    id: "sicao-green-tunnel",
    type: "attraction",
    name: "四草綠色隧道",
    city: "tainan",
    district: "安南區",
    categories: ["自然景觀"],
    tags: ["生態", "適合拍照", "親子"],
    image: "assets/images/sicao-green-tunnel.jpg",
    description: "有「台版亞馬遜」之稱的紅樹林生態隧道，搭竹筏穿行綠色水道。",
    address: "台南市安南區大眾路360號",
    openingHours: "每日 08:00–16:00",
    mapUrl: "https://maps.app.goo.gl/5cscwBXBHnBoC1Kn7",
    location: { lat: 23.0196399, lng: 120.1361465 },
  },
  {
    id: "chimei-museum",
    type: "attraction",
    name: "奇美博物館",
    city: "tainan",
    district: "仁德區",
    categories: ["博物館"],
    tags: ["需門票", "適合拍照", "親子", "雨天適合"],
    image: "assets/images/chimei-museum.jpg",
    description: "以西洋藝術、樂器與自然史收藏聞名，外觀宛如歐洲宮殿的博物館。",
    address: "台南市仁德區文華路二段62號",
    openingHours: "09:30–17:30（週三休館）",
    mapUrl: "https://maps.app.goo.gl/D3qaC78UGHHGh1xR8",
    location: { lat: 22.9345608, lng: 120.2260268 },
  },
  {
    id: "wenzhang-beef-soup",
    type: "restaurant",
    name: "文章牛肉湯 安平總店",
    city: "tainan",
    district: "安平區",
    categories: ["牛肉湯"],
    tags: ["排隊名店", "老店", "可外帶"],
    signatureDishes: ["溫體牛肉湯", "牛肉燥飯"],
    image: "assets/images/wenzhang-beef-soup.jpg",
    description: "安平運河旁的人氣牛肉湯名店，以新鮮溫體牛肉聞名。",
    address: "台南市安平區安平路300號",
    openingHours: "週二–週日 10:30–02:00（週一休）",
    mapUrl: "https://maps.app.goo.gl/FFYnKhUZNNbXoG396",
    location: { lat: 22.9984789, lng: 120.1780873 },
  },
  {
    id: "acai-beef-soup",
    type: "restaurant",
    name: "阿財牛肉湯",
    city: "tainan",
    district: "安平區",
    categories: ["牛肉湯"],
    tags: ["排隊名店", "老店", "可外帶"],
    signatureDishes: ["溫體牛肉湯", "牛肉炒飯"],
    image: "assets/images/acai-beef-soup.jpg",
    description: "安平在地的溫體牛肉湯老店，牛肉炒飯也是招牌。",
    address: "台南市安平區古堡路5號",
    openingHours: "05:00–13:00（售完為止）",
    mapUrl: "https://maps.app.goo.gl/aYxd7wgafbsWgYtB6",
    location: { lat: 22.9994764, lng: 120.1614754 },
  },
  {
    id: "xiaofangzhou-izakaya",
    type: "restaurant",
    name: "小方舟串燒酒場",
    city: "tainan",
    district: "東區",
    categories: ["居酒屋", "串燒"],
    tags: ["宵夜", "深夜"],
    signatureDishes: ["明太子馬鈴薯", "秋刀魚飯糰"],
    image: "assets/images/xiaofangzhou-izakaya.jpg",
    description: "備長炭職人炭火串燒，適合三五好友聚會的日式居酒屋。",
    address: "台南市東區林森路二段59號",
    openingHours: "日–四 17:30–23:30，五–六 17:30–00:00",
    mapUrl: "https://maps.app.goo.gl/73Ak7kuvAXSqRuZt6",
    location: { lat: 22.9867722, lng: 120.2225991 },
  },
  {
    id: "chikan-herbal-bar",
    type: "restaurant",
    name: "赤崁中藥行",
    city: "tainan",
    district: "中西區",
    categories: ["酒吧"],
    tags: ["宵夜", "深夜"],
    signatureDishes: ["琴酒特調", "中藥入酒調飲"],
    image: "assets/images/chikan-herbal-bar.jpg",
    description: "台南第一家琴酒吧，隱身老宅、以中藥房為主題的特色調酒酒吧。",
    address: "台南市中西區赤嵌街45巷3號",
    openingHours: "週二–週日 20:00–02:00（週六日至 03:00，週一休）",
    mapUrl: "https://maps.app.goo.gl/qhRohCJ9eGCu5Pza7",
    location: { lat: 22.9985496, lng: 120.2023874 },
  },

  /* ---------- 台東 ---------- */
  {
    id: "duoliang-station",
    type: "attraction",
    name: "多良觀光車站",
    city: "taitung",
    district: "太麻里鄉",
    categories: ["觀景台"],
    tags: ["適合拍照", "需門票"],
    image: "assets/images/duoliang-station.jpg",
    description: "號稱全台最美車站，二樓景觀台緊鄰太平洋，可俯瞰湛藍海景與南迴鐵路列車。",
    address: "臺東縣太麻里鄉多良村瀧溪路8-1號",
    openingHours: "每日 08:00–17:00（入園清潔費每人 10 元）",
    mapUrl: "https://maps.app.goo.gl/Hg48t8URFg8HyiaL7",
    location: { lat: 22.507520, lng: 120.958849 },
  },
  {
    id: "sanxiantai",
    type: "attraction",
    name: "三仙台觀景台",
    city: "taitung",
    district: "成功鎮",
    categories: ["自然景觀"],
    tags: ["適合拍照", "免費", "生態"],
    image: "assets/images/sanxiantai.jpg",
    description: "東海岸代表地標，跨海八拱橋連接離岸小島，珊瑚礁地質與滿天星空聞名。（八拱橋整修封閉至 2027 年底）",
    address: "臺東縣成功鎮三仙里基翬路74號",
    openingHours: "全日開放（免費入園，停車另收清潔費）",
    mapUrl: "https://maps.app.goo.gl/QSSsX42UG3siwD268",
    location: { lat: 23.123656, lng: 121.409022 },
  },
  {
    id: "huayuan-sky-mirror",
    type: "attraction",
    name: "天空之境（華源觀景台）",
    city: "taitung",
    district: "太麻里鄉",
    categories: ["觀景台"],
    tags: ["適合拍照", "免費"],
    image: "assets/images/huayuan-sky-mirror.jpg",
    description: "台9線旁農園的無邊際蓄水池，晴天滿水時倒映藍天海景，還有漂流木愛心可拍照。",
    address: "臺東縣太麻里鄉華源村（台9線約395.5K產業道路）",
    openingHours: "全日開放（退潮、晴朗早晨最佳）",
    mapUrl: "https://maps.app.goo.gl/rNBA5SeaAMHs9ncw7",
    location: { lat: 22.659799, lng: 121.021249 },
  },
  {
    id: "luye-highland",
    type: "attraction",
    name: "鹿野高台",
    city: "taitung",
    district: "鹿野鄉",
    categories: ["自然景觀"],
    tags: ["適合拍照", "免費", "親子"],
    image: "assets/images/luye-highland.jpg",
    description: "花東縱谷的大草原斜坡，居高俯瞰卑南溪谷田野，也是台灣國際熱氣球嘉年華主場地。",
    address: "臺東縣鹿野鄉永安村高台路46號",
    openingHours: "全日開放（熱氣球活動另訂時段）",
    mapUrl: "https://maps.app.goo.gl/m9wpmbvquwiQfdLt5",
    location: { lat: 22.916449, lng: 121.121595 },
  },
  {
    id: "mr-brown-avenue",
    type: "attraction",
    name: "伯朗大道",
    city: "taitung",
    district: "池上鄉",
    categories: ["自然景觀"],
    tags: ["適合拍照", "免費", "親子"],
    image: "assets/images/mr-brown-avenue.jpg",
    description: "筆直田間道路兩旁無電線桿，奉茶樹（原金城武樹）與金黃稻浪構成的經典田園風景。",
    address: "臺東縣池上鄉伯朗大道",
    openingHours: "全日開放（全年管制，僅開放單車與步行）",
    mapUrl: "https://maps.app.goo.gl/mW3zBoWHf8PHGbDU7",
    location: { lat: 23.098807, lng: 121.213002 },
  },
];

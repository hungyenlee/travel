/*
 * home.js — 首頁（index.html）專用邏輯
 * ============================================================
 * 載入順序：data.js → shared.js → home.js
 * 只使用 shared.js 的共用函式取資料與產生卡片，不重複實作。
 *
 * 兩件事：
 *   1. 依 cities 陣列填出城市入口（#cityGrid）。
 *   2. 每次載入隨機挑台南精選地點（#featuredGrid）。
 */

/* ---------- 1. 城市入口 ---------- */
function renderCities() {
  var grid = document.getElementById("cityGrid");
  if (!grid) return;

  // 逐一產生城市卡片：可瀏覽的做成連結，尚未開放的做成灰階不可點卡片。
  // 每張卡再依 slug 加上 city-card--<slug>，由 CSS 疊上該縣市的特色背景照。
  var html = cities.map(function (city) {
    var name = escapeHtml(city.name);
    var slugClass = "city-card--" + city.slug;
    // 卡片文字包一層 .city-card__name，方便疊在背景照上並置中顯示
    var label = '<span class="city-card__name">' + name + "</span>";
    if (city.available) {
      // 可瀏覽城市：整張卡片連到城市頁
      return '<a class="city-card ' + slugClass + '" href="' + cityUrl(city.slug) + '">' +
        label + "</a>";
    }
    // 即將新增城市：不可點，附上「即將新增」徽章
    return '<div class="city-card city-card--disabled ' + slugClass + '">' +
      label + ' <span class="badge">即將新增</span></div>';
  }).join("");

  grid.innerHTML = html;
}

/* ---------- 2. 台南精選（每次載入隨機） ---------- */
function renderFeatured() {
  var grid = document.getElementById("featuredGrid");
  if (!grid) return;

  // 取台南所有地點，再依類型分成景點與店家
  var tainanPlaces = getPlacesByCity("tainan");
  var attractions = tainanPlaces.filter(isAttraction);
  var restaurants = tainanPlaces.filter(function (p) { return !isAttraction(p); });

  // 各隨機挑 3 筆（不足 3 筆時 pickRandom 會自動只回傳現有數量）
  var pickedAttractions = pickRandom(attractions, 3);
  var pickedRestaurants = pickRandom(restaurants, 3);

  // 景點在前、店家在後，逐張以 shared.js 的 renderCard 產生卡片。
  // 注意：不可寫成 .map(renderCard)，否則 map 會把索引當成第二參數 pinned 傳入，
  // 導致部分卡片誤加 card--pinned 粗框；首頁精選一律非固定狀態。
  var featured = pickedAttractions.concat(pickedRestaurants);
  grid.innerHTML = featured.map(function (p) { return renderCard(p); }).join("");
}

/* ---------- 進入點 ---------- */
renderCities();
renderFeatured();

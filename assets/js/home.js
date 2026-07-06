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

  // 逐一產生城市卡片：可瀏覽的做成連結，尚未開放的做成灰階不可點卡片
  var html = cities.map(function (city) {
    var name = escapeHtml(city.name);
    if (city.available) {
      // 可瀏覽城市：整張卡片連到城市頁
      return '<a class="city-card" href="' + cityUrl(city.slug) + '">' + name + "</a>";
    }
    // 即將新增城市：不可點，附上「即將新增」徽章
    return '<div class="city-card city-card--disabled">' + name +
      ' <span class="badge">即將新增</span></div>';
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

  // 景點在前、店家在後，逐張以 shared.js 的 renderCard 產生卡片
  var featured = pickedAttractions.concat(pickedRestaurants);
  grid.innerHTML = featured.map(renderCard).join("");
}

/* ---------- 進入點 ---------- */
renderCities();
renderFeatured();

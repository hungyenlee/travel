/*
 * shared.js — 台灣散步筆記 共用工具函式
 * ============================================================
 * 所有頁面都會在「各自的頁面 JS（home.js / city.js / detail.js）」之前，
 * 依序載入：data.js → shared.js → 頁面 JS。
 * 這裡集中放三頁共用的邏輯，避免各頁重複、也避免不一致。
 *
 * 提供的全域函式（頁面 JS 直接呼叫）：
 *   getQueryParam(name)      讀取網址查詢參數，如 ?city=tainan / ?id=chihkan-tower
 *   getCityBySlug(slug)      以 slug 取城市物件
 *   getCityName(slug)        以 slug 取城市中文名（找不到就回傳 slug）
 *   getPlacesByCity(slug)    取某城市的所有地點（陣列）
 *   getPlaceById(id)         以 id 取單一地點
 *   isAttraction(place)      是否為景點
 *   typeLabel(place)         回傳「景點」或「美食」
 *   detailUrl(id)            組出詳細頁網址
 *   cityUrl(slug)            組出城市頁網址
 *   pickRandom(arr, n)       隨機取 n 筆（不改動原陣列）
 *   escapeHtml(str)          文字轉義，避免破壞 HTML
 *   imageTag(place, cls)     產生 <img>，缺圖自動退回佔位圖
 *   tagChips(place)          產生特色標籤小標（依類型上色）
 *   renderCard(place, pinned)     產生列表／精選用的整張地點卡片（整張可點進詳細頁）
 *                                 pinned=true 時加 card--pinned 粗框標示（僅城市頁列表使用）
 *   renderPreview(place, pinned)  產生地圖預覽卡的內容（景點／店家欄位不同）
 *                                 內含「固定／取消固定」切換鈕，由呼叫端接事件
 *   findTaxonomyViolations(list)  檢查地點是否用了 taxonomy 清單外的分類／標籤
 *   createBaseMap(elId)           建立 Leaflet 地圖並掛上 OSM 底圖，回傳 map（行程頁用）
 *   fitMapToLatLngs(map, latlngs) 依一組座標框選視野（單點置中／多點 fitBounds）
 *   getMarkerColors()             讀 CSS 變數回傳 {attraction, restaurant, pin} 標記色
 * ============================================================
 */

/* 缺圖時使用的佔位圖 */
const PLACEHOLDER_IMG = "assets/images/placeholder.svg";

/* ---------- 網址與資料查詢 ---------- */
function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}
function getCityBySlug(slug) {
  return cities.find(function (c) { return c.slug === slug; }) || null;
}
function getCityName(slug) {
  var c = getCityBySlug(slug);
  return c ? c.name : slug;
}
function getPlacesByCity(slug) {
  return places.filter(function (p) { return p.city === slug; });
}
function getPlaceById(id) {
  return places.find(function (p) { return p.id === id; }) || null;
}
function isAttraction(place) { return place.type === "attraction"; }
function typeLabel(place) { return isAttraction(place) ? "景點" : "美食"; }
function detailUrl(id) { return "detail.html?id=" + encodeURIComponent(id); }
function cityUrl(slug) { return "city.html?city=" + encodeURIComponent(slug); }

/* ---------- 小工具 ---------- */
function pickRandom(arr, n) {
  var copy = arr.slice();
  for (var i = copy.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
  }
  return copy.slice(0, n);
}

function escapeHtml(str) {
  return String(str == null ? "" : str).replace(/[&<>"']/g, function (s) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[s];
  });
}

/* ---------- 共用片段 ---------- */
function imageTag(place, className) {
  return '<img class="' + className + '" src="' + escapeHtml(place.image) +
    '" alt="' + escapeHtml(place.name) + '" loading="lazy"' +
    " onerror=\"this.onerror=null;this.src='" + PLACEHOLDER_IMG + "'\">";
}

function tagChips(place) {
  var cls = isAttraction(place) ? "tag--attraction" : "tag--restaurant";
  return (place.tags || []).map(function (t) {
    return '<span class="tag ' + cls + '">' + escapeHtml(t) + "</span>";
  }).join("");
}

/* 列表／精選卡片：整張 <a> 可點，點任意處都進詳細頁（含圖片）。
 * pinned=true 時加上 card--pinned（紫色粗框），用於城市頁被固定的地點。 */
function renderCard(place, pinned) {
  var cats = (place.categories || []).join("｜");
  var cta = isAttraction(place) ? "查看詳細資訊" : "查看店家資訊";
  var meta = escapeHtml(getCityName(place.city)) + "・" + escapeHtml(place.district);
  return '' +
    '<a class="card' + (pinned ? " card--pinned" : "") + '" href="' + detailUrl(place.id) + '">' +
      imageTag(place, "card-img") +
      '<div class="card-body">' +
        '<h3 class="card-title">' + escapeHtml(place.name) + "</h3>" +
        '<div class="card-meta"><span>' + meta + "</span><span>" + escapeHtml(cats) + "</span></div>" +
        '<p class="card-desc">' + escapeHtml(place.description) + "</p>" +
        '<div class="card-tags">' + tagChips(place) + "</div>" +
        '<span class="btn btn--primary card-cta">' + cta + "</span>" +
      "</div>" +
    "</a>";
}

/* 地圖預覽卡內容：景點與店家顯示的欄位不同（見規劃書「地圖預覽卡片」）。
 * pinned 決定「固定／取消固定」鈕的文字與樣式；點擊事件由 city.js 接（見 ADR 0004）。 */
function renderPreview(place, pinned) {
  var cta = isAttraction(place) ? "查看詳細資訊" : "查看店家資訊";
  var meta = escapeHtml(getCityName(place.city)) + "・" + escapeHtml(place.district);
  var body = "";
  if (isAttraction(place)) {
    var cat = (place.categories || [])[0] || "";
    body =
      '<div class="map-preview__meta">' + meta + (cat ? "｜" + escapeHtml(cat) : "") + "</div>" +
      '<p class="map-preview__desc">' + escapeHtml(place.description) + "</p>";
  } else {
    var cats = (place.categories || []).slice(0, 2).join("｜");
    var dishes = (place.signatureDishes || []).slice(0, 2).join("、");
    var tags = (place.tags || []).slice(0, 2).map(function (t) {
      return '<span class="tag tag--restaurant">' + escapeHtml(t) + "</span>";
    }).join("");
    body =
      '<div class="map-preview__meta">' + meta + (cats ? "｜" + escapeHtml(cats) : "") + "</div>" +
      (dishes ? '<div class="map-preview__dishes">招牌：' + escapeHtml(dishes) + "</div>" : "") +
      (tags ? '<div class="map-preview__tags">' + tags + "</div>" : "");
  }
  return '' +
    imageTag(place, "map-preview__img") +
    '<div class="map-preview__content">' +
      '<div class="map-preview__title">' + escapeHtml(place.name) + "</div>" +
      body +
      '<div class="map-preview__actions">' +
        '<a class="btn btn--primary" href="' + detailUrl(place.id) + '">' + cta + "</a>" +
        '<button type="button" class="map-preview__pin' + (pinned ? " is-pinned" : "") +
          '" data-id="' + escapeHtml(place.id) + '">' +
          (pinned ? "取消固定" : "固定") +
        "</button>" +
      "</div>" +
    "</div>";
}

/* 資料檢查（ADR 0001）：找出使用了 taxonomy 清單外的分類或標籤的地點。
 * 回傳 [{ name, field, value }, ...]，city.js 會據此顯示警告橫幅。 */
function findTaxonomyViolations(list) {
  var problems = [];
  (list || []).forEach(function (p) {
    var allowedCats = isAttraction(p) ? taxonomy.attractionCategories : taxonomy.restaurantCategories;
    var allowedDistricts = (taxonomy.districts && taxonomy.districts[p.city]) || [];
    (p.categories || []).forEach(function (c) {
      if (allowedCats.indexOf(c) === -1) problems.push({ name: p.name, field: "分類", value: c });
    });
    (p.tags || []).forEach(function (t) {
      if (taxonomy.tags.indexOf(t) === -1) problems.push({ name: p.name, field: "特色標籤", value: t });
    });
    if (allowedDistricts.indexOf(p.district) === -1) {
      problems.push({ name: p.name, field: "行政區", value: p.district });
    }
  });
  return problems;
}

/* ---------- 地圖低階工具（供 plan.js 重用；city.js 維持自有實作） ---------- */

/* 建立 Leaflet 地圖並掛上 OpenStreetMap 底圖（URL、maxZoom、繁中 attribution
 * 與 city.js 的 initMap 保持一致）。此函式不設定 view、不加任何標記，
 * 純粹回傳可用的 map 實例，交由呼叫端自行框選視野與放標記。 */
function createBaseMap(elId) {
  var map = L.map(elId); // 不設固定 center/zoom，稍後由呼叫端框選
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 貢獻者',
  }).addTo(map);
  return map;
}

/* 依一組座標框選地圖視野：
 *   - 空陣列：不動（維持現況）。
 *   - 單點：setView 置中並固定縮放 15。
 *   - 多點：fitBounds 含 padding [40,40]，確保邊緣標記不貼邊。 */
function fitMapToLatLngs(map, latlngs) {
  if (!latlngs || !latlngs.length) return; // 空陣列不動
  if (latlngs.length === 1) {
    map.setView(latlngs[0], 15);
  } else {
    map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
  }
}

/* 從 CSS 變數讀出標記顏色，回傳 {attraction, restaurant, pin}；
 * 找不到（或值為空）時退回預設藍／橘／紫，確保與圖例一致。 */
function getMarkerColors() {
  var colors = { attraction: "#2563eb", restaurant: "#ea580c", pin: "#7c3aed" };
  var cs = getComputedStyle(document.documentElement);
  var a = cs.getPropertyValue("--color-attraction").trim();
  var r = cs.getPropertyValue("--color-restaurant").trim();
  var p = cs.getPropertyValue("--color-pin").trim();
  if (a) colors.attraction = a;
  if (r) colors.restaurant = r;
  if (p) colors.pin = p;
  return colors;
}

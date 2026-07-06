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
 *   renderCard(place)        產生列表／精選用的整張地點卡片（整張可點進詳細頁）
 *   renderPreview(place)     產生地圖預覽卡的內容（景點／店家欄位不同）
 *   findTaxonomyViolations(list)  檢查地點是否用了 taxonomy 清單外的分類／標籤
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

/* 列表／精選卡片：整張 <a> 可點，點任意處都進詳細頁（含圖片）。 */
function renderCard(place) {
  var cats = (place.categories || []).join("｜");
  var cta = isAttraction(place) ? "查看詳細資訊" : "查看店家資訊";
  var meta = escapeHtml(getCityName(place.city)) + "・" + escapeHtml(place.district);
  return '' +
    '<a class="card" href="' + detailUrl(place.id) + '">' +
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

/* 地圖預覽卡內容：景點與店家顯示的欄位不同（見規劃書「地圖預覽卡片」）。 */
function renderPreview(place) {
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
      '<a class="btn btn--primary" href="' + detailUrl(place.id) + '">' + cta + "</a>" +
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

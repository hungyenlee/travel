/*
 * detail.js — 地點詳細頁
 * ============================================================
 * 這一頁同時服務「景點」與「美食店家」，兩者版面相同、只有少數欄位不同。
 * 載入順序：data.js → shared.js → detail.js（見 detail.html 底部）。
 *
 * 流程：
 *   1. 從網址讀取 ?id=（用 shared.js 的 getQueryParam）。
 *   2. 用 getPlaceById(id) 找到這個地點。
 *   3. 找不到就顯示友善提示；找到就填入頁面。
 *
 * 只使用 shared.js 提供的共用函式做資料查詢、組網址、圖片退回，
 * 不在這裡自行重寫。
 */

(function () {
  // 內容要放進去的容器（detail.html 裡的 <div id="detail-root">）
  var root = document.getElementById("detail-root");

  // 讀取網址上的地點 id，例如 detail.html?id=chihkan-tower
  var id = getQueryParam("id");
  var place = id ? getPlaceById(id) : null;

  // ---------- 找不到地點：顯示友善提示，不報錯 ----------
  if (!place) {
    root.innerHTML =
      '<div class="empty-state">' +
        "<h1>找不到這個地點</h1>" +
        "<p>可能是網址有誤，或這個地點尚未收錄。</p>" +
        '<p><a class="btn btn--primary" href="index.html">回到首頁</a></p>' +
      "</div>";
    document.title = "找不到地點 · 台灣散步筆記";
    return;
  }

  // 更新瀏覽器分頁標題
  document.title = place.name + " · 台灣散步筆記";

  // ---------- 準備各段內容 ----------
  var cityName = getCityName(place.city);          // 城市中文名
  var attraction = isAttraction(place);            // 是否為景點

  // 分類小標：景點用藍色、店家用橘色（與特色標籤同色系）
  var catClass = attraction ? "tag--attraction" : "tag--restaurant";
  var categoriesHtml = (place.categories || []).map(function (c) {
    return '<span class="tag ' + catClass + '">' + escapeHtml(c) + "</span>";
  }).join("");

  // 特色標籤小標：直接用 shared.js 的 tagChips（同樣依類型上色）
  var tagsHtml = tagChips(place);

  // 招牌品項：只有美食店家才有，景點略過此區塊
  var dishesHtml = "";
  if (!attraction && place.signatureDishes && place.signatureDishes.length) {
    dishesHtml =
      '<div class="detail-block">' +
        '<div class="detail-label">招牌品項</div>' +
        "<div>招牌：" + escapeHtml(place.signatureDishes.join("、")) + "</div>" +
      "</div>";
  }

  // 營業時間 / 開放時間：標籤依類型不同
  var hoursLabel = attraction ? "開放時間" : "營業時間";

  // 大圖 CTA 與主按鈕文字
  var mapUrl = escapeHtml(place.mapUrl);

  // ---------- 組出整頁 HTML ----------
  root.innerHTML = '' +
    // 返回城市頁的連結（放在最上方）
    '<a class="detail-back" href="' + cityUrl(place.city) + '">← 返回' + escapeHtml(cityName) + "</a>" +

    '<div class="detail">' +
      // 左欄：大圖（可點，開啟 Google 地圖於新分頁）
      '<div class="detail-media">' +
        '<a href="' + mapUrl + '" target="_blank" rel="noopener">' +
          imageTag(place, "detail-img") +
        "</a>" +
      "</div>" +

      // 右欄：資訊
      '<div class="detail-info">' +
        // 地點名稱
        "<h1>" + escapeHtml(place.name) + "</h1>" +

        // 城市名・行政區
        '<div class="detail-meta">' + escapeHtml(cityName) + "・" + escapeHtml(place.district) + "</div>" +

        // 分類
        (categoriesHtml ? '<div class="detail-chips">' + categoriesHtml + "</div>" : "") +

        // 特色標籤
        (tagsHtml ? '<div class="detail-chips">' + tagsHtml + "</div>" : "") +

        // 簡短介紹
        (place.description ? "<p>" + escapeHtml(place.description) + "</p>" : "") +

        // 招牌品項（僅店家）
        dishesHtml +

        // 地址
        '<div class="detail-block">' +
          '<div class="detail-label">地址</div>' +
          "<div>" + escapeHtml(place.address) + "</div>" +
        "</div>" +

        // 開放時間 / 營業時間
        '<div class="detail-block">' +
          '<div class="detail-label">' + hoursLabel + "</div>" +
          "<div>" + escapeHtml(place.openingHours) + "</div>" +
        "</div>" +

        // 主要動作：在 Google 地圖開啟
        '<div class="detail-block">' +
          '<a class="btn btn--primary" href="' + mapUrl + '" target="_blank" rel="noopener">在 Google 地圖開啟</a>' +
        "</div>" +
      "</div>" +
    "</div>";
})();

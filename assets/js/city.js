/*
 * city.js — 城市頁邏輯（台灣散步筆記）
 * ============================================================
 * 職責：
 *   1. 依網址 ?city= 讀出城市，若不存在或未開放則顯示「即將新增」。
 *   2. 產生四組篩選按鈕（類型／行政區／分類／特色標籤）。
 *      同組單選；跨組以 AND（交集）組合；提供「清除篩選」。
 *   3. 依當前篩選同步重繪：摘要行、Leaflet 地圖標記、卡片列表。
 *   4. 地圖標記預覽：桌機滑鼠移入顯示 popup、點擊進詳細頁；
 *      手機點擊標記顯示底部預覽卡。
 *
 * 重要原則：資料存取、卡片與預覽的產生、網址組合、資料檢查，
 *   一律使用 shared.js 既有函式，本檔不重造輪子。
 * 載入順序：Leaflet → data.js → shared.js → 本檔（見 city.html）。
 */

(function () {
  "use strict";

  /* ---------- 篩選狀態 ---------- */
  /* 每一組的目前選擇；空字串代表「全部」（不限制）。 */
  var filters = {
    type: "",      // "" | "attraction" | "restaurant"
    district: "",  // "" | 行政區名
    category: "",  // "" | 分類名（景點分類或料理分類）
    tag: "",       // "" | 特色標籤名
  };

  /* ---------- 頁面層級變數 ---------- */
  var citySlug;          // 目前城市 slug
  var cityPlaces = [];   // 該城市的所有地點（未篩選）
  var map = null;        // Leaflet 地圖實例
  var markerLayer = null;// 放所有標記的圖層（重繪時整層清空）
  var colors = { attraction: "#2563eb", restaurant: "#ea580c", pin: "#7c3aed" }; // 由 CSS 變數覆蓋
  var isDesktop = false; // 是否為桌機寬度（用來決定預覽互動方式）

  /* 固定地點（ADR 0004）：以地點 id 當 key 的集合，跨類型、可多個。
   * 只存記憶體，重新整理／離開頁面即清空（第一版不做持久化）。 */
  var pinnedIds = {};
  var clearPinsBtn = null;  // 「清除固定（N）」按鈕，只有在有固定時才顯示。

  /* 地圖縮放（ADR 0004）：只在首次渲染自動框選一次；之後篩選／固定都不再自動縮放。 */
  var didInitialFit = false;

  /* 常用 DOM 節點 */
  var els = {};

  /* ============================================================
   * 進入點
   * ============================================================ */
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheEls();

    // 讀城市 slug；沒有則預設台南。
    citySlug = getQueryParam("city") || "tainan";
    var city = getCityBySlug(citySlug);

    // 城市不存在或尚未開放 → 顯示友善訊息，不渲染地圖與篩選。
    if (!city || !city.available) {
      renderUnavailable();
      return;
    }

    // 讀取該城市地點，並讀 CSS 變數取得標記顏色（與圖例一致）。
    cityPlaces = getPlacesByCity(citySlug);
    readMarkerColors();

    // 標題、副標、資料檢查警告。
    renderHeader();
    renderDataWarning();

    // 顯示原本隱藏的區塊。
    showCitySections();

    // 先判斷桌機／手機（決定預覽互動與地圖點擊行為）。
    isDesktop = window.matchMedia("(min-width: 768px)").matches;

    // 建立篩選列、地圖，然後做第一次渲染。
    buildFilterBar();
    initMap();
    applyFilters();
  }

  /* 快取常用 DOM 節點，避免重複查詢。 */
  function cacheEls() {
    els.title = document.getElementById("page-title");
    els.subtitle = document.getElementById("page-subtitle");
    els.warningSlot = document.getElementById("data-warning-slot");
    els.unavailableSlot = document.getElementById("unavailable-slot");
    els.filterBar = document.getElementById("filter-bar");
    els.summary = document.getElementById("summary");
    els.map = document.getElementById("map");
    els.legend = document.getElementById("map-legend");
    els.list = document.getElementById("list");
    els.preview = document.getElementById("map-preview");
  }

  /* ============================================================
   * 城市未開放
   * ============================================================ */
  function renderUnavailable() {
    var name = getCityName(citySlug);
    els.title.textContent = escapeHtml(name) + "旅遊";
    els.unavailableSlot.innerHTML =
      '<div class="empty-state">' +
        "<p>這個城市即將新增，敬請期待</p>" +
        '<a class="btn btn--primary" href="index.html">回首頁探索其他城市</a>' +
      "</div>";
  }

  /* ============================================================
   * 標題、副標、資料檢查警告
   * ============================================================ */
  function renderHeader() {
    var name = getCityName(citySlug);
    els.title.textContent = name + "旅遊";
    els.subtitle.textContent = "探索" + name + "的景點與美食店家";
    document.title = name + "旅遊 · 台灣散步筆記";
  }

  /* 資料檢查（ADR 0001）：清單外用詞時，浮出警告橫幅給維護者。 */
  function renderDataWarning() {
    var problems = findTaxonomyViolations(cityPlaces);
    if (!problems.length) return; // 沒問題就不顯示任何東西。

    var items = problems.map(function (p) {
      return "<li>資料檢查：地點「" + escapeHtml(p.name) + "」的" +
        escapeHtml(p.field) + "「" + escapeHtml(p.value) + "」不在允許清單中</li>";
    }).join("");

    els.warningSlot.innerHTML =
      '<div class="data-warning"><ul style="margin:0;padding-left:1.2em">' +
      items + "</ul></div>";
  }

  /* 城市可瀏覽時，顯示原本 hidden 的區塊。 */
  function showCitySections() {
    els.filterBar.hidden = false;
    els.summary.hidden = false;
    els.map.hidden = false;
    els.legend.hidden = false;
  }

  /* ============================================================
   * 篩選列
   * ============================================================ */
  function buildFilterBar() {
    // 類型：固定三顆。
    var typeGroup = makeGroup("類型", "type", [
      { value: "", label: "全部" },
      { value: "attraction", label: "景點" },
      { value: "restaurant", label: "美食" },
    ]);

    // 行政區：全部 + taxonomy 清單（依 ADR 0001，選項來自允許清單而非資料）。
    var districts = (taxonomy.districts && taxonomy.districts[citySlug]) || [];
    var districtGroup = makeGroup("行政區", "district",
      [{ value: "", label: "全部" }].concat(districts.map(toOption)));

    // 分類：全部 + 本城市地點實際出現的分類（景點＋料理分類的聯集）。
    var categoryGroup = makeGroup("分類", "category",
      [{ value: "", label: "全部" }].concat(collectPresent("categories").map(toOption)));

    // 特色標籤：全部 + 本城市地點實際出現的標籤。
    var tagGroup = makeGroup("特色標籤", "tag",
      [{ value: "", label: "全部" }].concat(collectPresent("tags").map(toOption)));

    // 「清除篩選」：常駐，一鍵把所有組別回到「全部」。
    var clearBtn = document.createElement("button");
    clearBtn.type = "button";
    clearBtn.className = "btn";
    clearBtn.textContent = "清除篩選";
    clearBtn.addEventListener("click", clearFilters);

    // 「清除固定」：與篩選獨立（ADR 0004）；只有在有固定時才顯示，由 updatePinControls 控制。
    clearPinsBtn = document.createElement("button");
    clearPinsBtn.type = "button";
    clearPinsBtn.className = "btn btn--pin";
    clearPinsBtn.addEventListener("click", clearPins);

    els.filterBar.innerHTML = "";
    els.filterBar.appendChild(typeGroup);
    els.filterBar.appendChild(districtGroup);
    els.filterBar.appendChild(categoryGroup);
    els.filterBar.appendChild(tagGroup);
    els.filterBar.appendChild(clearBtn);
    els.filterBar.appendChild(clearPinsBtn);
    updatePinControls(); // 依目前固定數更新「清除固定（N）」的文字與顯示。
  }

  /* 把字串包成 {value,label} 選項物件。 */
  function toOption(v) { return { value: v, label: v }; }

  /*
   * 收集本城市地點某欄位（categories / tags）實際出現過的值（去重、保序）。
   * 用於「分類」與「特色標籤」兩組，讓選項只顯示真的有資料的項目。
   */
  function collectPresent(field) {
    var seen = {};
    var out = [];
    cityPlaces.forEach(function (p) {
      (p[field] || []).forEach(function (v) {
        if (!seen[v]) { seen[v] = true; out.push(v); }
      });
    });
    return out;
  }

  /*
   * 產生一組篩選（含組標題與各按鈕）。
   * groupKey 對應 filters 物件的 key；單組單選。
   */
  function makeGroup(label, groupKey, options) {
    var group = document.createElement("div");
    group.className = "filter-group";

    var labelEl = document.createElement("span");
    labelEl.className = "filter-group__label";
    labelEl.textContent = label;
    group.appendChild(labelEl);

    options.forEach(function (opt) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "filter-btn";
      btn.textContent = opt.label;
      btn.setAttribute("data-group", groupKey);
      btn.setAttribute("data-value", opt.value);
      // 目前選中的（或「全部」代表空值）加上 is-active。
      if (filters[groupKey] === opt.value) btn.classList.add("is-active");
      btn.addEventListener("click", function () {
        selectFilter(groupKey, opt.value);
      });
      group.appendChild(btn);
    });

    return group;
  }

  /* 單組單選：設定某組的值，更新該組按鈕外觀，再重新套用篩選。 */
  function selectFilter(groupKey, value) {
    filters[groupKey] = value;
    // 更新同組所有按鈕的 is-active 狀態。
    var btns = els.filterBar.querySelectorAll(
      '.filter-btn[data-group="' + groupKey + '"]');
    Array.prototype.forEach.call(btns, function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-value") === value);
    });
    applyFilters();
  }

  /* 清除篩選：全部回到「全部」（空值），並重畫整個篩選列與結果。
   * 注意：只清篩選，不動固定（兩者獨立，見 ADR 0004）。 */
  function clearFilters() {
    filters.type = "";
    filters.district = "";
    filters.category = "";
    filters.tag = "";
    hidePreview();
    buildFilterBar(); // 重建以刷新 is-active 狀態。
    applyFilters();
  }

  /* ============================================================
   * 固定地點（ADR 0004）
   *   固定＝讓某地點在切換篩選後仍留在「地圖」上（即使被篩掉）。
   *   只影響地圖與「該地點若本來就在列表裡」的排序／標示；
   *   列表內容與摘要數字仍嚴格等於篩選結果。
   * ============================================================ */

  function isPinned(id) { return !!pinnedIds[id]; }

  function countPins() {
    var n = 0;
    for (var k in pinnedIds) { if (pinnedIds.hasOwnProperty(k)) n++; }
    return n;
  }

  /* 切換單一地點的固定狀態（由預覽卡上的按鈕觸發）。 */
  function togglePin(place) {
    if (pinnedIds[place.id]) delete pinnedIds[place.id];
    else pinnedIds[place.id] = true;

    applyFilters();       // 重畫地圖標記與列表（applyFilters 會先收起預覽卡）。
    updatePinControls();  // 更新「清除固定（N）」。
    // 重新開回這張預覽卡，讓按鈕文字（固定／取消固定）即時反映新狀態。
    if (isDesktop) showDesktopPreview(place);
    else showPreview(place);
  }

  /* 一鍵清除所有固定（只有在有固定時才會出現這顆按鈕）。 */
  function clearPins() {
    pinnedIds = {};
    hidePreview();
    applyFilters();
    updatePinControls();
  }

  /* 依目前固定數更新「清除固定（N）」按鈕的文字與顯示。 */
  function updatePinControls() {
    if (!clearPinsBtn) return;
    var n = countPins();
    clearPinsBtn.textContent = "清除固定（" + n + "）";
    clearPinsBtn.hidden = n === 0;
  }

  /* 篩選結果 ∪ 已固定地點（去重、保序：先篩選結果、再補上不在其中的固定地點）。
   * 固定地點一定屬於本城市（pinnedIds 只在本頁累積、重整即清空）。 */
  function withPinned(list) {
    var seen = {};
    var out = [];
    list.forEach(function (p) { seen[p.id] = true; out.push(p); });
    cityPlaces.forEach(function (p) {
      if (isPinned(p.id) && !seen[p.id]) { seen[p.id] = true; out.push(p); }
    });
    return out;
  }

  /* ============================================================
   * 篩選計算與整體重繪
   * ============================================================ */

  /* 依目前 filters 過濾出符合的地點（跨組 AND）。 */
  function getFilteredPlaces() {
    return cityPlaces.filter(function (p) {
      if (filters.type && p.type !== filters.type) return false;
      if (filters.district && p.district !== filters.district) return false;
      if (filters.category && (p.categories || []).indexOf(filters.category) === -1) return false;
      if (filters.tag && (p.tags || []).indexOf(filters.tag) === -1) return false;
      return true;
    });
  }

  /* 套用篩選：摘要、地圖標記、列表三者用同一份陣列同步重繪。 */
  function applyFilters() {
    var result = getFilteredPlaces();
    renderSummary(result);
    renderMarkers(result);
    renderList(result);
  }

  /* 摘要行「共收錄 N 個地點｜景點 X｜美食 Y」。 */
  function renderSummary(list) {
    var attractions = list.filter(isAttraction).length;
    var restaurants = list.length - attractions;
    els.summary.textContent =
      "共收錄 " + list.length + " 個地點｜景點 " + attractions +
      "｜美食 " + restaurants;
  }

  /* 卡片列表：用 shared.js 的 renderCard；空結果顯示空狀態。 */
  function renderList(list) {
    if (!list.length) {
      // 空狀態：附「清除篩選」按鈕。
      els.list.classList.remove("card-grid");
      els.list.innerHTML =
        '<div class="empty-state">' +
          "<p>找不到符合條件的地點，試試調整篩選</p>" +
          '<button type="button" class="btn btn--primary" id="empty-clear">清除篩選</button>' +
        "</div>";
      var btn = document.getElementById("empty-clear");
      if (btn) btn.addEventListener("click", clearFilters);
      return;
    }
    els.list.classList.add("card-grid");
    // 被固定的卡片排到最前面（穩定排序，其餘維持原順序），並以粗框標示（ADR 0004）。
    var ordered = list.slice().sort(function (a, b) {
      return (isPinned(b.id) ? 1 : 0) - (isPinned(a.id) ? 1 : 0);
    });
    els.list.innerHTML = ordered.map(function (p) {
      return renderCard(p, isPinned(p.id));
    }).join("");
  }

  /* ============================================================
   * 地圖（Leaflet）
   * ============================================================ */

  /* 從 CSS 變數讀出標記顏色，確保與圖例的藍／橘一致。 */
  function readMarkerColors() {
    var cs = getComputedStyle(document.documentElement);
    var a = cs.getPropertyValue("--color-attraction").trim();
    var r = cs.getPropertyValue("--color-restaurant").trim();
    var p = cs.getPropertyValue("--color-pin").trim();
    if (a) colors.attraction = a;
    if (r) colors.restaurant = r;
    if (p) colors.pin = p;
  }

  /* 建立地圖與底圖（OpenStreetMap）；此時尚未放標記。 */
  function initMap() {
    map = L.map("map"); // 不設定固定 center/zoom，稍後由 fitBounds 決定。
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> 貢獻者',
    }).addTo(map);
    markerLayer = L.layerGroup().addTo(map);

    // 「顯示全部」控制項（ADR 0004）：取消自動縮放後，讓使用者手動框回全覽。
    var ShowAll = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        var btn = L.DomUtil.create("button", "map-showall-btn");
        btn.type = "button";
        btn.textContent = "顯示全部";
        L.DomEvent.disableClickPropagation(btn); // 別讓按鈕點擊被地圖當成點空白處。
        L.DomEvent.on(btn, "click", function (e) {
          L.DomEvent.stop(e);
          fitAllVisible();
        });
        return btn;
      },
    });
    map.addControl(new ShowAll());

    // 點地圖空白處收起預覽卡（桌機、手機皆適用）。
    map.on("click", hidePreview);

    // 桌機：滑入預覽卡時取消關閉、滑出時關閉，讓卡片上的按鈕能點到。
    if (isDesktop && els.preview) {
      els.preview.addEventListener("mouseenter", cancelClose);
      els.preview.addEventListener("mouseleave", scheduleClose);
    }
  }

  /*
   * 重繪標記：畫「篩選結果 ∪ 已固定」（ADR 0004）。
   *   - 固定的圓點保留類型色，另加紫色粗外環並略放大，以資辨識。
   *   - 視野只在「首次渲染」自動框選一次；之後篩選／固定都不再自動縮放，
   *     使用者要重新全覽時按地圖上的「顯示全部」。
   */
  function renderMarkers(list) {
    markerLayer.clearLayers();
    hidePreview(); // 每次重繪先收起預覽卡，避免指向已消失的標記。

    var display = withPinned(list);
    if (!display.length) return;

    var latlngs = [];
    display.forEach(function (place) {
      var latlng = [place.location.lat, place.location.lng];
      latlngs.push(latlng);

      var color = isAttraction(place) ? colors.attraction : colors.restaurant;
      var pinned = isPinned(place.id);
      var marker = L.circleMarker(latlng, pinned ? {
        radius: 11,          // 略放大
        color: colors.pin,   // 紫色粗外環＝已固定
        weight: 4,
        fillColor: color,    // 內填維持類型色（看得出景點／美食）
        fillOpacity: 1,
      } : {
        radius: 9,
        color: "#ffffff",    // 白色外框讓標記在地圖上更清楚
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      });

      marker.addTo(markerLayer);
      wireMarker(marker, place); // 需在 addTo 之後（桌機要取得標記的 DOM 元素）
    });

    // 只在首次渲染自動框選一次。
    if (!didInitialFit) {
      fitToLatLngs(latlngs);
      didInitialFit = true;
    }
  }

  /* 依一組座標框選視野：單點置中縮放，多點 fitBounds 含 padding。 */
  function fitToLatLngs(latlngs) {
    if (!latlngs.length) return;
    if (latlngs.length === 1) {
      map.setView(latlngs[0], 15);
    } else {
      map.fitBounds(L.latLngBounds(latlngs), { padding: [40, 40] });
    }
  }

  /* 「顯示全部」按鈕：手動把視野框回「篩選結果 ∪ 已固定」。 */
  function fitAllVisible() {
    var display = withPinned(getFilteredPlaces());
    fitToLatLngs(display.map(function (p) {
      return [p.location.lat, p.location.lng];
    }));
  }

  /*
   * 標記互動（桌機 vs 手機，載入時以 matchMedia 判斷一次）：
   *   桌機（≥768px）：滑鼠移入圓點 → 在圓點旁顯示浮動預覽卡；移出後短暫延遲關閉，
   *                   期間若滑入卡片則保持開啟（卡片上的按鈕才點得到）；點圓點直接進詳細頁。
   *   手機（<768px）：點圓點 → 底部固定預覽卡。
   * 預覽內容一律用 shared.js 的 renderPreview。預覽卡的顯示／隱藏完全由本檔自行掌控
   * （原生 DOM 事件），不依賴 Leaflet popup，行為單純可靠。
   */

  // 桌機預覽卡的延遲關閉計時器（跨標記共用）。
  var previewTimer = null;
  function cancelClose() {
    if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  }
  function scheduleClose() {
    cancelClose();
    previewTimer = setTimeout(hidePreview, 250);
  }

  /* 依裝置為單一標記接上互動（用 Leaflet 標記事件，不依賴取得 DOM 元素的時機）。 */
  function wireMarker(marker, place) {
    if (isDesktop) {
      // 滑鼠移入圓點 → 顯示浮動預覽卡；移出 → 排定關閉（期間滑入卡片會取消）。
      marker.on("mouseover", function () {
        cancelClose();
        showDesktopPreview(place);
      });
      marker.on("mouseout", scheduleClose);
      // 點圓點 = 直接進詳細頁（與卡片上的按鈕同一目的地）。
      marker.on("click", function () {
        window.location.href = detailUrl(place.id);
      });
    } else {
      // 手機：點圓點顯示底部預覽卡（內含 CTA 連結，由 renderPreview 產生）。
      // 注意：Leaflet 的 circleMarker 被點擊時，click 會一併觸發地圖的 click
      // （= hidePreview），使剛顯示的預覽卡立刻被收掉。故在此擋下傳遞。
      marker.on("click", function (e) {
        L.DomEvent.stopPropagation(e);
        showPreview(place);
      });
    }
  }

  /* 桌機：在圓點附近顯示浮動預覽卡（fixed 定位，位置由 Leaflet 換算）。 */
  function showDesktopPreview(place) {
    var rect = els.map.getBoundingClientRect();
    var pt = map.latLngToContainerPoint([place.location.lat, place.location.lng]);
    var left = rect.left + pt.x + 14;
    var top = rect.top + pt.y - 20;
    // 邊界保護：避免卡片超出畫面。
    left = Math.max(8, Math.min(left, window.innerWidth - 320));
    top = Math.max(8, Math.min(top, window.innerHeight - 200));

    var p = els.preview;
    p.style.position = "fixed";
    p.style.left = left + "px";
    p.style.top = top + "px";
    p.style.right = "auto";
    p.style.bottom = "auto";
    p.style.width = "300px";
    p.style.zIndex = "1000";
    p.innerHTML = renderPreview(place, isPinned(place.id));
    wirePinButton(place);
    p.hidden = false;
  }

  /* 接上預覽卡裡的「固定／取消固定」按鈕（桌機、手機共用）。 */
  function wirePinButton(place) {
    var btn = els.preview.querySelector(".map-preview__pin");
    if (btn) btn.addEventListener("click", function () { togglePin(place); });
  }

  /* ============================================================
   * 預覽卡（手機底部固定卡 / 桌機浮動卡共用隱藏邏輯）
   * ============================================================ */

  /* 手機：顯示（或更新）底部預覽卡，內容用 renderPreview，並加一個關閉鈕。 */
  function showPreview(place) {
    els.preview.innerHTML =
      '<button type="button" class="map-preview__close" ' +
      'aria-label="關閉">&times;</button>' +
      renderPreview(place, isPinned(place.id));
    var closeBtn = els.preview.querySelector(".map-preview__close");
    if (closeBtn) closeBtn.addEventListener("click", hidePreview);
    wirePinButton(place);
    els.preview.hidden = false;
  }

  /* 收起底部預覽卡。 */
  function hidePreview() {
    if (els.preview) {
      els.preview.hidden = true;
      els.preview.innerHTML = "";
    }
  }

})();

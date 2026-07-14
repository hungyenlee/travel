/*
 * plan.js — 我的行程頁邏輯（台灣散步筆記）
 * ============================================================
 * 職責：
 *   1. 行程管理列：以 <select> 切換行程，支援重新命名／刪除／新增行程
 *      （新建與改名用 inline 輸入，非原生 prompt；刪除用 confirm 二次確認）。
 *   2. 孤兒提示：行程內若有 getPlaceById 找不到的 placeId，頂端顯示提示，
 *      這些孤兒地點不畫在清單與地圖上。
 *   3. 天數選擇列：未分配（day 0）、第1天…第N天、＋加一天；選中某天時可移除該天。
 *      單選，切換即重繪地圖與清單為「該天」。
 *   4. 地圖：只畫選中那天的地點，編號標記（divIcon）；標記與卡片雙向高亮。
 *   5. 清單：該天地點卡（自組，不用 renderCard），可改天／移除。
 *
 * 重要原則：資料存取／網址組合／轉義／地圖低階工具，一律使用 shared.js 既有函式；
 *   行程資料的增刪改查一律透過 TripStore。本檔不重造輪子、不碰 style.css。
 * 載入順序：Leaflet → data.js → shared.js → trip-store.js → 本檔（見 plan.html）。
 */

(function () {
  "use strict";

  /* ---------- 頁面層級狀態 ---------- */
  var currentTripId = null; // 目前檢視中的行程 id
  var selectedDay = 0;      // 目前選中的天（0 = 未分配；1..N = 第 N 天）
  var map = null;           // Leaflet 地圖實例（延後到需要時才建立）
  var markerLayer = null;   // 標記圖層（每次重繪整層清空）
  var markersById = {};     // placeId → Leaflet marker，供卡片點擊時對應
  var colors = null;        // 標記顏色（讀 CSS 變數）

  /* 重新命名的 inline 編輯狀態：true 時，行程管理列渲染成輸入框。 */
  var renaming = false;

  /* 常用 DOM 節點 */
  var els = {};

  /* ============================================================
   * 進入點
   * ============================================================ */
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheEls();
    colors = getMarkerColors();

    // 決定目前行程：優先用上次檢視的，沒有就選第一個。
    currentTripId = TripStore.getCurrentTripId();
    var trips = TripStore.getAll();
    if (!currentTripId || !TripStore.getTrip(currentTripId)) {
      currentTripId = trips.length ? trips[0].id : null;
      TripStore.setCurrentTripId(currentTripId);
    }

    renderAll();
  }

  /* 快取常用 DOM 節點。 */
  function cacheEls() {
    els.pageTitle = document.getElementById("page-title");
    els.manager = document.getElementById("trip-manager");
    els.orphanSlot = document.getElementById("orphan-slot");
    els.dayTabs = document.getElementById("day-tabs");
    els.mapEl = document.getElementById("plan-map");
    els.list = document.getElementById("plan-list");
  }

  /* ============================================================
   * 整體重繪（切換行程／天數／增減地點後都呼叫）
   * ============================================================ */
  function renderAll() {
    renderManager();

    var trip = currentTripId ? TripStore.getTrip(currentTripId) : null;

    // 沒有任何行程：顯示空狀態＋建立輸入，其餘區塊清空並收起地圖。
    if (!trip) {
      renderEmptyTrips();
      syncSidebar();
      return;
    }

    // 選中的天若超出目前天數（例如剛移除天），夾回未分配。
    if (selectedDay > trip.days) selectedDay = 0;

    renderOrphanWarning(trip);
    renderDayTabs(trip);

    var dayPlaces = getPlacesForDay(trip, selectedDay); // 該天的有效地點（已濾掉孤兒）
    renderList(trip, dayPlaces);
    renderMap(dayPlaces);

    syncSidebar();
  }

  /* 行程資料變動後，通知側邊欄重繪行程清單與高亮（側邊欄未載入時忽略）。 */
  function syncSidebar() {
    if (window.Sidebar && typeof window.Sidebar.refresh === "function") {
      window.Sidebar.refresh();
    }
  }

  /* ============================================================
   * 行程管理列
   * ============================================================ */

  /* 依目前狀態（正常／改名中）渲染行程管理列。
   * 標題顯示目前行程名稱；切換／建立行程改由側邊欄清單負責。 */
  function renderManager() {
    var trips = TripStore.getAll();
    var cur = currentTripId ? TripStore.getTrip(currentTripId) : null;

    // 頁面標題＝目前行程名稱（無行程時用通用標題）。
    if (els.pageTitle) els.pageTitle.textContent = cur ? cur.name : "我的行程";

    // 沒有行程時，管理列清空，交由 renderEmptyTrips 處理。
    if (!trips.length || !cur) {
      els.manager.innerHTML = "";
      return;
    }

    // 改名中：顯示 inline 輸入框（預填目前名稱）＋確定／取消。
    if (renaming) {
      els.manager.innerHTML =
        '<div class="trip-manager__edit">' +
          '<input type="text" class="trip-manager__input" id="trip-rename-input" ' +
            'value="' + escapeHtml(cur.name) + '" maxlength="40">' +
          '<button type="button" class="btn btn--primary" id="trip-rename-ok">確定</button>' +
          '<button type="button" class="btn" id="trip-rename-cancel">取消</button>' +
        '</div>';
      wireRename();
      focusInput("trip-rename-input");
      return;
    }

    // 正常狀態：重新命名／刪除（切換與建立行程都在側邊欄）。
    els.manager.innerHTML =
      '<button type="button" class="btn" id="trip-rename">重新命名</button>' +
      '<button type="button" class="btn" id="trip-delete">刪除</button>';

    wireManager();
  }

  /* 掛上行程管理列（正常狀態）的事件。 */
  function wireManager() {
    var renameBtn = document.getElementById("trip-rename");
    if (renameBtn) renameBtn.addEventListener("click", function () {
      renaming = true;
      renderManager();
    });

    var deleteBtn = document.getElementById("trip-delete");
    if (deleteBtn) deleteBtn.addEventListener("click", function () {
      var cur = TripStore.getTrip(currentTripId);
      var name = cur ? cur.name : "";
      if (window.confirm("確定刪除行程「" + name + "」？此動作無法復原。")) {
        TripStore.deleteTrip(currentTripId);
        currentTripId = TripStore.getCurrentTripId();
        selectedDay = 0;
        renderAll();
      }
    });
  }

  /* 掛上「重新命名」inline 輸入的事件（確定／取消／Enter／Esc）。 */
  function wireRename() {
    var input = document.getElementById("trip-rename-input");
    var ok = document.getElementById("trip-rename-ok");
    var cancel = document.getElementById("trip-rename-cancel");

    function commit() {
      var name = input ? input.value.trim() : "";
      if (name) TripStore.renameTrip(currentTripId, name); // 空白則 TripStore 忽略
      renaming = false;
      renderAll();
    }
    function abort() {
      renaming = false;
      renderManager();
    }

    if (ok) ok.addEventListener("click", commit);
    if (cancel) cancel.addEventListener("click", abort);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); abort(); }
    });
  }

  /* 掛上「建立新行程」inline 輸入的事件（可重用於空狀態的建立框）。
   * onDone 在取消或建立後、重繪前呼叫，用來清掉相關的編輯旗標。 */
  function wireCreate(inputId, okId, cancelId, onDone) {
    var input = document.getElementById(inputId);
    var ok = document.getElementById(okId);
    var cancel = document.getElementById(cancelId);

    function commit() {
      var name = input ? input.value.trim() : "";
      // 名稱空白時 TripStore.createTrip 會給預設名，仍可建立。
      var trip = TripStore.createTrip(name);
      currentTripId = trip.id; // createTrip 已設為 current，這裡同步本地狀態
      selectedDay = 0;
      if (onDone) onDone();
      renderAll();
    }
    function abort() {
      if (onDone) onDone();
      renderAll();
    }

    if (ok) ok.addEventListener("click", commit);
    if (cancel) cancel.addEventListener("click", abort);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); abort(); }
    });
  }

  /* 沒有任何行程時的畫面：空狀態訊息＋建立輸入框。 */
  function renderEmptyTrips() {
    els.manager.innerHTML = "";
    els.orphanSlot.innerHTML = "";
    els.dayTabs.innerHTML = "";
    clearMap();

    els.list.innerHTML =
      '<div class="empty-state">' +
        "<p>還沒有行程，建立第一個吧</p>" +
        '<div class="trip-manager__edit">' +
          '<input type="text" class="trip-manager__input" id="trip-create-input" ' +
            'placeholder="輸入行程名稱" maxlength="40">' +
          '<button type="button" class="btn btn--primary" id="trip-create-ok">建立</button>' +
        '</div>' +
      "</div>";

    // 空狀態沒有「取消」鈕，塞一顆隱藏的假 cancel 以重用 wireCreate 亦可，
    // 但更簡單：直接接 input/ok，這裡用 wireCreate 並容忍 cancel 不存在。
    wireCreate("trip-create-input", "trip-create-ok", "trip-create-cancel-nonexistent", null);
    focusInput("trip-create-input");
  }

  /* ============================================================
   * 孤兒提示
   * ============================================================ */

  /* 計算行程中 getPlaceById 找不到的地點數；N>0 時頂端顯示 .data-warning。 */
  function renderOrphanWarning(trip) {
    var n = 0;
    trip.items.forEach(function (it) {
      if (!getPlaceById(it.placeId)) n++;
    });
    if (n > 0) {
      els.orphanSlot.innerHTML =
        '<div class="data-warning">有 ' + n + " 個地點已不存在，已略過</div>";
    } else {
      els.orphanSlot.innerHTML = "";
    }
  }

  /* ============================================================
   * 天數選擇列
   * ============================================================ */

  /* 產生天數選擇列：未分配、第1天…第N天、＋加一天；選中某天時加「移除這天」。 */
  function renderDayTabs(trip) {
    var html = "";

    // 未分配（day 0）
    html += dayTabHtml(0, "未分配");
    // 第 1..N 天
    for (var d = 1; d <= trip.days; d++) {
      html += dayTabHtml(d, "第" + d + "天");
    }
    // ＋ 加一天
    html += '<button type="button" class="day-tab day-tab--add" id="day-add">＋ 加一天</button>';
    // 選中的是「第 N 天」時，顯示移除這天
    if (selectedDay >= 1) {
      html += '<button type="button" class="day-tab day-tab--remove" id="day-remove">移除這天</button>';
    }

    els.dayTabs.innerHTML = html;
    wireDayTabs();
  }

  /* 單顆天數按鈕的 HTML（選中加 is-active）。 */
  function dayTabHtml(day, label) {
    var active = day === selectedDay ? " is-active" : "";
    return '<button type="button" class="day-tab' + active + '" data-day="' + day + '">' +
      escapeHtml(label) + "</button>";
  }

  /* 掛上天數選擇列事件。 */
  function wireDayTabs() {
    var tabs = els.dayTabs.querySelectorAll(".day-tab[data-day]");
    Array.prototype.forEach.call(tabs, function (t) {
      t.addEventListener("click", function () {
        selectedDay = parseInt(t.getAttribute("data-day"), 10) || 0;
        renderAll();
      });
    });

    var addBtn = document.getElementById("day-add");
    if (addBtn) addBtn.addEventListener("click", function () {
      var newDays = TripStore.addDay(currentTripId);
      selectedDay = newDays; // 新增後自動跳到新的那天
      renderAll();
    });

    var removeBtn = document.getElementById("day-remove");
    if (removeBtn) removeBtn.addEventListener("click", function () {
      TripStore.removeDay(currentTripId, selectedDay);
      selectedDay = 0; // 移除後回到未分配（該天地點已退回未分配）
      renderAll();
    });
  }

  /* ============================================================
   * 該天地點的計算
   * ============================================================ */

  /* 取某天的有效地點（保序、濾掉孤兒），回傳 place 物件陣列。 */
  function getPlacesForDay(trip, day) {
    var out = [];
    trip.items.forEach(function (it) {
      if (it.day !== day) return;
      var place = getPlaceById(it.placeId);
      if (place) out.push(place); // 孤兒（找不到）靜默略過
    });
    return out;
  }

  /* ============================================================
   * 清單
   * ============================================================ */

  /* 渲染該天的地點卡片列表；空則顯示空狀態。 */
  function renderList(trip, dayPlaces) {
    if (!dayPlaces.length) {
      els.list.innerHTML =
        '<div class="empty-state"><p>這天還沒有地點</p></div>';
      return;
    }

    els.list.innerHTML = dayPlaces.map(function (place, idx) {
      return planCardHtml(trip, place, idx + 1); // 序號 1 起
    }).join("");

    wireList(trip);
  }

  /* 單張行程卡片 HTML（自組，不用 renderCard）。
   * num：清單序號（與地圖標記編號一致）。 */
  function planCardHtml(trip, place, num) {
    var meta = escapeHtml(getCityName(place.city)) + "・" + escapeHtml(place.district);
    var url = detailUrl(place.id);

    // 「移到某天」下拉：未分配／第1天…第N天，當前 day 為選中值。
    var itemDay = getItemDay(trip, place.id);
    var moveOptions = '<option value="0"' + (itemDay === 0 ? " selected" : "") + ">未分配</option>";
    for (var d = 1; d <= trip.days; d++) {
      moveOptions += '<option value="' + d + '"' + (itemDay === d ? " selected" : "") + ">第" + d + "天</option>";
    }

    return '' +
      '<div class="plan-card" data-place-id="' + escapeHtml(place.id) + '">' +
        '<span class="plan-card__num">' + num + "</span>" +
        '<a class="plan-card__link" href="' + url + '">' +
          imageTag(place, "plan-card__img") +
        "</a>" +
        '<div class="plan-card__body">' +
          '<a class="plan-card__title" href="' + url + '">' + escapeHtml(place.name) + "</a>" +
          '<div class="plan-card__meta">' + meta + "</div>" +
          '<div class="plan-card__controls">' +
            '<select class="plan-card__move">' + moveOptions + "</select>" +
            '<button type="button" class="plan-card__remove">移除</button>' +
          "</div>" +
        "</div>" +
      "</div>";
  }

  /* 取某地點在此行程中目前的 day（找不到回 0）。 */
  function getItemDay(trip, placeId) {
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].placeId === placeId) return trip.items[i].day;
    }
    return 0;
  }

  /* 掛上清單卡片事件（改天／移除／點卡片高亮對應標記）。 */
  function wireList(trip) {
    var cards = els.list.querySelectorAll(".plan-card");
    Array.prototype.forEach.call(cards, function (card) {
      var placeId = card.getAttribute("data-place-id");

      // 改天：setPlaceDay 後重繪（地點可能因此離開目前這天）。
      var moveSel = card.querySelector(".plan-card__move");
      if (moveSel) moveSel.addEventListener("change", function () {
        var day = parseInt(moveSel.value, 10) || 0;
        TripStore.setPlaceDay(currentTripId, placeId, day);
        renderAll();
      });

      // 移除：removePlace 後重繪。
      var removeBtn = card.querySelector(".plan-card__remove");
      if (removeBtn) removeBtn.addEventListener("click", function () {
        TripStore.removePlace(currentTripId, placeId);
        renderAll();
      });

      // 點卡片（非控制項）→ 對應標記 pan 置中並短暫高亮。
      card.addEventListener("click", function (e) {
        // 點到下拉、移除鈕、連結時不觸發（讓它們各自的行為生效）。
        if (e.target.closest(".plan-card__move") ||
            e.target.closest(".plan-card__remove") ||
            e.target.closest("a")) return;
        focusMarker(placeId);
      });
    });
  }

  /* ============================================================
   * 地圖
   * ============================================================ */

  /* 渲染地圖：只畫選中那天的地點，編號標記；空則顯示簡短訊息。 */
  function renderMap(dayPlaces) {
    // 該天沒有地點：清掉標記，收起地圖容器並改顯示簡短訊息（不建地圖以省資源）。
    // 注意：不可對 #plan-map 覆寫 innerHTML——那會洗掉已初始化的 Leaflet DOM，
    // 導致之後切回「有地點」時地圖壞掉；改用獨立的訊息節點來切換。
    if (!dayPlaces.length) {
      clearMap();
      showMapMessage("這天還沒有地點，加入後會顯示在地圖上");
      return;
    }

    // 有地點：先收起訊息、還原地圖容器，再確保地圖已建立。
    hideMapMessage();
    ensureMap();

    markerLayer.clearLayers();
    markersById = {};

    var latlngs = [];
    dayPlaces.forEach(function (place, idx) {
      var latlng = [place.location.lat, place.location.lng];
      latlngs.push(latlng);

      var typeCls = isAttraction(place) ? "plan-marker--attraction" : "plan-marker--restaurant";
      var icon = L.divIcon({
        className: "plan-marker-wrap", // 外層 class，避免 Leaflet 預設樣式干擾
        html: '<div class="plan-marker ' + typeCls + '">' + (idx + 1) + "</div>",
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      var marker = L.marker(latlng, { icon: icon }).addTo(markerLayer);
      markersById[place.id] = marker;

      // 點標記 → 對應清單卡高亮並捲入可視。
      marker.on("click", function () {
        highlightCard(place.id, true);
      });
    });

    // 框住這天所有地點。
    fitMapToLatLngs(map, latlngs);
    // 地圖容器尺寸可能在 hidden→顯示或首次建立後才確定，強制重新計算。
    setTimeout(function () { if (map) map.invalidateSize(); }, 0);
  }

  /* 確保地圖與圖層已建立（延後到第一次有地點時才建，避免對空容器初始化）。 */
  function ensureMap() {
    if (map) return;
    els.mapEl.innerHTML = ""; // 清掉可能殘留的訊息節點
    map = createBaseMap("plan-map");
    markerLayer = L.layerGroup().addTo(map);
  }

  /* 清掉地圖標記與對應表（保留地圖實例本身）。 */
  function clearMap() {
    if (markerLayer) markerLayer.clearLayers();
    markersById = {};
  }

  /* 顯示「該天無地點」訊息：把地圖容器收起，改秀一個獨立的訊息節點
   * （放在地圖容器旁，絕不動 #plan-map 本身的內容，以免破壞 Leaflet）。 */
  function showMapMessage(text) {
    els.mapEl.style.display = "none";
    if (!els.mapMsg) {
      els.mapMsg = document.createElement("div");
      els.mapMsg.className = "map plan-map__msg";
      els.mapEl.parentNode.insertBefore(els.mapMsg, els.mapEl.nextSibling);
    }
    els.mapMsg.textContent = text;
    els.mapMsg.style.display = "";
  }

  /* 收起訊息、還原地圖容器顯示。 */
  function hideMapMessage() {
    els.mapEl.style.display = "";
    if (els.mapMsg) els.mapMsg.style.display = "none";
  }

  /* 點清單卡 → 對應標記 pan 進中心並短暫高亮。 */
  function focusMarker(placeId) {
    var marker = markersById[placeId];
    if (!marker || !map) return;
    map.panTo(marker.getLatLng());
    // 短暫高亮標記本身（透過其 DOM 元素）。
    var el = marker.getElement();
    if (el) {
      var dot = el.querySelector(".plan-marker");
      if (dot) {
        dot.classList.add("is-active");
        setTimeout(function () { dot.classList.remove("is-active"); }, 1200);
      }
    }
  }

  /* 高亮某地點對應的清單卡並捲入可視；scroll=true 時捲動。 */
  function highlightCard(placeId, scroll) {
    var cards = els.list.querySelectorAll(".plan-card");
    Array.prototype.forEach.call(cards, function (card) {
      var match = card.getAttribute("data-place-id") === placeId;
      card.classList.toggle("is-active", match);
      if (match && scroll && card.scrollIntoView) {
        card.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    });
    // 一段時間後移除高亮，避免長期停留。
    if (scroll) {
      setTimeout(function () {
        var active = els.list.querySelector('.plan-card[data-place-id="' + cssEscape(placeId) + '"].is-active');
        if (active) active.classList.remove("is-active");
      }, 1600);
    }
  }

  /* 供 querySelector 使用的簡易屬性值轉義（placeId 只含 [a-z0-9-]，
   * 但仍以 CSS.escape 為優先，退回原字串）。 */
  function cssEscape(s) {
    if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(s);
    return s;
  }

  /* ============================================================
   * 小工具
   * ============================================================ */

  /* 讓某輸入框取得焦點並把游標移到末端（inline 編輯體驗）。 */
  function focusInput(id) {
    // 延後到 DOM 更新後再 focus。
    setTimeout(function () {
      var input = document.getElementById(id);
      if (input) {
        input.focus();
        var v = input.value;
        input.value = "";
        input.value = v; // 重設值把游標推到末端
      }
    }, 0);
  }

  /* ============================================================
   * 對外 hook：供側邊欄在「行程頁」就地切換行程（免整頁重載）。
   * 側邊欄偵測到此物件時，改呼叫這裡而非導向 plan.html。
   * ============================================================ */
  window.PlanPage = {
    selectTrip: function (tripId) {
      currentTripId = tripId;
      TripStore.setCurrentTripId(tripId);
      selectedDay = 0; // 換行程回到未分配
      renderAll();
    }
  };

})();

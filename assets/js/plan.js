/*
 * plan.js — 我的行程頁邏輯（台灣散步筆記）
 * ============================================================
 * 本頁分兩層，依網址 ?trip=<id> 切換：
 *   · 無 ?trip → 總覽層：列出所有行程卡片（名稱＋「N 天 · M 個地點」）＋建立新行程；
 *     點卡片進該行程規劃層，點「建立」後直接進新行程規劃層（?new=1 自動開建立）。
 *   · 有 ?trip → 規劃層（下列 1–5），頂部有「← 我的行程」返回總覽。
 * 職責（規劃層）：
 *   1. 行程管理列：標題＝行程名，支援重新命名／刪除（改名用 inline 輸入，非原生 prompt；
 *      刪除用 confirm 二次確認後回總覽）。切換與建立行程改由側邊欄／總覽負責。
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
  var currentTripId = null; // 規劃層目前檢視中的行程 id
  var selectedDay = 0;      // 目前選中的天（0 = 未分配；1..N = 第 N 天）
  var map = null;           // Leaflet 地圖實例（延後到需要時才建立）
  var markerLayer = null;   // 標記圖層（每次重繪整層清空）
  var markersById = {};     // placeId → Leaflet marker，供卡片點擊時對應
  var colors = null;        // 標記顏色（讀 CSS 變數）

  /* 重新命名的 inline 編輯狀態：true 時，行程管理列渲染成輸入框。 */
  var renaming = false;
  /* 總覽層「建立新行程」的 inline 編輯狀態。 */
  var overviewCreating = false;

  /* 折疊起來的天（記憶體狀態，不寫 localStorage）：key = 天號字串。 */
  var collapsedDays = {};
  /* selectedDay 是否已由使用者/初始化明確設定過（避免每次重繪都重挑預設天）。 */
  var dayInitialized = false;
  /* 目前展開 ⋯ 選單的卡片 placeId（同時只開一個）。 */
  var openMenuPlaceId = null;
  /* 拖曳進行中的狀態（見 §拖曳排序）；非拖曳時為 null。 */
  var drag = null;

  /* 常用 DOM 節點 */
  var els = {};

  /* ============================================================
   * 進入點：依網址 ?trip=<id> 決定「規劃層」或「總覽層」
   *   · ?trip=<有效 id> → 規劃層（該行程的天數／地圖／清單）。
   *   · ?trip=<無效 id> → 退回總覽。
   *   · 無 ?trip        → 總覽層（列出所有行程）；?new=1 自動開建立。
   * ============================================================ */
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheEls();
    colors = getMarkerColors();

    // 點卡片選單以外的地方 → 收起所有 ⋯ 選單（拖曳中不干擾）。
    document.addEventListener("click", function (e) {
      if (drag) return;
      if (!openMenuPlaceId) return;
      if (e.target.closest && (e.target.closest(".plan-card__menu") ||
          e.target.closest(".plan-card__menu-btn") ||
          e.target.closest(".plan-card__handle"))) return;
      closeAllMenus();
    });

    var tripParam = getQueryParam("trip");
    if (tripParam) {
      if (TripStore.getTrip(tripParam)) {
        currentTripId = tripParam;
        TripStore.setCurrentTripId(tripParam); // 記住上次檢視
        renderPlan();
      } else {
        // 指定行程不存在（可能已刪除）→ 退回總覽，清掉網址參數
        window.location.replace("plan.html");
      }
      return;
    }

    // 無 ?trip → 總覽層
    renderOverview();
    if (getQueryParam("new")) openOverviewCreate();
  }

  /* 快取常用 DOM 節點。 */
  function cacheEls() {
    els.back = document.getElementById("plan-back");
    els.pageTitle = document.getElementById("page-title");
    els.manager = document.getElementById("trip-manager");
    els.orphanSlot = document.getElementById("orphan-slot");
    els.overview = document.getElementById("trip-overview");
    els.layout = document.getElementById("plan-layout");
    els.mapEl = document.getElementById("plan-map");
    els.list = document.getElementById("plan-list");
  }

  /* 切換「規劃層」相關區塊的顯示（總覽層時全部收起）。 */
  function showPlanSections(show) {
    if (els.back) els.back.hidden = !show;
    if (els.manager) els.manager.hidden = !show;
    if (els.orphanSlot) els.orphanSlot.hidden = !show;
    if (els.layout) els.layout.hidden = !show;
  }

  /* 行程資料變動後，通知側邊欄重建 flyout（側邊欄未載入時忽略）。 */
  function syncSidebar() {
    if (window.Sidebar && typeof window.Sidebar.refresh === "function") {
      window.Sidebar.refresh();
    }
  }

  /* ============================================================
   * 總覽層：列出所有行程卡片＋建立新行程
   * ============================================================ */
  function renderOverview() {
    showPlanSections(false);
    if (els.overview) els.overview.hidden = false;
    if (els.pageTitle) els.pageTitle.textContent = "我的行程";

    var trips = TripStore.getAll();
    var sub = trips.length
      ? "選一個行程開始規劃，或建立新的。"
      : "還沒有行程，建立第一個吧。";

    var cards = trips.map(overviewCardHtml).join("");
    var newCell = overviewCreating
      ? '<div class="trip-overview__new-form">' +
          '<input type="text" class="trip-overview__new-input" id="overview-new-input" ' +
            'placeholder="行程名稱" maxlength="40">' +
          '<button type="button" class="btn btn--primary" id="overview-new-ok">建立</button>' +
          '<button type="button" class="btn" id="overview-new-cancel">取消</button>' +
        '</div>'
      : '<button type="button" class="trip-overview__new" id="overview-new">＋ 建立新行程</button>';

    els.overview.innerHTML =
      '<p class="trip-overview__sub">' + sub + "</p>" +
      '<div class="trip-overview__grid">' + cards + newCell + "</div>";

    wireOverview();
    syncSidebar();
  }

  /* 單張行程卡片：名稱＋「N 天 · M 個地點」，整張連到規劃層。 */
  function overviewCardHtml(trip) {
    var placeCount = trip.items.filter(function (it) {
      return getPlaceById(it.placeId); // 只算實際存在的地點（略過孤兒）
    }).length;
    var meta = trip.days + " 天 · " + placeCount + " 個地點";
    return '' +
      '<a class="trip-overview__card" href="plan.html?trip=' +
        encodeURIComponent(trip.id) + '">' +
        '<span class="trip-overview__name">' + escapeHtml(trip.name) + "</span>" +
        '<span class="trip-overview__meta">' + meta + "</span>" +
      "</a>";
  }

  /* 進入「建立新行程」inline 輸入狀態。 */
  function openOverviewCreate() {
    overviewCreating = true;
    renderOverview();
    focusInput("overview-new-input");
  }

  /* 掛總覽層事件（建立卡／建立輸入）。 */
  function wireOverview() {
    var newBtn = document.getElementById("overview-new");
    if (newBtn) newBtn.addEventListener("click", openOverviewCreate);

    var input = document.getElementById("overview-new-input");
    var ok = document.getElementById("overview-new-ok");
    var cancel = document.getElementById("overview-new-cancel");

    function commit() {
      // 名稱空白時 TripStore.createTrip 會給預設名，仍可建立。
      var trip = TripStore.createTrip(input ? input.value : "");
      // 建立後直接進該新行程的規劃層。
      window.location.href = "plan.html?trip=" + encodeURIComponent(trip.id);
    }
    function abort() {
      overviewCreating = false;
      renderOverview();
    }
    if (ok) ok.addEventListener("click", commit);
    if (cancel) cancel.addEventListener("click", abort);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); abort(); }
    });
  }

  /* ============================================================
   * 規劃層：某個行程的天數／地圖／清單（原有功能）
   * ============================================================ */

  /* 進入規劃層：顯示相關區塊後畫出內容。 */
  function renderPlan() {
    if (els.overview) { els.overview.hidden = true; els.overview.innerHTML = ""; }
    showPlanSections(true);
    renderAll();
  }

  /* 規劃層整體重繪（切換天數／增減地點後都呼叫；區塊已在 renderPlan 顯示）。 */
  function renderAll() {
    var trip = currentTripId ? TripStore.getTrip(currentTripId) : null;
    // 行程已不存在（例如剛刪除）→ 退回總覽。
    if (!trip) { window.location.href = "plan.html"; return; }

    renderManager();

    // 選中的天若超出目前天數（例如剛移除天），夾回未分配。
    if (selectedDay > trip.days) selectedDay = 0;
    // 首次進規劃層：地圖預設落在「第一個有地點的天」（都沒有則未分配）。
    if (!dayInitialized) {
      selectedDay = firstNonEmptyDay(trip);
      dayInitialized = true;
    }

    renderOrphanWarning(trip);
    renderSections(trip);

    renderMap(getPlacesForDay(trip, selectedDay)); // 地圖只畫選中那天

    syncSidebar();
  }

  /* 挑一個合理的預設天給地圖：第一個「有地點」的第 N 天；
   * 都沒有時，未分配有地點就選未分配，否則第 1 天（或 0）。 */
  function firstNonEmptyDay(trip) {
    for (var d = 1; d <= trip.days; d++) {
      if (getPlacesForDay(trip, d).length) return d;
    }
    if (getPlacesForDay(trip, 0).length) return 0;
    return trip.days >= 1 ? 1 : 0;
  }

  /* ============================================================
   * 行程管理列
   * ============================================================ */

  /* 規劃層的行程管理列（標題＝行程名稱；重新命名／刪除）。 */
  function renderManager() {
    var cur = TripStore.getTrip(currentTripId);
    if (!cur) return;

    // 頁面標題＝目前行程名稱。
    if (els.pageTitle) els.pageTitle.textContent = cur.name;

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
        // 刪除後回到總覽層。
        window.location.href = "plan.html";
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
   * 分天區塊（清單）
   *   一頁列出所有天：第 1 天…第 N 天、最後是「未分配」。
   *   每段可折疊、可作為拖曳落點；段標題點擊＝把地圖切到那天。
   * ============================================================ */

  /* 產生所有天的區塊到 #plan-list，最後接「＋ 加一天」。 */
  function renderSections(trip) {
    var html = "";
    for (var d = 1; d <= trip.days; d++) {
      html += daySectionHtml(trip, d, "第 " + d + " 天");
    }
    html += daySectionHtml(trip, 0, "未分配");
    html += '<button type="button" class="plan-day-add" id="day-add">＋ 加一天</button>';

    els.list.innerHTML = html;
    wireSections(trip);
  }

  /* 單一天區塊：標題（切換地圖 + 折疊 + 第N天可移除）＋卡片清單＋落點提示。 */
  function daySectionHtml(trip, day, label) {
    var places = getPlacesForDay(trip, day);
    var collapsed = !!collapsedDays[day];
    var selected = day === selectedDay ? " is-selected" : "";

    var cards = places.map(function (place, idx) {
      return planCardHtml(trip, place, idx + 1);
    }).join("");

    // 段內清單（拖曳落點容器）。空段仍保留容器，只是不含卡片。
    var listHtml = '<div class="plan-day__list" data-day="' + day + '">' + cards + "</div>";
    // 落點/空狀態提示：空段顯示「拖曳到此」，非空段作為「拖到末端」的落點。
    var dropHtml = '<div class="plan-day__drop" data-day="' + day + '">' +
      (places.length ? "拖曳到此加入這天末端" : "把地點拖到這天") + "</div>";

    var removeBtn = day >= 1
      ? '<button type="button" class="plan-day__remove" data-day="' + day + '">移除這天</button>'
      : "";

    return '' +
      '<section class="plan-day' + selected + (collapsed ? " is-collapsed" : "") +
        '" data-day="' + day + '">' +
        '<header class="plan-day__head">' +
          '<button type="button" class="plan-day__toggle" data-day="' + day + '" ' +
            'aria-label="折疊/展開這天" aria-expanded="' + (collapsed ? "false" : "true") + '">' +
            '<span class="plan-day__chevron" aria-hidden="true"></span>' +
          "</button>" +
          '<button type="button" class="plan-day__label" data-day="' + day + '" ' +
            'aria-pressed="' + (day === selectedDay ? "true" : "false") + '">' +
            escapeHtml(label) +
            '<span class="plan-day__count">' + places.length + " 個地點</span>" +
          "</button>" +
          removeBtn +
        "</header>" +
        '<div class="plan-day__body">' + listHtml + dropHtml + "</div>" +
      "</section>";
  }

  /* 單張行程卡片 HTML（自組，不用 renderCard）。
   *   握把 ⋮⋮ 為唯一拖曳起點；⋯ 展開備援選單（改天／上下移／移除）。
   *   num：該天內序號（與地圖標記編號一致）。 */
  function planCardHtml(trip, place, num) {
    var meta = escapeHtml(getCityName(place.city)) + "・" + escapeHtml(place.district);
    var url = detailUrl(place.id);
    var itemDay = getItemDay(trip, place.id);
    var menuOpen = openMenuPlaceId === place.id;

    // 「移到某天」下拉：未分配／第1天…第N天。
    var moveOptions = '<option value="0"' + (itemDay === 0 ? " selected" : "") + ">未分配</option>";
    for (var d = 1; d <= trip.days; d++) {
      moveOptions += '<option value="' + d + '"' + (itemDay === d ? " selected" : "") +
        ">第 " + d + " 天</option>";
    }

    return '' +
      '<div class="plan-card" data-place-id="' + escapeHtml(place.id) + '" ' +
        'data-day="' + itemDay + '">' +
        '<button type="button" class="plan-card__handle" aria-label="拖曳排序：' +
          escapeHtml(place.name) + '" title="拖曳排序">' + gripSvg() + "</button>" +
        '<span class="plan-card__num">' + num + "</span>" +
        '<a class="plan-card__link" href="' + url + '">' +
          imageTag(place, "plan-card__img") +
        "</a>" +
        '<div class="plan-card__body">' +
          '<a class="plan-card__title" href="' + url + '">' + escapeHtml(place.name) + "</a>" +
          '<div class="plan-card__meta">' + meta + "</div>" +
        "</div>" +
        '<button type="button" class="plan-card__menu-btn" aria-label="更多操作" ' +
          'aria-expanded="' + (menuOpen ? "true" : "false") + '">⋯</button>' +
        '<div class="plan-card__menu"' + (menuOpen ? "" : " hidden") + '>' +
          '<label class="plan-card__move-label">移到' +
            '<select class="plan-card__move">' + moveOptions + "</select>" +
          "</label>" +
          '<div class="plan-card__menu-row">' +
            '<button type="button" class="plan-card__up">上移</button>' +
            '<button type="button" class="plan-card__down">下移</button>' +
            '<button type="button" class="plan-card__remove">移除</button>' +
          "</div>" +
        "</div>" +
      "</div>";
  }

  /* 拖曳握把的六點 grip 圖示（內嵌 SVG，隨字色）。 */
  function gripSvg() {
    return '<svg viewBox="0 0 16 16" width="14" height="16" aria-hidden="true" ' +
      'focusable="false"><g fill="currentColor">' +
      '<circle cx="5.5" cy="3.5" r="1.4"/><circle cx="10.5" cy="3.5" r="1.4"/>' +
      '<circle cx="5.5" cy="8" r="1.4"/><circle cx="10.5" cy="8" r="1.4"/>' +
      '<circle cx="5.5" cy="12.5" r="1.4"/><circle cx="10.5" cy="12.5" r="1.4"/>' +
      "</g></svg>";
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

  /* 取某地點在此行程中目前的 day（找不到回 0）。 */
  function getItemDay(trip, placeId) {
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].placeId === placeId) return trip.items[i].day;
    }
    return 0;
  }

  /* 掛上分天區塊的所有事件：段標題切換地圖／折疊／移除天／加一天，
   * 以及每張卡片的握把拖曳、⋯ 選單、點卡片高亮標記。 */
  function wireSections(trip) {
    // 段標題點擊 → 把地圖切到那天。
    forEachEl(".plan-day__label", function (el) {
      el.addEventListener("click", function () {
        selectDay(parseInt(el.getAttribute("data-day"), 10) || 0);
      });
    });

    // 折疊/展開這天。
    forEachEl(".plan-day__toggle", function (el) {
      el.addEventListener("click", function () {
        toggleCollapse(parseInt(el.getAttribute("data-day"), 10) || 0);
      });
    });

    // 移除這天（沿用 TripStore.removeDay：該天地點退回未分配、後續天連號前移）。
    forEachEl(".plan-day__remove", function (el) {
      el.addEventListener("click", function () {
        var day = parseInt(el.getAttribute("data-day"), 10) || 0;
        TripStore.removeDay(currentTripId, day);
        if (selectedDay === day) selectedDay = 0;
        else if (selectedDay > day) selectedDay -= 1;
        renderAll();
      });
    });

    // ＋ 加一天。
    var addBtn = document.getElementById("day-add");
    if (addBtn) addBtn.addEventListener("click", function () {
      var newDays = TripStore.addDay(currentTripId);
      selectedDay = newDays; // 新增後把地圖切到新的那天
      renderAll();
    });

    // 每張卡片。
    forEachEl(".plan-card", function (card) {
      var placeId = card.getAttribute("data-place-id");

      // 握把 → 拖曳（滑鼠／觸控長按；鍵盤走 ⋯ 選單）。
      var handle = card.querySelector(".plan-card__handle");
      if (handle) {
        handle.addEventListener("pointerdown", function (e) {
          onHandleDown(e, card, placeId);
        });
        // 鍵盤（Enter/Space 觸發 click）：以 ⋯ 選單作為等效的重排入口。
        handle.addEventListener("click", function () {
          if (justDragged) return;
          toggleMenu(card, placeId);
        });
      }

      // ⋯ 開關備援選單。
      var menuBtn = card.querySelector(".plan-card__menu-btn");
      if (menuBtn) menuBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        toggleMenu(card, placeId);
      });

      // 改天（移到某天末端）。
      var moveSel = card.querySelector(".plan-card__move");
      if (moveSel) moveSel.addEventListener("change", function () {
        var day = parseInt(moveSel.value, 10) || 0;
        TripStore.moveItem(currentTripId, placeId, day, Number.MAX_SAFE_INTEGER);
        selectedDay = day;
        renderAll();
      });

      // 上移／下移（同天內；也是鍵盤/無障礙的重排路徑）。
      var upBtn = card.querySelector(".plan-card__up");
      if (upBtn) upBtn.addEventListener("click", function () { nudgeCard(card, placeId, -1); });
      var downBtn = card.querySelector(".plan-card__down");
      if (downBtn) downBtn.addEventListener("click", function () { nudgeCard(card, placeId, +1); });

      // 移除。
      var removeBtn = card.querySelector(".plan-card__remove");
      if (removeBtn) removeBtn.addEventListener("click", function () {
        TripStore.removePlace(currentTripId, placeId);
        renderAll();
      });

      // 點卡片本體（非控制項）→ 切到該天並高亮對應標記。
      card.addEventListener("click", function (e) {
        if (e.target.closest(".plan-card__handle") ||
            e.target.closest(".plan-card__menu-btn") ||
            e.target.closest(".plan-card__menu") ||
            e.target.closest("a")) return;
        var day = parseInt(card.getAttribute("data-day"), 10) || 0;
        if (day !== selectedDay) selectDay(day);
        focusMarker(placeId);
      });
    });
  }

  /* 把地圖切到第 day 天（輕量：只更新段標題選中狀態＋重畫地圖，不重建清單）。 */
  function selectDay(day) {
    if (day === selectedDay) return;
    selectedDay = day;
    var trip = TripStore.getTrip(currentTripId);
    if (!trip) return;
    forEachEl(".plan-day", function (sec) {
      var d = parseInt(sec.getAttribute("data-day"), 10) || 0;
      var on = d === selectedDay;
      sec.classList.toggle("is-selected", on);
      var label = sec.querySelector(".plan-day__label");
      if (label) label.setAttribute("aria-pressed", on ? "true" : "false");
    });
    renderMap(getPlacesForDay(trip, selectedDay));
  }

  /* 折疊/展開某天（純視覺；狀態記在 collapsedDays）。 */
  function toggleCollapse(day) {
    if (collapsedDays[day]) delete collapsedDays[day];
    else collapsedDays[day] = true;
    var sec = els.list.querySelector('.plan-day[data-day="' + day + '"]');
    if (!sec) return;
    var collapsed = !!collapsedDays[day];
    sec.classList.toggle("is-collapsed", collapsed);
    var tog = sec.querySelector(".plan-day__toggle");
    if (tog) tog.setAttribute("aria-expanded", collapsed ? "false" : "true");
  }

  /* 同天內上/下移一格（dir = -1 上、+1 下）。以 ⋯ 選單提供鍵盤等效重排。 */
  function nudgeCard(card, placeId, dir) {
    var list = card.parentNode; // .plan-day__list
    if (!list) return;
    var day = parseInt(list.getAttribute("data-day"), 10) || 0;
    var siblings = Array.prototype.slice.call(list.querySelectorAll(".plan-card"));
    var idx = siblings.indexOf(card);
    var target = idx + dir;
    if (target < 0 || target >= siblings.length) return; // 已在端點
    TripStore.moveItem(currentTripId, placeId, day, target);
    selectedDay = day;
    renderAll();
  }

  /* ============================================================
   * ⋯ 備援選單
   * ============================================================ */

  /* 開/關某卡片的 ⋯ 選單（同時只留一個開著）。 */
  function toggleMenu(card, placeId) {
    var menu = card.querySelector(".plan-card__menu");
    var btn = card.querySelector(".plan-card__menu-btn");
    if (!menu || !btn) return;
    var willOpen = menu.hasAttribute("hidden");
    closeAllMenus();
    if (willOpen) {
      menu.removeAttribute("hidden");
      btn.setAttribute("aria-expanded", "true");
      openMenuPlaceId = placeId;
    }
  }

  /* 收起所有 ⋯ 選單。 */
  function closeAllMenus() {
    forEachEl(".plan-card__menu", function (m) { m.setAttribute("hidden", ""); });
    forEachEl(".plan-card__menu-btn", function (b) { b.setAttribute("aria-expanded", "false"); });
    openMenuPlaceId = null;
  }

  /* ============================================================
   * 拖曳排序（原生 Pointer Events；滑鼠＋觸控通吃，不引外部套件）
   *   握把按下後：滑鼠移動 >5px 或觸控長按 200ms 才啟動拖曳；
   *   拖曳中被拖卡片本身即為佔位（.is-dragging），另有浮動 ghost 跟隨指標；
   *   放下時依卡片在 DOM 的落點算出 (day, index) 呼叫 TripStore.moveItem。
   * ============================================================ */

  var justDragged = false; // 剛結束拖曳：抑制握把的 click（避免誤開選單）

  /* 握把 pointerdown：先掛監聽，依裝置決定啟動時機。 */
  function onHandleDown(e, card, placeId) {
    if (e.button != null && e.button !== 0) return; // 只認主鍵
    if (drag) return;                                // 已在拖另一張
    closeAllMenus();

    var isTouch = e.pointerType === "touch";
    var pointerId = e.pointerId;
    var handle = e.currentTarget;
    var startX = e.clientX, startY = e.clientY;
    var started = false;
    var longPress = null;

    function begin() {
      if (started) return;
      started = true;
      beginDrag(card, placeId, startX, startY);
    }
    function onMove(ev) {
      if (ev.pointerId !== pointerId) return;
      if (!started) {
        var dx = ev.clientX - startX, dy = ev.clientY - startY;
        if (isTouch) {
          // 長按前移動過大 → 視為頁面捲動，放棄拖曳
          if (Math.abs(dx) > 8 || Math.abs(dy) > 8) { detach(); }
          return;
        }
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) begin();
      }
      if (started) { ev.preventDefault(); dragMove(ev.clientX, ev.clientY); }
    }
    function onUp(ev) {
      if (ev.pointerId !== pointerId) return;
      detach();
      if (started) dragDrop();
    }
    function onCancel(ev) {
      if (ev.pointerId !== pointerId) return;
      detach();
      if (started) dragAbort();
    }
    function detach() {
      clearTimeout(longPress);
      document.removeEventListener("pointermove", onMove, true);
      document.removeEventListener("pointerup", onUp, true);
      document.removeEventListener("pointercancel", onCancel, true);
      try { handle.releasePointerCapture(pointerId); } catch (_) {}
    }

    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", onUp, true);
    document.addEventListener("pointercancel", onCancel, true);
    try { handle.setPointerCapture(pointerId); } catch (_) {}

    if (isTouch) longPress = setTimeout(begin, 200);
    e.preventDefault(); // 避免握把上觸發選字／原生長按選單
  }

  /* 啟動拖曳：建立浮動 ghost、把原卡標記為佔位、開自動捲動迴圈。 */
  function beginDrag(card, placeId, x, y) {
    var rect = card.getBoundingClientRect();
    var ghost = card.cloneNode(true);
    ghost.classList.add("plan-card--ghost");
    ghost.removeAttribute("data-place-id");
    ghost.style.width = rect.width + "px";
    ghost.style.left = rect.left + "px";
    ghost.style.top = rect.top + "px";
    document.body.appendChild(ghost);

    drag = {
      card: card, placeId: placeId, ghost: ghost,
      offsetX: x - rect.left, offsetY: y - rect.top,
      lastX: x, lastY: y, scrollDir: 0, dropSec: null, raf: 0
    };
    card.classList.add("is-dragging");
    document.body.classList.add("plan-dragging");
    drag.raf = requestAnimationFrame(autoScrollTick);
  }

  /* 拖曳中：移動 ghost、判斷落點、把佔位卡挪到候選位置。 */
  function dragMove(x, y) {
    if (!drag) return;
    drag.lastX = x; drag.lastY = y;
    drag.ghost.style.left = (x - drag.offsetX) + "px";
    drag.ghost.style.top = (y - drag.offsetY) + "px";
    setScrollDir(y);
    var list = findDropList(x, y);
    if (list) { placeDraggingCard(list, y); highlightDropTarget(list); }
  }

  /* 依指標位置找出落點的 .plan-day__list（可能落在清單、空段提示或段本身）。 */
  function findDropList(x, y) {
    var el = document.elementFromPoint(x, y);
    if (!el) return null;
    var list = el.closest(".plan-day__list");
    if (list) return list;
    var scope = el.closest(".plan-day");
    if (scope) return scope.querySelector(".plan-day__list");
    return null;
  }

  /* 把佔位卡（原卡）插到目標清單中、指標 Y 對應的位置。 */
  function placeDraggingCard(list, y) {
    var dragCard = drag.card;
    var others = Array.prototype.slice.call(list.querySelectorAll(".plan-card"))
      .filter(function (c) { return c !== dragCard; });
    var ref = null;
    for (var i = 0; i < others.length; i++) {
      var r = others[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) { ref = others[i]; break; }
    }
    if (ref) {
      if (dragCard.nextSibling !== ref) list.insertBefore(dragCard, ref);
    } else if (dragCard.parentNode !== list || list.lastElementChild !== dragCard) {
      list.appendChild(dragCard);
    }
  }

  /* 高亮目前落點的天區塊。 */
  function highlightDropTarget(list) {
    var sec = list.closest(".plan-day");
    if (drag.dropSec === sec) return;
    clearDropTarget();
    if (sec) { sec.classList.add("is-drop-target"); drag.dropSec = sec; }
  }
  function clearDropTarget() {
    forEachEl(".plan-day.is-drop-target", function (s) { s.classList.remove("is-drop-target"); });
    if (drag) drag.dropSec = null;
  }

  /* 依指標接近視窗上/下緣設定自動捲動方向。 */
  function setScrollDir(y) {
    var margin = 60;
    if (y < margin) drag.scrollDir = -1;
    else if (y > window.innerHeight - margin) drag.scrollDir = 1;
    else drag.scrollDir = 0;
  }
  /* 自動捲動迴圈：邊緣時持續捲動並重新評估落點。 */
  function autoScrollTick() {
    if (!drag) return;
    if (drag.scrollDir) {
      window.scrollBy(0, drag.scrollDir * 12);
      var list = findDropList(drag.lastX, drag.lastY);
      if (list) { placeDraggingCard(list, drag.lastY); highlightDropTarget(list); }
    }
    drag.raf = requestAnimationFrame(autoScrollTick);
  }

  /* 放下：依佔位卡在 DOM 的落點算出 (day, index)，寫入並重繪。 */
  function dragDrop() {
    var list = drag.card.parentNode;
    var day = list ? (parseInt(list.getAttribute("data-day"), 10) || 0) : 0;
    var index = 0;
    if (list) {
      var kids = list.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i] === drag.card) break;
        if (kids[i].classList && kids[i].classList.contains("plan-card")) index++;
      }
    }
    var placeId = drag.placeId;
    endDragVisuals();
    drag = null;
    markJustDragged();
    TripStore.moveItem(currentTripId, placeId, day, index);
    selectedDay = day;
    reRenderKeepScroll();
  }

  /* 取消拖曳：清掉視覺後以重繪還原原始順序。 */
  function dragAbort() {
    endDragVisuals();
    drag = null;
    markJustDragged();
    reRenderKeepScroll();
  }

  /* 清掉拖曳的視覺副作用（ghost／佔位樣式／落點高亮／自動捲動）。 */
  function endDragVisuals() {
    if (!drag) return;
    if (drag.raf) cancelAnimationFrame(drag.raf);
    if (drag.ghost && drag.ghost.parentNode) drag.ghost.parentNode.removeChild(drag.ghost);
    if (drag.card) drag.card.classList.remove("is-dragging");
    document.body.classList.remove("plan-dragging");
    clearDropTarget();
  }

  /* 標記剛拖曳過，短暫抑制握把 click（避免拖完誤開選單）。 */
  function markJustDragged() {
    justDragged = true;
    setTimeout(function () { justDragged = false; }, 0);
  }

  /* 重繪並盡量保住捲動位置（拖曳/上下移後不跳動）。 */
  function reRenderKeepScroll() {
    var sy = window.scrollY;
    renderAll();
    window.scrollTo(0, sy);
  }

  /* querySelectorAll + forEach 的小包裝（限定在 #plan-list 內）。 */
  function forEachEl(selector, fn) {
    var nodes = els.list.querySelectorAll(selector);
    Array.prototype.forEach.call(nodes, fn);
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

})();

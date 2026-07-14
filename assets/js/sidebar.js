/*
 * sidebar.js — 全站左側側邊欄導覽（台灣散步筆記，四頁共用）
 * ============================================================
 * 取代原本各頁寫死的右上角頁首。負責：
 *   1. 在 #app-sidebar 內渲染：站名 → 「探索城市」→ 可展開的「我的行程」。
 *   2. 「我的行程」點展開鈕露出所有行程（讀 TripStore），底部固定「＋新行程」。
 *      - 建立行程：就地輸入名稱 → TripStore.createTrip（會設為 current）→
 *        若在行程頁就地開啟，否則導向 plan.html 開啟該新行程。
 *      - 點行程：設為 current → 同上（頁內切換或導向 plan.html）。
 *      - 空狀態：顯示「還沒有行程」＋「＋新行程」，無死角。
 *   3. 手機版：頁首收合成漢堡鍵，點開由左側滑出抽屜＋半透明遮罩。
 *
 * 頁面約定：
 *   - <body data-page="explore|plan"> 決定當前頁（explore=首頁/城市/詳細）。
 *   - HTML 需提供骨架：.app-shell > (aside#app-sidebar + .app-content)。
 *   - 手機頂列（.mobile-topbar）與遮罩（.sidebar-backdrop）由本檔動態建立。
 *
 * 對外全域物件：window.Sidebar
 *   - Sidebar.refresh()  行程資料變動後（plan.js 增刪改）重繪行程清單與高亮。
 *
 * 與行程頁的協作（可選）：若頁面提供 window.PlanPage.selectTrip(tripId)，
 *   側邊欄切換/建立行程時改為「頁內就地切換」而非整頁導向，體驗更順。
 *
 * 依賴：TripStore（trip-store.js）、escapeHtml（shared.js）。
 * 載入順序：data.js → shared.js → trip-store.js →（trip-picker.js）→ sidebar.js → 各頁 JS。
 * ============================================================
 */
"use strict";

var Sidebar = (function () {
  /* 常用節點與狀態 */
  var asideEl = null;      // #app-sidebar
  var backdropEl = null;   // 手機遮罩
  var page = "explore";    // 當前頁：explore / plan
  var expanded = false;    // 「我的行程」下拉是否展開
  var creating = false;    // 是否正在就地輸入新行程名稱

  /* ---------- 導向 / 頁內切換 ---------- */

  /* 是否有行程頁提供的頁內切換 hook。 */
  function hasPlanHook() {
    return window.PlanPage && typeof window.PlanPage.selectTrip === "function";
  }

  /* 開啟某行程：優先頁內切換（在行程頁時），否則導向 plan.html。 */
  function openTrip(tripId) {
    TripStore.setCurrentTripId(tripId);
    if (hasPlanHook()) {
      window.PlanPage.selectTrip(tripId);
      closeDrawer();
      render();
    } else {
      window.location.href = "plan.html";
    }
  }

  /* ---------- 渲染 ---------- */

  /* 重繪整個側邊欄內容。 */
  function render() {
    if (!asideEl) return;
    asideEl.innerHTML =
      brandHtml() +
      '<nav class="sidebar__nav">' +
        exploreLinkHtml() +
        planItemHtml() +
        tripsHtml() +
      "</nav>";
    wire();
  }

  /* 只重繪「行程清單」區塊（資料變動後用，保留展開/建立狀態）。 */
  function refresh() {
    if (!asideEl) return;
    var nav = asideEl.querySelector(".sidebar__nav");
    if (!nav) { render(); return; }
    var old = nav.querySelector(".sidebar__trips");
    if (old) old.parentNode.removeChild(old);
    if (expanded) {
      nav.insertAdjacentHTML("beforeend", tripsHtml());
      wireTrips();
    }
    // 目前行程高亮可能改變（改名/刪除）→ 一併重繪列表已涵蓋。
  }

  function brandHtml() {
    return '' +
      '<div class="sidebar__brand">' +
        '<a href="index.html">台灣散步筆記</a>' +
        '<button type="button" class="sidebar__close" aria-label="關閉選單">✕</button>' +
      "</div>";
  }

  function exploreLinkHtml() {
    var active = page === "explore" ? " is-active" : "";
    return '<a class="sidebar__link' + active + '" href="index.html#cities">探索城市</a>';
  }

  /* 「我的行程」列：標籤（連到 plan.html）+ 展開鈕。 */
  function planItemHtml() {
    var active = page === "plan" ? " is-active" : "";
    var arrow = expanded ? "▾" : "▸";
    return '' +
      '<div class="sidebar__item' + active + '">' +
        '<a class="sidebar__link" href="plan.html">我的行程</a>' +
        '<button type="button" class="sidebar__toggle" id="sidebar-toggle" ' +
          'aria-expanded="' + (expanded ? "true" : "false") + '" ' +
          'aria-controls="sidebar-trips" aria-label="展開行程清單">' + arrow + "</button>" +
      "</div>";
  }

  /* 展開時的行程清單（含建立區）；收合時回傳空字串。 */
  function tripsHtml() {
    if (!expanded) return "";
    var trips = TripStore.getAll();
    var current = TripStore.getCurrentTripId();
    var inner = "";

    if (trips.length === 0) {
      inner += '<div class="sidebar__empty">還沒有行程</div>';
    } else {
      inner += trips.map(function (t) {
        var cur = t.id === current ? " is-current" : "";
        return '<button type="button" class="sidebar__trip' + cur + '" ' +
          'data-trip-id="' + escapeHtml(t.id) + '">' + escapeHtml(t.name) + "</button>";
      }).join("");
    }

    // 底部固定的建立入口：按鈕或就地輸入。
    if (creating) {
      inner += '' +
        '<div class="sidebar__new-form">' +
          '<input type="text" class="sidebar__new-input" id="sidebar-new-input" ' +
            'placeholder="行程名稱" maxlength="40">' +
          '<button type="button" class="sidebar__new-submit" id="sidebar-new-submit">建立</button>' +
        "</div>";
    } else {
      inner += '<button type="button" class="sidebar__new" id="sidebar-new">＋新行程</button>';
    }

    return '<div class="sidebar__trips" id="sidebar-trips">' + inner + "</div>";
  }

  /* ---------- 事件掛載 ---------- */

  function wire() {
    // 展開/收合
    var toggle = asideEl.querySelector("#sidebar-toggle");
    if (toggle) toggle.addEventListener("click", function (e) {
      e.preventDefault();
      expanded = !expanded;
      if (!expanded) creating = false; // 收起時取消建立中的輸入
      render();
    });

    // 手機關閉鈕
    var close = asideEl.querySelector(".sidebar__close");
    if (close) close.addEventListener("click", closeDrawer);

    wireTrips();
  }

  /* 掛「行程清單」區塊內的事件（切換、建立）。 */
  function wireTrips() {
    // 點某個行程 → 切換並開啟
    var trips = asideEl.querySelectorAll(".sidebar__trip[data-trip-id]");
    Array.prototype.forEach.call(trips, function (btn) {
      btn.addEventListener("click", function () {
        openTrip(btn.getAttribute("data-trip-id"));
      });
    });

    // ＋新行程 → 切成就地輸入
    var newBtn = asideEl.querySelector("#sidebar-new");
    if (newBtn) newBtn.addEventListener("click", function () {
      creating = true;
      render();
      focusInput("sidebar-new-input");
    });

    // 建立輸入的送出／Enter／Esc
    var input = asideEl.querySelector("#sidebar-new-input");
    var submit = asideEl.querySelector("#sidebar-new-submit");
    function commit() {
      // 名稱空白時 TripStore.createTrip 會給預設名。
      var trip = TripStore.createTrip(input ? input.value : "");
      creating = false;
      openTrip(trip.id); // createTrip 已設為 current，openTrip 再確保並開啟
    }
    if (submit) submit.addEventListener("click", commit);
    if (input) input.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); commit(); }
      else if (e.key === "Escape") { e.preventDefault(); creating = false; render(); }
    });
  }

  /* ---------- 手機抽屜 ---------- */

  /* 建立手機頂列（漢堡＋站名）並插入內容區最前面。 */
  function buildMobileTopbar() {
    var content = document.querySelector(".app-content");
    if (!content) return;
    var bar = document.createElement("header");
    bar.className = "mobile-topbar";
    bar.innerHTML =
      '<button type="button" class="mobile-topbar__toggle" aria-label="開啟選單">☰</button>' +
      '<span class="mobile-topbar__title">台灣散步筆記</span>';
    content.insertBefore(bar, content.firstChild);
    bar.querySelector(".mobile-topbar__toggle").addEventListener("click", openDrawer);
  }

  /* 建立遮罩（點擊關閉）。 */
  function buildBackdrop() {
    backdropEl = document.createElement("div");
    backdropEl.className = "sidebar-backdrop";
    backdropEl.hidden = true;
    backdropEl.addEventListener("click", closeDrawer);
    var shell = document.querySelector(".app-shell") || document.body;
    shell.appendChild(backdropEl);
  }

  function openDrawer() {
    if (asideEl) asideEl.classList.add("is-open");
    if (backdropEl) backdropEl.hidden = false;
  }
  function closeDrawer() {
    if (asideEl) asideEl.classList.remove("is-open");
    if (backdropEl) backdropEl.hidden = true;
  }

  /* ---------- 小工具 ---------- */

  function focusInput(id) {
    setTimeout(function () {
      var el = document.getElementById(id);
      if (el) el.focus();
    }, 0);
  }

  /* ---------- 進入點 ---------- */

  function init() {
    asideEl = document.getElementById("app-sidebar");
    if (!asideEl) return; // 該頁未套用側邊欄骨架
    page = document.body.getAttribute("data-page") === "plan" ? "plan" : "explore";
    expanded = page === "plan"; // 行程頁預設展開，其餘收合
    render();
    buildMobileTopbar();
    buildBackdrop();
    // Esc 關閉手機抽屜
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  return { refresh: refresh };
})();

window.Sidebar = Sidebar;

/*
 * sidebar.js — 全站左側側邊欄導覽（台灣散步筆記，四頁共用）
 * ============================================================
 * 取代原本各頁寫死的右上角頁首。負責：
 *   1. 在 #app-sidebar 內渲染：站名 → 「探索城市」→「我的行程」。
 *   2. 「我的行程」是連往 plan.html（行程總覽）的連結，本身不再有展開箭頭。
 *      - 桌機：滑鼠移到「我的行程」→ 右側自動浮出行程清單 flyout（只顯名稱）。
 *          · 點 flyout 內某行程 → 進該行程規劃層（plan.html?trip=<id>）。
 *          · 點 flyout 內「＋新行程」→ 進總覽並自動開建立（plan.html?new=1）。
 *          · 沒有行程時：flyout 顯示「還沒有行程」＋「＋新行程」。
 *      - 手機：無 hover；點「我的行程」直接進總覽（plan.html）。flyout 不出現。
 *   3. 手機版：頁首收合成漢堡鍵，點開由左側滑出抽屜＋半透明遮罩。
 *
 * 頁面約定：
 *   - <body data-page="explore|plan"> 決定當前頁高亮（explore=首頁/城市/詳細）。
 *   - HTML 需提供骨架：.app-shell > (aside#app-sidebar + .app-content)。
 *   - 手機頂列（.mobile-topbar）與遮罩（.sidebar-backdrop）由本檔動態建立。
 *
 * 對外全域物件：window.Sidebar
 *   - Sidebar.refresh()  行程資料變動後重建 flyout 內容（下次 hover 生效）。
 *
 * 依賴：TripStore（trip-store.js）、escapeHtml（shared.js）。
 * 載入順序：data.js → shared.js → trip-store.js →（trip-picker.js）→ sidebar.js → 各頁 JS。
 * ============================================================
 */
"use strict";

var Sidebar = (function () {
  var asideEl = null;      // #app-sidebar
  var backdropEl = null;   // 手機遮罩
  var flyoutEl = null;     // 桌機 hover 浮出的行程清單
  var page = "explore";    // 當前頁：explore / plan
  var hideTimer = null;    // flyout 延遲收起計時器

  /* ---------- 渲染側邊欄骨架 ---------- */

  function render() {
    if (!asideEl) return;
    var exploreActive = page === "explore" ? " is-active" : "";
    var planActive = page === "plan" ? " is-active" : "";
    asideEl.innerHTML =
      '<div class="sidebar__brand">' +
        '<a href="index.html">台灣散步筆記</a>' +
        '<button type="button" class="sidebar__close" aria-label="關閉選單">✕</button>' +
      "</div>" +
      '<nav class="sidebar__nav">' +
        '<a class="sidebar__link' + exploreActive + '" href="index.html#cities">探索城市</a>' +
        '<div class="sidebar__item" id="sidebar-trips-item">' +
          '<a class="sidebar__link' + planActive + '" href="plan.html">我的行程</a>' +
          '<div class="sidebar__flyout" id="sidebar-flyout"></div>' +
        "</div>" +
      "</nav>";
    flyoutEl = asideEl.querySelector("#sidebar-flyout");
    buildFlyout();
    wire();
  }

  /* 依 TripStore 重建 flyout 內容（名稱清單 + 建立入口）。 */
  function buildFlyout() {
    if (!flyoutEl) return;
    var trips = TripStore.getAll();
    var html = '<div class="sidebar__flyout-label">我的行程</div>';

    if (trips.length === 0) {
      html += '<div class="sidebar__flyout-empty">還沒有行程</div>';
    } else {
      html += trips.map(function (t) {
        return '<a class="sidebar__flyout-item" href="plan.html?trip=' +
          encodeURIComponent(t.id) + '">' + escapeHtml(t.name) + "</a>";
      }).join("");
    }

    html += '<div class="sidebar__flyout-sep"></div>';
    html += '<a class="sidebar__flyout-new" href="plan.html?new=1">＋新行程</a>';
    flyoutEl.innerHTML = html;
  }

  /* 對外：資料變動後重建 flyout（下次 hover 會看到最新）。 */
  function refresh() {
    buildFlyout();
  }

  /* ---------- 事件 ---------- */

  function wire() {
    // 手機關閉鈕
    var close = asideEl.querySelector(".sidebar__close");
    if (close) close.addEventListener("click", closeDrawer);

    // 桌機 hover flyout：移入顯示、移出延遲收起（允許滑進 flyout）。
    var item = asideEl.querySelector("#sidebar-trips-item");
    if (item) {
      item.addEventListener("mouseenter", showFlyout);
      item.addEventListener("mouseleave", scheduleHideFlyout);
    }
  }

  function showFlyout() {
    if (hideTimer) { clearTimeout(hideTimer); hideTimer = null; }
    if (flyoutEl) flyoutEl.classList.add("is-open");
  }
  function scheduleHideFlyout() {
    hideTimer = setTimeout(function () {
      if (flyoutEl) flyoutEl.classList.remove("is-open");
    }, 150);
  }

  /* ---------- 手機抽屜 ---------- */

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

  /* ---------- 進入點 ---------- */

  function init() {
    asideEl = document.getElementById("app-sidebar");
    if (!asideEl) return; // 該頁未套用側邊欄骨架
    page = document.body.getAttribute("data-page") === "plan" ? "plan" : "explore";
    render();
    buildMobileTopbar();
    buildBackdrop();
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeDrawer();
    });
  }

  document.addEventListener("DOMContentLoaded", init);

  return { refresh: refresh };
})();

window.Sidebar = Sidebar;

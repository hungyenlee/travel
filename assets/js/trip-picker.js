/*
 * trip-picker.js — 台灣散步筆記 「加入行程」按鈕與行程選單（共用 UI）
 * ============================================================
 * 本檔提供各頁（城市頁 city.js／詳細頁 detail.js）共用的「加入行程」互動：
 *   1) 依 TripStore 更新每顆按鈕外觀（是否已加入任一行程）。
 *   2) 點按鈕彈出小面板（popover），可勾選要加入／移除哪些行程，或建立新行程。
 *
 * 完全依賴：
 *   - TripStore（assets/js/trip-store.js）：行程資料的增刪查（無 DOM）。
 *   - shared.js：escapeHtml 等共用工具。
 * 載入順序：data.js → shared.js → trip-store.js → trip-picker.js → 各頁 JS。
 *
 * 標記約定（呼叫端在 HTML 放的按鈕）：
 *   <button type="button" class="add-trip-btn" data-add-trip="<placeId>">＋ 加入行程</button>
 *   placeId 需經 escapeHtml。
 *
 * 對外全域物件：TripPicker
 *   - TripPicker.wireAll(containerEl)     掛事件並設定初始狀態（省略時預設 document）
 *   - TripPicker.refreshStates(containerEl) 重新依 TripStore 更新按鈕外觀（省略時 document）
 * ============================================================
 */
"use strict";

var TripPicker = (function () {
  /* 目前開啟中的面板 DOM（同時只允許一個面板）；沒有開啟時為 null。 */
  var openPanel = null;
  /* 目前面板對應的觸發按鈕（關閉後要把焦點還給它）。 */
  var openButton = null;
  /* 目前面板對應的 placeId。 */
  var openPlaceId = null;
  /* 面板外層的遮罩（點外面關閉用）；與 openPanel 同生共死。 */
  var openBackdrop = null;

  /* ---------- 按鈕外觀 ---------- */

  /* 依「此地點是否已在任一行程」更新單顆按鈕的文字與 class。 */
  function refreshButton(btn) {
    var placeId = btn.getAttribute("data-add-trip");
    if (placeId == null) return;
    var inTrips = TripStore.tripsContaining(placeId).length > 0;
    if (inTrips) {
      btn.classList.add("is-added");
      btn.textContent = "✓ 已加入";
    } else {
      btn.classList.remove("is-added");
      btn.textContent = "＋ 加入行程";
    }
  }

  /* 重新整理 containerEl 內所有加入鈕的外觀（不重掛事件）。 */
  function refreshStates(containerEl) {
    var root = containerEl || document;
    var btns = root.querySelectorAll("[data-add-trip]");
    for (var i = 0; i < btns.length; i++) {
      refreshButton(btns[i]);
    }
  }

  /* ---------- 面板（popover）開關 ---------- */

  /* 關閉目前面板（若有），並清掉遮罩與全域監聽。 */
  function closePanel() {
    if (openBackdrop && openBackdrop.parentNode) {
      openBackdrop.parentNode.removeChild(openBackdrop);
    }
    if (openPanel && openPanel.parentNode) {
      openPanel.parentNode.removeChild(openPanel);
    }
    document.removeEventListener("keydown", onKeydown, true);
    openPanel = null;
    openBackdrop = null;
    openPlaceId = null;
    openButton = null;
  }

  /* 全域鍵盤監聽：Esc 關閉面板。 */
  function onKeydown(e) {
    if (e.key === "Escape" || e.keyCode === 27) {
      var btn = openButton;
      closePanel();
      if (btn) btn.focus();
    }
  }

  /* 把面板定位在按鈕附近：預設貼在按鈕正下方左緣對齊，
   * 若超出視窗右／下緣則往內收，避免被裁掉。使用 fixed 定位（相對視窗）。 */
  function positionPanel(panel, btn) {
    var rect = btn.getBoundingClientRect();
    var gap = 6; /* 按鈕與面板的間距（px） */
    /* 先放到量測位置才量得到面板尺寸 */
    panel.style.top = "0px";
    panel.style.left = "0px";
    var pw = panel.offsetWidth;
    var ph = panel.offsetHeight;
    var vw = document.documentElement.clientWidth;
    var vh = document.documentElement.clientHeight;

    var left = rect.left;
    var top = rect.bottom + gap;
    /* 右緣超出 → 靠右收（含 8px 邊距） */
    if (left + pw > vw - 8) left = vw - pw - 8;
    if (left < 8) left = 8;
    /* 下緣超出且上方空間較充足 → 改放到按鈕上方 */
    if (top + ph > vh - 8 && rect.top - gap - ph > 8) {
      top = rect.top - gap - ph;
    }
    if (top < 8) top = 8;

    panel.style.left = Math.round(left) + "px";
    panel.style.top = Math.round(top) + "px";
  }

  /* ---------- 面板內容 ---------- */

  /* 建立單一行程列（button）。已含此地點者加 is-added 並前置勾號。 */
  function buildTripRow(trip, placeId) {
    var row = document.createElement("button");
    row.type = "button";
    row.className = "trip-picker__item";
    var added = TripStore.hasPlace(trip.id, placeId);
    if (added) row.classList.add("is-added");
    /* 勾號 + 名稱（名稱經 escapeHtml，避免使用者命名破壞 HTML） */
    row.innerHTML =
      (added ? '<span class="trip-picker__check">✓</span>' : "") +
      '<span class="trip-picker__name">' + escapeHtml(trip.name) + "</span>";
    /* 點列 = toggle；就地更新該列與按鈕，面板保持開啟 */
    row.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      TripStore.togglePlace(trip.id, placeId);
      rebuildPanel();
    });
    return row;
  }

  /* 建立底部「建立新行程」區：inline 文字輸入 + 建立鈕（不使用原生 prompt）。 */
  function buildNewRow(placeId) {
    var wrap = document.createElement("div");
    wrap.className = "trip-picker__new";

    var input = document.createElement("input");
    input.type = "text";
    input.className = "trip-picker__new-input";
    input.placeholder = "新行程名稱";

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "trip-picker__new-btn";
    btn.textContent = "建立";

    /* 送出：建立行程並把當前地點加入，再重建面板。 */
    function submit() {
      /* 名稱空白時交由 TripStore 給預設名（「未命名行程」）。 */
      var trip = TripStore.createTrip(input.value);
      TripStore.addPlace(trip.id, placeId);
      input.value = "";
      rebuildPanel();
    }

    btn.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      submit();
    });
    /* 於輸入框按 Enter 也送出（不誤觸 Esc 關閉）。 */
    input.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Enter" || e.keyCode === 13) {
        e.preventDefault();
        submit();
      }
    });

    wrap.appendChild(input);
    wrap.appendChild(btn);
    return wrap;
  }

  /* 依目前資料重繪面板內容（行程列 + 建立區）。
   * 保留面板 DOM 與定位、遮罩不動；同時同步觸發按鈕外觀。 */
  function rebuildPanel() {
    if (!openPanel) return;
    var placeId = openPlaceId;
    openPanel.innerHTML = "";

    var trips = TripStore.getAll();
    if (trips.length === 0) {
      /* 沒有任何行程 → 只顯示建立區與一句提示 */
      var empty = document.createElement("div");
      empty.className = "trip-picker__empty";
      empty.textContent = "還沒有行程，建立第一個吧";
      openPanel.appendChild(empty);
    } else {
      var list = document.createElement("div");
      list.className = "trip-picker__list";
      for (var i = 0; i < trips.length; i++) {
        list.appendChild(buildTripRow(trips[i], placeId));
      }
      openPanel.appendChild(list);
    }

    openPanel.appendChild(buildNewRow(placeId));

    /* 資料變了 → 同步原按鈕外觀（此地點在整份文件的所有按鈕都更新）。 */
    refreshStates(document);
    /* 內容高度可能改變 → 重新定位，避免溢出視窗。 */
    if (openButton) positionPanel(openPanel, openButton);
  }

  /* 開啟面板：先關掉既有的，再建立遮罩與面板並定位。 */
  function openPanelFor(btn) {
    /* 已對同一顆按鈕開啟 → 視為 toggle 關閉 */
    if (openPanel && openButton === btn) {
      closePanel();
      return;
    }
    closePanel();

    openButton = btn;
    openPlaceId = btn.getAttribute("data-add-trip");

    /* 遮罩：佔滿視窗、點擊即關閉（點面板本身不關）。 */
    openBackdrop = document.createElement("div");
    openBackdrop.className = "trip-picker__backdrop";
    openBackdrop.addEventListener("click", function () {
      closePanel();
    });

    /* 面板本體 */
    openPanel = document.createElement("div");
    openPanel.className = "trip-picker";
    /* 點面板內部空白處不要冒泡到遮罩造成關閉 */
    openPanel.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    document.body.appendChild(openBackdrop);
    document.body.appendChild(openPanel);

    rebuildPanel();
    positionPanel(openPanel, btn);

    /* Esc 關閉（捕獲階段，確保優先處理）。 */
    document.addEventListener("keydown", onKeydown, true);
  }

  /* ---------- 掛載 ---------- */

  /* 找出 containerEl 內所有加入鈕：設定初始外觀並掛上開啟面板的 click。
   * 用 data-trip-wired 標記避免重複掛事件（refreshStates 之外重複呼叫也安全）。 */
  function wireAll(containerEl) {
    var root = containerEl || document;
    var btns = root.querySelectorAll("[data-add-trip]");
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      refreshButton(btn);
      if (btn.getAttribute("data-trip-wired") === "1") continue;
      btn.setAttribute("data-trip-wired", "1");
      btn.addEventListener("click", onButtonClick);
    }
  }

  /* 按鈕點擊：阻擋預設與冒泡（避免觸發包住的連結），開啟面板。 */
  function onButtonClick(e) {
    e.preventDefault();
    e.stopPropagation();
    openPanelFor(this);
  }

  /* 對外介面 */
  return {
    wireAll: wireAll,
    refreshStates: refreshStates
  };
})();

/* 掛到全域，供各頁 JS 使用 */
window.TripPicker = TripPicker;

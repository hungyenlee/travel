/*
 * trip-store.js — 台灣散步筆記 行程資料層（純資料，無 DOM）
 * ============================================================
 * 本檔負責「我的行程」功能的所有 localStorage 讀寫，是行程資料的單一擁有者。
 * 載入順序：在 data.js（提供 places 等資料）與 shared.js（共用工具）之後、
 * 各頁面 JS（city.js / detail.js / plan.js）之前載入。
 *
 * 完全不碰 DOM；只做資料的增刪改查，每次變更後立即寫回 localStorage。
 *
 * localStorage 資料模型
 * ------------------------------------------------------------
 * key：「tsn.trips.v1」（tsn = 台灣散步筆記）
 * 值為 JSON：
 *   {
 *     "version": 1,
 *     "trips": [
 *       {
 *         "id": "t...",            // 唯一字串 id
 *         "name": "行程名稱",
 *         "createdAt": 1712345678, // 建立時的 epoch 秒
 *         "days": 1,               // 天數 N（>=0）；0 代表只有「未分配」
 *         "items": [ { "placeId": "chihkan-tower", "day": 0 } ]
 *       }
 *     ],
 *     "currentTripId": "t..."      // 上次檢視的行程 id；可為 null
 *   }
 * day 值語意：0 = 未分配；1..N = 第 1..N 天。同一行程內一個 placeId 最多出現一次。
 * 讀取時若 JSON 損毀或不存在 → 安全回退為空狀態，不丟例外。
 *
 * 對外全域物件：TripStore（見檔尾方法清單）。
 * ============================================================
 */
"use strict";

var TripStore = (function () {
  /* localStorage 儲存 key */
  var STORAGE_KEY = "tsn.trips.v1";

  /* 空狀態（讀取失敗或第一次使用時的回退值） */
  function emptyState() {
    return { version: 1, trips: [], currentTripId: null };
  }

  /* 產生唯一行程 id：t + 時間戳(36進位) + 隨機字串 */
  function genId() {
    return "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /* 讀出整包狀態；JSON 損毀 / 不存在 / 結構異常都安全回退為空狀態。 */
  function load() {
    var raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      /* localStorage 不可用（隱私模式等）→ 視為空狀態 */
      return emptyState();
    }
    if (!raw) return emptyState();

    var data;
    try {
      data = JSON.parse(raw);
    } catch (e) {
      /* JSON 損毀 → 空狀態 */
      return emptyState();
    }
    /* 基本結構把關：trips 必須是陣列，否則整包視為損毀 */
    if (!data || typeof data !== "object" || !Array.isArray(data.trips)) {
      return emptyState();
    }
    /* 補齊缺欄位，避免後續存取出錯 */
    if (typeof data.version !== "number") data.version = 1;
    if (typeof data.currentTripId === "undefined") data.currentTripId = null;
    /* 逐筆行程做欄位正規化（防止部分資料損壞） */
    data.trips = data.trips.filter(function (t) {
      return t && typeof t === "object" && typeof t.id === "string";
    }).map(function (t) {
      return {
        id: t.id,
        name: typeof t.name === "string" ? t.name : "未命名行程",
        createdAt: typeof t.createdAt === "number" ? t.createdAt : nowSeconds(),
        days: typeof t.days === "number" && t.days >= 0 ? Math.floor(t.days) : 1,
        items: Array.isArray(t.items) ? t.items.filter(function (it) {
          return it && typeof it.placeId === "string";
        }).map(function (it) {
          return { placeId: it.placeId, day: typeof it.day === "number" ? it.day : 0 };
        }) : []
      };
    });
    return data;
  }

  /* 把整包狀態寫回 localStorage；失敗時靜默（不丟例外中斷呼叫端）。 */
  function save(state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* 寫入失敗（配額或不可用）→ 忽略 */
    }
  }

  /* 目前 epoch 秒（建立時間用） */
  function nowSeconds() {
    return Math.floor(Date.now() / 1000);
  }

  /* 在 state 中找出指定 id 的行程物件，找不到回傳 null。 */
  function findTrip(state, tripId) {
    for (var i = 0; i < state.trips.length; i++) {
      if (state.trips[i].id === tripId) return state.trips[i];
    }
    return null;
  }

  /* 名稱正規化：去頭尾空白；空白時回傳預設名。 */
  function normalizeName(name) {
    var s = (name == null ? "" : String(name)).trim();
    return s === "" ? "未命名行程" : s;
  }

  /* ---------- 對外方法 ---------- */

  /* 取全部行程（陣列）。 */
  function getAll() {
    return load().trips;
  }

  /* 以 id 取單一行程物件，找不到回傳 null。 */
  function getTrip(tripId) {
    return findTrip(load(), tripId);
  }

  /* 建立新行程：days 預設 1、items 空、createdAt 用當下秒數；
   * 自動設為 currentTripId；回傳新 trip 物件。名稱空白給預設名。 */
  function createTrip(name) {
    var state = load();
    var trip = {
      id: genId(),
      name: normalizeName(name),
      createdAt: nowSeconds(),
      days: 1,
      items: []
    };
    state.trips.push(trip);
    state.currentTripId = trip.id;
    save(state);
    return trip;
  }

  /* 行程改名；名稱空白（trim 後為空）則忽略、不變更。 */
  function renameTrip(tripId, name) {
    var s = (name == null ? "" : String(name)).trim();
    if (s === "") return; /* 空白忽略 */
    var state = load();
    var trip = findTrip(state, tripId);
    if (!trip) return;
    trip.name = s;
    save(state);
  }

  /* 刪除行程；若刪的是 current，current 改為剩餘第一個或 null。 */
  function deleteTrip(tripId) {
    var state = load();
    var idx = -1;
    for (var i = 0; i < state.trips.length; i++) {
      if (state.trips[i].id === tripId) { idx = i; break; }
    }
    if (idx === -1) return;
    state.trips.splice(idx, 1);
    if (state.currentTripId === tripId) {
      state.currentTripId = state.trips.length > 0 ? state.trips[0].id : null;
    }
    save(state);
  }

  /* 取目前檢視中的行程 id（可為 null）。 */
  function getCurrentTripId() {
    return load().currentTripId;
  }

  /* 設定目前檢視中的行程 id。 */
  function setCurrentTripId(id) {
    var state = load();
    state.currentTripId = id == null ? null : id;
    save(state);
  }

  /* 某行程是否已包含某地點。 */
  function hasPlace(tripId, placeId) {
    var trip = getTrip(tripId);
    if (!trip) return false;
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].placeId === placeId) return true;
    }
    return false;
  }

  /* 加入地點（不存在才加），day 預設 0（未分配）。 */
  function addPlace(tripId, placeId) {
    var state = load();
    var trip = findTrip(state, tripId);
    if (!trip) return;
    /* 已存在則不重複加入 */
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].placeId === placeId) return;
    }
    trip.items.push({ placeId: placeId, day: 0 });
    save(state);
  }

  /* 從行程移除地點。 */
  function removePlace(tripId, placeId) {
    var state = load();
    var trip = findTrip(state, tripId);
    if (!trip) return;
    trip.items = trip.items.filter(function (it) {
      return it.placeId !== placeId;
    });
    save(state);
  }

  /* 切換：有則移除、無則加入；回傳變更後「是否在行程內」（bool）。 */
  function togglePlace(tripId, placeId) {
    var state = load();
    var trip = findTrip(state, tripId);
    if (!trip) return false;
    var found = false;
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].placeId === placeId) { found = true; break; }
    }
    if (found) {
      /* 已在行程 → 移除 */
      trip.items = trip.items.filter(function (it) {
        return it.placeId !== placeId;
      });
      save(state);
      return false;
    }
    /* 不在行程 → 加入（未分配） */
    trip.items.push({ placeId: placeId, day: 0 });
    save(state);
    return true;
  }

  /* 把某地點移到某天；day 會夾在 0..trip.days 範圍內。 */
  function setPlaceDay(tripId, placeId, day) {
    var state = load();
    var trip = findTrip(state, tripId);
    if (!trip) return;
    var d = Math.floor(Number(day));
    if (isNaN(d) || d < 0) d = 0;
    if (d > trip.days) d = trip.days; /* 夾住上限，避免超出天數 */
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].placeId === placeId) {
        trip.items[i].day = d;
        save(state);
        return;
      }
    }
  }

  /* 把某地點搬到「第 targetDay 天的第 index 個位置」。
   * 同天內重新排序、跨天搬移都走這一支（拖曳排序的唯一寫入路徑）。
   *   - targetDay 夾在 0..trip.days（0 = 未分配）。
   *   - index 夾在 0..該天目前地點數（把移動中的這筆先排除後計算）。
   * 作法：先在扁平 items 陣列中取出該 item、改寫其 day，
   *   再依「該天第 index 個」換算出扁平插入位置後 splice 回去。
   * 資料模型不變：同一天的相對順序＝這些 item 在扁平陣列中的先後。
   * 找不到 placeId 則無動作。 */
  function moveItem(tripId, placeId, targetDay, index) {
    var state = load();
    var trip = findTrip(state, tripId);
    if (!trip) return;

    /* 取出移動中的 item（同時從陣列移除）。 */
    var moving = null;
    for (var i = 0; i < trip.items.length; i++) {
      if (trip.items[i].placeId === placeId) {
        moving = trip.items.splice(i, 1)[0];
        break;
      }
    }
    if (!moving) return;

    /* 夾住目標天。 */
    var d = Math.floor(Number(targetDay));
    if (isNaN(d) || d < 0) d = 0;
    if (d > trip.days) d = trip.days;
    moving.day = d;

    /* 該天現有 item（移動中的已排除）在扁平陣列中的位置。 */
    var sameDayPos = [];
    for (var j = 0; j < trip.items.length; j++) {
      if (trip.items[j].day === d) sameDayPos.push(j);
    }

    /* 夾住 index 到 0..該天數量。 */
    var idx = Math.floor(Number(index));
    if (isNaN(idx) || idx < 0) idx = 0;
    if (idx > sameDayPos.length) idx = sameDayPos.length;

    /* 換算扁平插入位置：
     *   idx < 數量 → 插在「該天第 idx 個」之前；
     *   idx = 數量 → 插在該天最後一個之後（該天原本為空則放陣列末端）。 */
    var insertAt;
    if (idx < sameDayPos.length) {
      insertAt = sameDayPos[idx];
    } else if (sameDayPos.length > 0) {
      insertAt = sameDayPos[sameDayPos.length - 1] + 1;
    } else {
      insertAt = trip.items.length;
    }

    trip.items.splice(insertAt, 0, moving);
    save(state);
  }

  /* 新增一天：days++，回傳新天數。 */
  function addDay(tripId) {
    var state = load();
    var trip = findTrip(state, tripId);
    if (!trip) return 0;
    trip.days = trip.days + 1;
    save(state);
    return trip.days;
  }

  /* 移除第 day 天（day>=1），自動連號重排：
   *   - 該天的 items → day=0（退回未分配）
   *   - day 大於被移除天者 → day 減 1
   *   - trip.days 減 1
   * 使天數永遠維持 1..N 連續。 */
  function removeDay(tripId, day) {
    var state = load();
    var trip = findTrip(state, tripId);
    if (!trip) return;
    var d = Math.floor(Number(day));
    /* 只處理有效的第 1..days 天 */
    if (isNaN(d) || d < 1 || d > trip.days) return;
    trip.items.forEach(function (it) {
      if (it.day === d) {
        it.day = 0;          /* 被移除天的地點退回未分配 */
      } else if (it.day > d) {
        it.day = it.day - 1; /* 後面的天連號前移 */
      }
    });
    trip.days = trip.days - 1;
    save(state);
  }

  /* 回傳「包含此 placeId 的 trip 物件」陣列（給按鈕狀態與選單用）。 */
  function tripsContaining(placeId) {
    return load().trips.filter(function (trip) {
      for (var i = 0; i < trip.items.length; i++) {
        if (trip.items[i].placeId === placeId) return true;
      }
      return false;
    });
  }

  /* 對外介面 */
  return {
    getAll: getAll,
    getTrip: getTrip,
    createTrip: createTrip,
    renameTrip: renameTrip,
    deleteTrip: deleteTrip,
    getCurrentTripId: getCurrentTripId,
    setCurrentTripId: setCurrentTripId,
    hasPlace: hasPlace,
    addPlace: addPlace,
    removePlace: removePlace,
    togglePlace: togglePlace,
    setPlaceDay: setPlaceDay,
    moveItem: moveItem,
    addDay: addDay,
    removeDay: removeDay,
    tripsContaining: tripsContaining
  };
})();

/* 掛到全域，供頁面 JS 使用 */
window.TripStore = TripStore;

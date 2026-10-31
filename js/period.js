// 「今週の予定」機能と、期間（開始日〜終了日）の管理。
// 日付(YYYY-MM-DD)ごとに、晩ごはんにいる家族のID一覧(presentIds)と、
// 作らない日かどうか(cooking: false)を保存する。
const WEEK_STORAGE_KEY = "menuApp.weekStatus";
const DAY_LABELS = ["月", "火", "水", "木", "金", "土", "日"];

const weekList = document.getElementById("week-list");

function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 表示する期間（開始日〜終了日）。買い物の日がずれても前後に動かせるように、
// 「今週固定」ではなく開始日・終了日を保存しておく方式にしている。
// 例えば「木曜〜次の火曜」のような、月曜始まりではない期間にもできる。
const PERIOD_STORAGE_KEY = "menuApp.periodStart";
const PERIOD_END_STORAGE_KEY = "menuApp.periodEnd";

function parseDateKey(dateKey) {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function getDefaultPeriodStart() {
  const today = new Date();
  // getDay(): 日=0, 月=1, ... 土=6 なので、月曜始まりに揃える
  const diffFromMonday = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - diffFromMonday);
  return toDateKey(monday);
}

function loadPeriodStart() {
  return localStorage.getItem(PERIOD_STORAGE_KEY) || getDefaultPeriodStart();
}

function savePeriodStart(dateKey) {
  localStorage.setItem(PERIOD_STORAGE_KEY, dateKey);
}

function loadPeriodEnd() {
  const saved = localStorage.getItem(PERIOD_END_STORAGE_KEY);
  if (saved && parseDateKey(saved) >= parseDateKey(loadPeriodStart())) return saved;
  // 保存がない・開始日より前になってしまっている場合は、開始日から6日後（7日間）にする
  const start = parseDateKey(loadPeriodStart());
  const fallback = new Date(start);
  fallback.setDate(start.getDate() + 6);
  return toDateKey(fallback);
}

function savePeriodEnd(dateKey) {
  localStorage.setItem(PERIOD_END_STORAGE_KEY, dateKey);
}

function getPeriodKey() {
  return `${loadPeriodStart()}_${loadPeriodEnd()}`;
}

function getPeriodDates() {
  const start = parseDateKey(loadPeriodStart());
  const end = parseDateKey(loadPeriodEnd());

  const dates = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }
  return dates;
}

function loadWeekStatus() {
  const raw = localStorage.getItem(WEEK_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveWeekStatus(statusMap) {
  localStorage.setItem(WEEK_STORAGE_KEY, JSON.stringify(statusMap));
}

function renderWeek() {
  const statusMap = loadWeekStatus();
  const members = loadFamilyMembers();
  const todayKey = toDateKey(new Date());
  weekList.innerHTML = "";

  for (const date of getPeriodDates()) {
    const dateKey = toDateKey(date);
    const entry = statusMap[dateKey];
    const notCooking = Boolean(entry && entry.cooking === false);
    // まだ何も選んでいない日は、家族全員が選択された状態を初期値にする
    const presentIds = notCooking
      ? []
      : entry && entry.presentIds
        ? entry.presentIds
        : members.map((m) => m.id);

    const li = document.createElement("li");
    if (dateKey === todayKey) li.classList.add("is-today");

    const label = document.createElement("span");
    label.className = "day-label";
    label.textContent = `${date.getMonth() + 1}/${date.getDate()}（${DAY_LABELS[(date.getDay() + 6) % 7]}）`;

    const group = document.createElement("div");
    group.className = "status-group";

    for (const member of members) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "status-btn member-btn";
      btn.textContent = member.name;
      const isSelected = !notCooking && presentIds.includes(member.id);
      if (isSelected) {
        btn.classList.add("is-selected");
      }
      btn.setAttribute("aria-pressed", String(isSelected));
      btn.addEventListener("click", () => {
        const current = loadWeekStatus();
        const currentEntry = current[dateKey];
        // 「作らない」の日や、まだ何も選んでいない日（＝全員選択済み扱い）を基準にする
        const baselineIds = currentEntry
          ? currentEntry.cooking === false
            ? []
            : currentEntry.presentIds || []
          : members.map((m) => m.id);
        const ids = new Set(baselineIds);
        if (ids.has(member.id)) ids.delete(member.id);
        else ids.add(member.id);
        current[dateKey] = { cooking: true, presentIds: [...ids] };
        saveWeekStatus(current);
        renderWeek();
      });
      group.appendChild(btn);
    }

    const noCookBtn = document.createElement("button");
    noCookBtn.type = "button";
    noCookBtn.className = "status-btn no-cook-btn";
    noCookBtn.textContent = "作らない";
    if (notCooking) noCookBtn.classList.add("is-selected");
    noCookBtn.setAttribute("aria-pressed", String(notCooking));
    noCookBtn.addEventListener("click", () => {
      const current = loadWeekStatus();
      if (current[dateKey] && current[dateKey].cooking === false) {
        delete current[dateKey]; // もう一度押したら未定に戻す
      } else {
        current[dateKey] = { cooking: false };
      }
      saveWeekStatus(current);
      renderWeek();
    });
    group.appendChild(noCookBtn);

    li.appendChild(label);
    li.appendChild(group);
    weekList.appendChild(li);
  }
}

renderWeek();

// 期間コントロール（開始日・終了日・前の期間/次の期間）
const periodStartInput = document.getElementById("period-start-input");
const periodEndInput = document.getElementById("period-end-input");
const prevPeriodBtn = document.getElementById("prev-period-btn");
const nextPeriodBtn = document.getElementById("next-period-btn");

function refreshPeriodInput() {
  periodStartInput.value = loadPeriodStart();
  periodEndInput.value = loadPeriodEnd();
}

// renderMenu・renderPeriodNotes・renderSideDishes は他ファイル（ai-load.js・
// period-notes.js・side-dishes.js）で定義されている。renderAll自体はボタン操作時
// にしか呼ばれないので、読み込み順の制約はない。
function renderAll() {
  renderWeek();
  renderMenu(); // この中でrenderShoppingList()も呼ばれる
  renderPeriodNotes();
  renderSideDishes();
}

function shiftPeriod(direction) {
  const dates = getPeriodDates();
  const lengthDays = dates.length;
  const newStart = new Date(dates[0]);
  newStart.setDate(newStart.getDate() + direction * lengthDays);
  const newEnd = new Date(newStart);
  newEnd.setDate(newStart.getDate() + lengthDays - 1);

  savePeriodStart(toDateKey(newStart));
  savePeriodEnd(toDateKey(newEnd));
  refreshPeriodInput();
  renderAll();
}

// 開始日・終了日をちょっと動かしただけ（期間の境界の微調整）だと、
// 「期間キー（開始日_終了日）」が変わってしまい、その期間に紐づく
// 「追加した物」「副菜」「結果・メモ」「購入チェック」が前のキーの下に
// 迷子になる。境界を動かすときは、前のキーのデータを新しいキーに
// そのまま引き継ぐ。（「次の期間/前の期間」で別の期間に移動するときは
// 引き継がない＝今の期間のデータは今の期間のまま残る。）
// PERIOD_NOTES_KEY・SIDE_DISH_KEY・EXTRA_SHOPPING_KEY・SHOPPING_CHECKED_KEY は
// 他ファイルで定義されているが、この関数はボタン操作時にしか呼ばれないので問題ない。
function migratePeriodScopedData(oldPeriodKey, newPeriodKey) {
  if (oldPeriodKey === newPeriodKey) return;
  const periodScopedStorageKeys = [PERIOD_NOTES_KEY, SIDE_DISH_KEY, EXTRA_SHOPPING_KEY, SHOPPING_CHECKED_KEY];
  for (const storageKey of periodScopedStorageKeys) {
    const raw = localStorage.getItem(storageKey);
    if (!raw) continue;
    let all;
    try {
      all = JSON.parse(raw);
    } catch {
      continue;
    }
    if (all[oldPeriodKey] !== undefined && all[newPeriodKey] === undefined) {
      all[newPeriodKey] = all[oldPeriodKey];
      delete all[oldPeriodKey];
      localStorage.setItem(storageKey, JSON.stringify(all));
    }
  }
}

prevPeriodBtn.addEventListener("click", () => shiftPeriod(-1));
nextPeriodBtn.addEventListener("click", () => shiftPeriod(1));
periodStartInput.addEventListener("change", () => {
  if (!periodStartInput.value) return;
  const oldPeriodKey = getPeriodKey();
  savePeriodStart(periodStartInput.value);
  if (parseDateKey(loadPeriodEnd()) < parseDateKey(periodStartInput.value)) {
    savePeriodEnd(periodStartInput.value);
  }
  migratePeriodScopedData(oldPeriodKey, getPeriodKey());
  refreshPeriodInput();
  renderAll();
});
periodEndInput.addEventListener("change", () => {
  if (!periodEndInput.value) return;
  if (parseDateKey(periodEndInput.value) < parseDateKey(loadPeriodStart())) {
    periodEndInput.value = loadPeriodEnd();
    return;
  }
  const oldPeriodKey = getPeriodKey();
  savePeriodEnd(periodEndInput.value);
  migratePeriodScopedData(oldPeriodKey, getPeriodKey());
  renderAll();
});

refreshPeriodInput();

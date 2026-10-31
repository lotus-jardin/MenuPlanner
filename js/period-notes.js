// 期間ごとの「結果・メモ」欄
const PERIOD_NOTES_KEY = "menuApp.periodNotes";
const periodNotesInput = document.getElementById("period-notes-input");

function loadAllPeriodNotes() {
  const raw = localStorage.getItem(PERIOD_NOTES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function renderPeriodNotes() {
  const all = loadAllPeriodNotes();
  periodNotesInput.value = all[getPeriodKey()] || "";
}

// blurだけだと入力直後にアプリを閉じた場合保存されないことがあるので、入力のたびにも保存する
periodNotesInput.addEventListener("input", () => {
  const all = loadAllPeriodNotes();
  all[getPeriodKey()] = periodNotesInput.value;
  localStorage.setItem(PERIOD_NOTES_KEY, JSON.stringify(all));
});
periodNotesInput.addEventListener("blur", () => {
  const all = loadAllPeriodNotes();
  const text = periodNotesInput.value.trim();
  const periodKey = getPeriodKey();
  if (text) {
    all[periodKey] = text;
  } else {
    delete all[periodKey];
  }
  localStorage.setItem(PERIOD_NOTES_KEY, JSON.stringify(all));
});

renderPeriodNotes();

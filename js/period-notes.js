// 期間ごとの「結果・メモ」欄と「実際にかかった金額」
const PERIOD_NOTES_KEY = "menuApp.periodNotes";
const PERIOD_ACTUAL_COST_KEY = "menuApp.periodActualCost";
const periodNotesInput = document.getElementById("period-notes-input");
const actualCostInput = document.getElementById("actual-cost-input");
const actualCostDiff = document.getElementById("actual-cost-diff");

function loadAllPeriodNotes() {
  const raw = localStorage.getItem(PERIOD_NOTES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function loadAllActualCosts() {
  const raw = localStorage.getItem(PERIOD_ACTUAL_COST_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function renderActualCostDiff() {
  const actual = loadAllActualCosts()[getPeriodKey()];
  const estimate = getEstimatedBudgetTotal();
  if (actual == null || !estimate) {
    actualCostDiff.textContent = estimate ? `推定予算は約¥${estimate.toLocaleString()}です。` : "";
    return;
  }
  const diff = actual - estimate;
  const diffText =
    diff === 0
      ? "ぴったりでした"
      : `¥${Math.abs(diff).toLocaleString()}${diff > 0 ? "多くかかりました" : "少なく済みました"}`;
  actualCostDiff.textContent = `推定予算 約¥${estimate.toLocaleString()} に対して、${diffText}。`;
}

function renderPeriodNotes() {
  const all = loadAllPeriodNotes();
  periodNotesInput.value = all[getPeriodKey()] || "";
  const cost = loadAllActualCosts()[getPeriodKey()];
  actualCostInput.value = cost == null ? "" : String(cost);
  renderActualCostDiff();
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

actualCostInput.addEventListener("input", () => {
  const all = loadAllActualCosts();
  const value = parseInt(toHalfWidthDigits(actualCostInput.value), 10);
  if (Number.isFinite(value) && value >= 0) all[getPeriodKey()] = value;
  else delete all[getPeriodKey()];
  localStorage.setItem(PERIOD_ACTUAL_COST_KEY, JSON.stringify(all));
  renderActualCostDiff();
});

renderPeriodNotes();

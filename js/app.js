// 「？」ボタン：このアプリについての説明パネル
const infoBtn = document.getElementById("info-btn");
const infoOverlay = document.getElementById("info-overlay");
const infoCloseBtn = document.getElementById("info-close-btn");

function openInfoPanel() {
  infoOverlay.hidden = false;
  infoCloseBtn.focus();
}

function closeInfoPanel() {
  infoOverlay.hidden = true;
  infoBtn.focus();
}

infoBtn.addEventListener("click", openInfoPanel);
infoCloseBtn.addEventListener("click", closeInfoPanel);
infoOverlay.addEventListener("click", (event) => {
  if (event.target === infoOverlay) closeInfoPanel();
});
infoOverlay.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeInfoPanel();
});

// 「食べたいものメモ」機能
// localStorage = スマホのブラウザの中にある保存場所。ページを閉じても消えない。
const STORAGE_KEY = "menuApp.wishList";

const form = document.getElementById("wish-form");
const input = document.getElementById("wish-input");
const list = document.getElementById("wish-list");
const emptyMessage = document.getElementById("empty-message");

function loadWishes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveWishes(wishes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wishes));
}

function render(wishes) {
  list.innerHTML = "";
  emptyMessage.style.display = wishes.length === 0 ? "block" : "none";

  for (const wish of wishes) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "wish-text";
    span.textContent = wish.text;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "削除");
    deleteBtn.addEventListener("click", () => {
      const wishes = loadWishes().filter((w) => w.id !== wish.id);
      saveWishes(wishes);
      render(wishes);
    });

    li.appendChild(span);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const wishes = loadWishes();
  wishes.unshift({ id: Date.now(), text });
  saveWishes(wishes);
  render(wishes);

  input.value = "";
  input.focus();
});

render(loadWishes());

// 「苦手な食材」のデータ読み書き（DISLIKE_STORAGE_KEY・loadDislikedIngredients）は
// js/shared.js にまとめてある（画面はdislikes.htmlの方にある）。
// ここに登録したものは、毎回のAIへの質問文で「使わないでください」として伝える。
// 「いつまで」が設定されていて、その日を過ぎていたら対象外にする（体調や時期によって一時的に避けたいもの、等）。

function loadActiveDislikedIngredients() {
  const todayKeyValue = toDateKey(new Date());
  return loadDislikedIngredients().filter((item) => !item.until || item.until >= todayKeyValue);
}

// 「今ある食材」機能
// 家にある食材（品名＋量）を書いておくと、AIへの質問文に含めて使い切りを提案してもらえる。
// 買う食材リストからも自動で除外される。
const STOCK_STORAGE_KEY = "menuApp.stock";

const stockForm = document.getElementById("stock-form");
const stockNameInput = document.getElementById("stock-name-input");
const stockAmountInput = document.getElementById("stock-amount-input");
const stockList = document.getElementById("stock-list");
const stockEmptyMessage = document.getElementById("stock-empty-message");

function loadStock() {
  const raw = localStorage.getItem(STOCK_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStock(items) {
  localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(items));
}

function renderStock() {
  const items = loadStock();
  stockList.innerHTML = "";
  stockEmptyMessage.style.display = items.length === 0 ? "block" : "none";

  for (const item of items) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "wish-text";
    span.textContent = item.amount ? `${item.name}（${item.amount}）` : item.name;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "削除");
    deleteBtn.addEventListener("click", () => {
      const current = loadStock().filter((i) => i.id !== item.id);
      saveStock(current);
      renderStock();
      renderShoppingList();
    });

    li.appendChild(span);
    li.appendChild(deleteBtn);
    stockList.appendChild(li);
  }
}

stockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = stockNameInput.value.trim();
  if (!name) return;
  const amount = stockAmountInput.value.trim();

  const items = loadStock();
  items.unshift({ id: Date.now(), name, amount });
  saveStock(items);
  renderStock();
  renderShoppingList();

  stockNameInput.value = "";
  stockAmountInput.value = "";
  stockNameInput.focus();
});

renderStock();

// 「調味料マスタ」「家族構成」のデータ読み込みは js/shared.js にまとめてある
// （index.htmlでjs/app.jsより先に読み込んでいる）。

// 「今週の予定」機能
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
function migratePeriodScopedData(oldPeriodKey, newPeriodKey) {
  if (oldPeriodKey === newPeriodKey) return;
  // 呼ばれる時点（ボタン操作後）では全部定義済みなので、ここで組み立てる
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

// 「アレルギー」のデータ読み書き（ALLERGY_STORAGE_KEY・loadAllergies）は js/shared.js に
// まとめてある。苦手な食材とは別枠で管理し、AIへの質問文では「絶対に使わないでください」
// という強い言い方で伝える。安全に関わるため、誰が対象かも書いて伝える。

// 「AIに献立を考えてもらう」機能
// 裏方サーバーは使わず、質問文をコピーしてお好きなAIツールに貼り付けてもらい、
// 返ってきた答えを貼り付けてもらう方式（無料で使える）。
// MENU_STORAGE_KEY・loadMenu・saveMenu は js/shared.js にまとめてある。

const makePromptBtn = document.getElementById("make-prompt-btn");
const promptArea = document.getElementById("prompt-area");
const promptOutput = document.getElementById("prompt-output");
const copyPromptBtn = document.getElementById("copy-prompt-btn");
const copyStatus = document.getElementById("copy-status");
const aiResponseInput = document.getElementById("ai-response-input");
const loadMenuBtn = document.getElementById("load-menu-btn");
const loadStatus = document.getElementById("load-status");
const menuList = document.getElementById("menu-list");
const shoppingList = document.getElementById("shopping-list");
const shoppingEmpty = document.getElementById("shopping-empty");
const budgetEstimate = document.getElementById("budget-estimate");

function buildPrompt() {
  const wishes = loadWishes();
  const wishText =
    wishes.length > 0 ? wishes.map((w) => `・${w.text}`).join("\n") : "（特になし）";

  const stockItems = loadStock();
  const stockText =
    stockItems.length > 0
      ? stockItems.map((i) => `・${i.name}${i.amount ? `（${i.amount}）` : ""}`).join("\n")
      : "（特になし）";

  const members = loadFamilyMembers();
  const memberById = new Map(members.map((m) => [m.id, m]));

  function formatTargetMembers(memberIds) {
    const names = (memberIds || []).map((id) => memberById.get(id)).filter(Boolean).map((m) => m.name);
    return names.length > 0 ? names.join("・") : "家族全員";
  }

  const dislikedItems = loadActiveDislikedIngredients();
  const dislikedText =
    dislikedItems.length > 0
      ? dislikedItems.map((i) => `・${i.text}（対象：${formatTargetMembers(i.memberIds)}）`).join("\n")
      : "（特になし）";

  const allergyItems = loadAllergies();
  const allergyText =
    allergyItems.length > 0
      ? allergyItems.map((i) => `・${i.text}（対象：${formatTargetMembers(i.memberIds)}）`).join("\n")
      : "（登録なし）";

  const statusMap = loadWeekStatus();
  const days = getPeriodDates()
    .map((date) => {
      const dateKey = toDateKey(date);
      const entry = statusMap[dateKey];
      if (entry && entry.cooking === false) return `${dateKey}: 作らない`;

      // まだ何も選んでいない日は、家族全員がいるものとして扱う
      const presentIds = entry && entry.presentIds ? entry.presentIds : members.map((m) => m.id);
      const present = presentIds.map((id) => memberById.get(id)).filter(Boolean);
      const adults = present.filter((m) => m.type === "adult").length;
      const children = present.filter((m) => m.type === "child").length;
      const names =
        present
          .map((m) => (m.type === "child" && m.phase ? `${m.name}【${m.phase}】` : m.name))
          .join("・") || "未選択";
      return `${dateKey}: 大人${adults}人・子ども${children}人（${names}）`;
    })
    .join("\n");

  const extraInstruction = loadExtraInstruction();
  const extraInstructionBlock = extraInstruction
    ? `\n【追加の指示】\n${extraInstruction}\n`
    : "";

  const preferenceProfile = loadPreferenceProfile();
  const preferenceBlock = preferenceProfile
    ? `\n【好みと傾向】\n${preferenceProfile}\n`
    : "";

  const dayCount = getPeriodDates().length;
  const sideDishCountValue = parseInt(loadSideDishCount(), 10);
  const sideDishCountText =
    Number.isFinite(sideDishCountValue) && sideDishCountValue >= 0
      ? `${sideDishCountValue}品`
      : "2品程度";

  return `あなたは家庭料理の献立を考える専門家です。以下の条件で、指定された期間（${dayCount}日間）分の晩ごはんの献立を提案してください。

【条件】
・以下の「苦手な食材」は使わないでください。
・以下の「アレルギー」に書かれている食材は、安全上の理由で、対象の家族がその日いるかどうかに関わらず、この期間中は一切使わないでください。少量の使用や、原材料として紛れ込む可能性（例：卵アレルギーならマヨネーズや練り物にも注意）にも配慮してください。
・「好みと傾向」が書かれている場合は、それも踏まえて味付けや献立の方向性を考えてください。
・「作らない」の日、または人数が0人や未選択の日は献立を考えず、dish を null、ingredients を空配列にしてください。
・各日に書かれている人数（大人◯人・子ども◯人）に合わせて、使う食材と分量を計算してください。人数が少ない日は、品数が少なめの簡単な料理でも構いません。
・子どもの名前の後ろに【】で年齢層が書かれている場合は、その年齢層に応じて、その子ども分の食材量を加減してください。
・できるだけ無添加・手作りの味付けにしたいので、カレールーやシチューのルー、めんつゆの素などの市販の合わせ調味料はなるべく使わず、しょうゆ・みそ・砂糖などを組み合わせて一から味付けする料理を優先してください。
・以下の「今ある食材」は、できるだけ使い切れるように献立に組み込んでください（無理に全部使う必要はありません）。
・以下の「食べたいものメモ」の中から、期間中に自然に使えそうなものがあれば積極的に取り入れてください（すべて使う必要はありません）。
・同じ料理が期間中に重複しないようにしてください。
・ingredients には、その日の料理に使う食材を全て入れてください（「今ある食材」で賄える分も、記録のためそのまま含めてください）。野菜だけでなく、肉・魚・調味料・加工品なども含めてください。各食材には name（食材名）、amount（分量、例: "300g"）、category（"肉・魚" "野菜" "調味料" "その他" のいずれか）、price（今の日本の物価を踏まえた概算の金額。円単位の数値。わからなければ0）を付けてください。
・ご飯などの主食は、炊いた後の状態（「ごはん 400g」など）ではなく、実際に買う単位（「米 2合」など）で記載してください。同じ食材は、期間を通してできるだけ同じ名前・同じ単位で統一してください（例: 米は毎回「米 ○合」のように書く）。
・メインの献立とは別に、この期間（${dayCount}日間）で合計${sideDishCountText}くらいを目安に副菜（取り分けしやすい小鉢料理など）も提案し、sideDishes に入れてください。${sideDishCountValue === 0 ? "（0品の場合は副菜を提案せず、sideDishesは空配列にしてください）" : ""}
${extraInstructionBlock}${preferenceBlock}
【苦手な食材（使わないでください）】
${dislikedText}

【アレルギー（安全のため絶対に使わないでください）】
${allergyText}

【食べたいものメモ】
${wishText}

【今ある食材】
${stockText}

【対象期間の予定】
${days}

【出力形式】
説明や前置きは一切不要です。次のJSON形式のみを出力してください（\`\`\`で囲んでも囲まなくても構いません）。
{
  "days": [
    {
      "date": "YYYY-MM-DD",
      "dish": "料理名またはnull",
      "note": "一言メモ（10〜20文字程度、取り分けのコツなど）",
      "ingredients": [
        { "name": "食材名", "amount": "分量", "category": "肉・魚", "price": 300 }
      ]
    }
  ],
  "sideDishes": [
    { "dish": "副菜名", "note": "一言メモ" }
  ]
}`;
}

makePromptBtn.addEventListener("click", () => {
  promptOutput.value = buildPrompt();
  promptArea.hidden = false;
  copyStatus.textContent = "";
});

copyPromptBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(promptOutput.value);
    copyStatus.textContent = "コピーしました。お使いのAIツールに貼り付けてください。";
    copyStatus.classList.remove("is-error");
  } catch {
    // クリップボードが使えない環境向けに、手動選択できるようにしておく
    promptOutput.focus();
    promptOutput.select();
    copyStatus.textContent = "自動コピーできませんでした。テキストが選択されているので、そのままコピーしてください。";
    copyStatus.classList.add("is-error");
  }
});

// 「軽めに」「豚肉なしで」のような追加指示（次に質問文を作るときに反映される）
const EXTRA_INSTRUCTION_KEY = "menuApp.extraInstruction";
const extraInstructionInput = document.getElementById("extra-instruction-input");

function loadExtraInstruction() {
  return localStorage.getItem(EXTRA_INSTRUCTION_KEY) || "";
}

extraInstructionInput.value = loadExtraInstruction();
// blurだけだと、入力してすぐアプリを閉じたときに保存されないことがあるので、
// 入力のたびにも保存する（blurでは最後に前後の空白を取り除く）
extraInstructionInput.addEventListener("input", () => {
  localStorage.setItem(EXTRA_INSTRUCTION_KEY, extraInstructionInput.value);
});
extraInstructionInput.addEventListener("blur", () => {
  extraInstructionInput.value = extraInstructionInput.value.trim();
  localStorage.setItem(EXTRA_INSTRUCTION_KEY, extraInstructionInput.value);
});

// 副菜の品数（この期間で合計何品くらい欲しいか。空欄なら2品程度をデフォルトにする）
const SIDE_DISH_COUNT_KEY = "menuApp.sideDishCount";
const sideDishCountInput = document.getElementById("side-dish-count-input");

function loadSideDishCount() {
  return localStorage.getItem(SIDE_DISH_COUNT_KEY) || "";
}

sideDishCountInput.value = loadSideDishCount();
sideDishCountInput.addEventListener("input", () => {
  localStorage.setItem(SIDE_DISH_COUNT_KEY, sideDishCountInput.value);
});
sideDishCountInput.addEventListener("blur", () => {
  sideDishCountInput.value = sideDishCountInput.value.trim();
  localStorage.setItem(SIDE_DISH_COUNT_KEY, sideDishCountInput.value);
});

// 「好みと傾向」のデータ読み込み（画面はmenus.htmlの方にある）
// 保存した献立をAIに分析させた結果（手で書き直せる）。毎回の質問文に含める。
const PREFERENCE_PROFILE_KEY = "menuApp.preferenceProfile";

function loadPreferenceProfile() {
  return localStorage.getItem(PREFERENCE_PROFILE_KEY) || "";
}

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

// AIが提案する「副菜」（期間ごとに保存）
// SIDE_DISH_KEY・loadAllSideDishes・saveSideDishesForPeriod は js/shared.js にまとめてある。
const sideDishList = document.getElementById("side-dish-list");
const sideDishEmpty = document.getElementById("side-dish-empty");

function renderSideDishes() {
  const dishes = loadAllSideDishes()[getPeriodKey()] || [];
  sideDishList.innerHTML = "";
  sideDishEmpty.style.display = dishes.length === 0 ? "block" : "none";

  for (const dish of dishes) {
    const li = document.createElement("li");

    const dishLabel = document.createElement("span");
    dishLabel.className = "menu-dish-btn";
    dishLabel.textContent = dish.dish || "";
    li.appendChild(dishLabel);

    if (dish.note) {
      const noteLabel = document.createElement("span");
      noteLabel.className = "menu-note";
      noteLabel.textContent = dish.note;
      li.appendChild(noteLabel);
    }

    sideDishList.appendChild(li);
  }
}

renderSideDishes();

// 「献立リスト」への保存（期間に名前を付けてブックマークしておく機能。画面は menus.html）
// SAVED_MENUS_KEY・loadSavedMenus・saveSavedMenus は js/shared.js にまとめてある。
const saveMenuForm = document.getElementById("save-menu-form");
const saveMenuLabelInput = document.getElementById("save-menu-label-input");
const saveMenuStatus = document.getElementById("save-menu-status");

saveMenuForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const start = loadPeriodStart();
  const end = loadPeriodEnd();
  const label = saveMenuLabelInput.value.trim() || `${start} 〜 ${end}`;

  // 期間（開始日・終了日）のしおりだけでなく、保存した時点の献立・副菜の
  // 中身も一緒に保存しておく。しおりだけだと、同じ日付でAIの献立を読み込み
  // 直したときに、保存したはずの内容が気づかないうちに置き換わってしまう。
  const menuMap = loadMenu();
  const menuSnapshot = {};
  for (const date of getPeriodDates()) {
    const dateKey = toDateKey(date);
    if (menuMap[dateKey]) menuSnapshot[dateKey] = menuMap[dateKey];
  }
  const sideDishesSnapshot = loadAllSideDishes()[getPeriodKey()] || [];

  const list = loadSavedMenus();
  list.unshift({
    id: Date.now(),
    periodStart: start,
    periodEnd: end,
    label,
    savedAt: new Date().toISOString(),
    menuSnapshot,
    sideDishesSnapshot,
  });
  saveSavedMenus(list);

  saveMenuLabelInput.value = "";
  saveMenuStatus.textContent = "保存しました。「保存した献立リストを見る」から確認できます。";
  saveMenuStatus.classList.remove("is-error");
});

// ChatGPTなどが「"」の代わりに全角っぽい引用符（" "）を使ってしまうことがある。
// JSONとしては無効なので、素直な引用符に直す。
function normalizeSmartQuotes(text) {
  return text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

// 「"ingredients": { … }, { … }, { … }」のように、本来 [ ... ] で囲むはずの
// オブジェクトの並びを、角かっこ無しでそのまま書いてしまうことがある
// （ChatGPTで時々見られる崩れ方）。コロンの直後が「{ … }, { … }」の形に
// なっている箇所を探して、[ ... ] で囲み直す。文字列の中の { } や , は
// 無視するよう、引用符の中身は読み飛ばしながら1文字ずつ見ていく。
function wrapMissingArrayBrackets(text) {
  let result = "";
  let i = 0;
  const n = text.length;

  function skipString(startIdx) {
    let j = startIdx + 1;
    while (j < n) {
      if (text[j] === "\\") {
        j += 2;
        continue;
      }
      if (text[j] === '"') return j + 1;
      j++;
    }
    return j;
  }

  function findMatchingBrace(startIdx) {
    let depth = 0;
    let j = startIdx;
    while (j < n) {
      const ch = text[j];
      if (ch === '"') {
        j = skipString(j);
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return j;
      }
      j++;
    }
    return -1;
  }

  while (i < n) {
    if (text[i] === '"') {
      const end = skipString(i);
      result += text.slice(i, end);
      i = end;
      continue;
    }
    if (text[i] === ":") {
      result += text[i];
      i++;
      let k = i;
      while (k < n && /\s/.test(text[k])) k++;
      if (text[k] === "{") {
        const firstClose = findMatchingBrace(k);
        if (firstClose !== -1) {
          let m = firstClose + 1;
          while (m < n && /\s/.test(text[m])) m++;
          if (text[m] === ",") {
            let m2 = m + 1;
            while (m2 < n && /\s/.test(text[m2])) m2++;
            if (text[m2] === "{") {
              // 2つ目以降の { が続く＝配列のはずだったと判断し、末尾まで辿る
              let segEnd = firstClose;
              let cursor = m2;
              while (true) {
                const close = findMatchingBrace(cursor);
                if (close === -1) break;
                segEnd = close;
                let p = close + 1;
                while (p < n && /\s/.test(text[p])) p++;
                if (text[p] === ",") {
                  let p2 = p + 1;
                  while (p2 < n && /\s/.test(text[p2])) p2++;
                  if (text[p2] === "{") {
                    cursor = p2;
                    continue;
                  }
                }
                break;
              }
              result += text.slice(i, k);
              result += "[" + text.slice(k, segEnd + 1) + "]";
              i = segEnd + 1;
              continue;
            }
          }
        }
      }
      continue;
    }
    result += text[i];
    i++;
  }
  return result;
}

// AIの返事はコードブロック（```）で囲まれていたり、前置きの文章が付いていたりと
// 形式がバラつきやすい。何パターンか試して、読み取れたものを使う。
function extractJson(text) {
  const trimmed = text.trim();
  const candidates = [];

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) candidates.push(fenceMatch[1]);

  candidates.push(trimmed);

  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // AIがたまに付けてしまう末尾の余分なカンマを取り除いて、もう一度だけ試す
      try {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
      } catch {
        // それでも読み取れない場合、スマート引用符・配列の角かっこ抜けという
        // よくある崩れ方を直してから最後にもう一度だけ試す
        try {
          const repaired = wrapMissingArrayBrackets(normalizeSmartQuotes(candidate)).replace(
            /,\s*([}\]])/g,
            "$1"
          );
          return JSON.parse(repaired);
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

// AIが"2026-10-1"のように指定と違う日付形式を返したり、"2026-13-45"のような
// 存在しない日付・期間の外の日付を返したりすると、カレンダー側では一致する日が
// 見つからず、エラーも出ないままその日の献立だけ表示されなくなる。
// それを防ぐため、読み込み時に「今回の期間に実在する日付か」までチェックする。
function isValidPeriodDateKey(dateKey) {
  return getPeriodDates().some((date) => toDateKey(date) === dateKey);
}

// 読み込んだ食材に、登録済みのアレルギー・苦手食材と同じ・似た名前が無いか
// 簡単に突き合わせる。文字列の部分一致だけなので完璧ではないが、
// 確認を忘れたときの保険として。
function findSafetyMatches(menuMap, dateKeys) {
  const allergyItems = loadAllergies().filter((i) => i.text && i.text.trim());
  const dislikeItems = loadActiveDislikedIngredients().filter((i) => i.text && i.text.trim());
  const matches = [];

  for (const dateKey of dateKeys) {
    const entry = menuMap[dateKey];
    if (!entry) continue;

    // ingredientsに明記されていなくても、料理名自体にアレルギー・苦手食材の
    // 名前が含まれていることがある（例：「エビチリ」だがingredientsにエビの記載漏れ）
    if (entry.dish) {
      for (const item of allergyItems) {
        if (entry.dish.includes(item.text) || item.text.includes(entry.dish)) {
          matches.push({ dateKey, dish: entry.dish, ingredientName: "料理名", label: item.text, kind: "アレルギー" });
        }
      }
      for (const item of dislikeItems) {
        if (entry.dish.includes(item.text) || item.text.includes(entry.dish)) {
          matches.push({ dateKey, dish: entry.dish, ingredientName: "料理名", label: item.text, kind: "苦手な食材" });
        }
      }
    }

    if (!Array.isArray(entry.ingredients)) continue;
    for (const ing of entry.ingredients) {
      if (!ing.name) continue;
      for (const item of allergyItems) {
        if (ing.name.includes(item.text) || item.text.includes(ing.name)) {
          matches.push({ dateKey, dish: entry.dish, ingredientName: ing.name, label: item.text, kind: "アレルギー" });
        }
      }
      for (const item of dislikeItems) {
        if (ing.name.includes(item.text) || item.text.includes(ing.name)) {
          matches.push({ dateKey, dish: entry.dish, ingredientName: ing.name, label: item.text, kind: "苦手な食材" });
        }
      }
    }
  }
  return matches;
}

loadMenuBtn.addEventListener("click", () => {
  const text = aiResponseInput.value.trim();
  if (!text) {
    loadStatus.textContent = "AIの返事を貼り付けてから押してください。";
    loadStatus.classList.add("is-error");
    return;
  }

  const parsed = extractJson(text);
  if (!parsed) {
    loadStatus.textContent = "読み取れませんでした。AIの返事の中にJSON（{ … }の形式のデータ）が見つかりません。AIの返事を、説明文も含めてそのまま全部貼り付けてみてください。";
    loadStatus.classList.add("is-error");
    return;
  }
  if (!Array.isArray(parsed.days)) {
    loadStatus.textContent = "JSONとしては読み取れましたが、「days」のデータが見つかりませんでした。質問文の形式が守られていない可能性があるので、AIにもう一度、指定した形式で出し直してもらってください。";
    loadStatus.classList.add("is-error");
    return;
  }

  const menuMap = loadMenu();
  const updatedDateKeys = [];
  let invalidDateCount = 0;
  for (const day of parsed.days) {
    if (!day.date) continue;
    if (!isValidPeriodDateKey(day.date)) {
      invalidDateCount++;
      continue;
    }
    const rawIngredients = day.ingredients || day.vegetables;
    menuMap[day.date] = {
      dish: day.dish || null,
      note: day.note || "",
      ingredients: Array.isArray(rawIngredients)
        ? rawIngredients.filter(Boolean).map(normalizeIngredient)
        : [],
    };
    updatedDateKeys.push(day.date);
  }
  saveMenu(menuMap);
  renderMenu();

  if (Array.isArray(parsed.sideDishes)) {
    saveSideDishesForPeriod(getPeriodKey(), parsed.sideDishes.filter((d) => d && d.dish));
    renderSideDishes();
  }

  const safetyMatches = findSafetyMatches(menuMap, updatedDateKeys);

  const statusLines = ["読み込みました。下に献立が表示されています。"];
  let hasWarning = false;

  if (invalidDateCount > 0) {
    statusLines.push(`⚠️ ${invalidDateCount}件、日付が正しく読み取れず反映できませんでした（形式が違う、または指定した期間の外の日付です）。AIに「YYYY-MM-DD」形式・指定した期間内で出し直してもらってください。`);
    hasWarning = true;
  }

  if (safetyMatches.length > 0) {
    const allergyMatches = safetyMatches.filter((m) => m.kind === "アレルギー");
    const target = allergyMatches.length > 0 ? allergyMatches : safetyMatches;
    const examples = target
      .slice(0, 3)
      .map((m) => `${m.dateKey}「${m.dish || "（献立なし）"}」の${m.ingredientName}（${m.kind}：${m.label}）`)
      .join("、");
    statusLines.push(`⚠️ ${allergyMatches.length > 0 ? "アレルギー" : "苦手な食材"}に似た名前の食材が見つかりました：${examples}。使う前に必ずご自身の目で確認してください。`);
    hasWarning = true;
  } else {
    statusLines.push("念のため、出来上がった献立にアレルギー・苦手食材が入っていないか確認してください。");
  }

  loadStatus.textContent = statusLines.join("\n");
  loadStatus.classList.toggle("is-error", hasWarning);
  aiResponseInput.value = "";
});

function formatDateLabel(date) {
  return `${date.getMonth() + 1}/${date.getDate()}（${DAY_LABELS[(date.getDay() + 6) % 7]}）`;
}

function renderMenu() {
  const menuMap = loadMenu();
  menuList.innerHTML = "";

  for (const date of getPeriodDates()) {
    const dateKey = toDateKey(date);
    const entry = menuMap[dateKey];
    if (!entry) continue;

    const li = document.createElement("li");
    li.dataset.dateKey = dateKey;

    const dateLabel = document.createElement("span");
    dateLabel.className = "menu-date";
    dateLabel.textContent = formatDateLabel(date);
    li.appendChild(dateLabel);

    const dishBtn = document.createElement("button");
    dishBtn.type = "button";
    dishBtn.className = "menu-dish-btn";
    dishBtn.textContent = entry.dish || "（作らない日・タップで入力）";
    dishBtn.addEventListener("click", () => startEditingDish(dateKey, date));
    li.appendChild(dishBtn);

    if (entry.note) {
      const noteLabel = document.createElement("span");
      noteLabel.className = "menu-note";
      noteLabel.textContent = entry.note;
      li.appendChild(noteLabel);
    }

    menuList.appendChild(li);
  }

  renderShoppingList();
}

function startEditingDish(dateKey, date) {
  const menuMap = loadMenu();
  const entry = menuMap[dateKey] || {};

  const li = document.createElement("li");

  const dateLabel = document.createElement("span");
  dateLabel.className = "menu-date";
  dateLabel.textContent = formatDateLabel(date);
  li.appendChild(dateLabel);

  const input = document.createElement("input");
  input.type = "text";
  input.className = "menu-dish-input";
  input.value = entry.dish || "";
  input.placeholder = "料理名を入力（空にすると「作らない」になります）";
  li.appendChild(input);

  const vegLabel = document.createElement("span");
  vegLabel.className = "menu-veg-label";
  vegLabel.textContent = "買う食材（1行に1つ。例: 鶏もも肉 300g）";
  li.appendChild(vegLabel);

  const vegInput = document.createElement("textarea");
  vegInput.className = "menu-veg-input";
  vegInput.rows = 2;
  vegInput.value = (entry.ingredients || entry.vegetables || [])
    .map((item) => {
      const { name, amount } = normalizeIngredient(item);
      return amount ? `${name} ${amount}` : name;
    })
    .join("\n");
  li.appendChild(vegInput);

  // 既存のその日の表示を、この編集中の表示に差し替える
  const existingLi = [...menuList.children].find((child) => child.dataset.dateKey === dateKey);
  if (existingLi) {
    menuList.replaceChild(li, existingLi);
  }

  let saved = false;
  function commit() {
    if (saved) return;
    saved = true;
    const current = loadMenu();
    const newDish = input.value.trim();

    // 手入力の行は分類・値段を持たないので、同じ名前の食材が他の記録にあれば
    // そこから分類・値段を引き継ぐ（そうしないと毎回「その他」・0円にリセットされる）
    const knownByName = new Map();
    for (const dayEntry of Object.values(current)) {
      const ings = (dayEntry && (dayEntry.ingredients || dayEntry.vegetables)) || [];
      for (const ing of ings) {
        const norm = normalizeIngredient(ing);
        if (norm.name && !knownByName.has(norm.name) && (norm.category !== "その他" || norm.price)) {
          knownByName.set(norm.name, { category: norm.category, price: norm.price });
        }
      }
    }

    const newIngredients = vegInput.value
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const norm = normalizeIngredient(line);
        const known = knownByName.get(norm.name);
        return known ? { ...norm, category: known.category, price: known.price } : norm;
      });
    current[dateKey] = { ...current[dateKey], dish: newDish || null, ingredients: newIngredients };
    saveMenu(current);
    renderMenu();

    // AIの返事を読み込んだときだけでなく、手で食材を書き換えたときも
    // 登録済みのアレルギー・苦手食材と似た名前がないか確認する
    const safetyMatches = findSafetyMatches(current, [dateKey]);
    if (safetyMatches.length > 0) {
      const allergyMatches = safetyMatches.filter((m) => m.kind === "アレルギー");
      const target = allergyMatches.length > 0 ? allergyMatches : safetyMatches;
      const examples = target
        .slice(0, 3)
        .map((m) => `${m.ingredientName}（${m.kind}：${m.label}）`)
        .join("、");
      loadStatus.textContent = `⚠️ ${allergyMatches.length > 0 ? "アレルギー" : "苦手な食材"}に似た名前の食材が見つかりました：${examples}。使う前に必ずご自身の目で確認してください。`;
      loadStatus.classList.add("is-error");
    }
  }

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") event.preventDefault();
  });
  input.addEventListener("blur", (event) => {
    if (event.relatedTarget !== vegInput) commit();
  });
  vegInput.addEventListener("blur", (event) => {
    if (event.relatedTarget !== input) commit();
  });

  input.focus();
  input.select();
}

// 肉や魚 → 野菜 → その他 → 調味料 の順で買う食材リストに並べる
const CATEGORY_ORDER = ["肉・魚", "野菜", "その他", "調味料"];

// AIや手入力で表記がゆれやすい食材名（ひらがな/漢字など）を、調味料マスタ・在庫と
// 正しく照合できるようにまとめる。グループの先頭が表示・照合に使う代表名になる。
const INGREDIENT_SYNONYMS = [
  ["醤油", "しょうゆ", "しょう油", "醬油"],
  ["味噌", "みそ", "お味噌"],
  ["料理酒", "酒", "清酒", "日本酒"],
  ["ごま油", "胡麻油"],
  ["こしょう", "胡椒", "コショウ"],
  ["だしの素", "出汁の素", "顆粒だし"],
  ["片栗粉", "かたくり粉"],
  ["米", "ごはん", "ご飯", "白米", "お米"],
];

function canonicalizeIngredientName(name) {
  const trimmed = (name || "").trim();
  for (const group of INGREDIENT_SYNONYMS) {
    if (group.includes(trimmed)) return group[0];
  }
  return trimmed;
}

// 「２本」のように全角数字で入力・返答されると、parseAmount等の数字判定に
// 引っかからず合計できない。量の文字列中の全角数字だけ半角に変換しておく。
function toHalfWidthDigits(text) {
  return (text || "").replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0));
}

// AIが price を "300" や "300円" のような文字列で返すことがある。数値以外の
// 文字を取り除いてから数値に変換し、読み取れなければ0にする。
function parsePrice(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const digits = toHalfWidthDigits(value).replace(/[^\d.]/g, "");
    const parsed = parseFloat(digits);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function normalizeIngredient(item) {
  if (typeof item === "string") {
    const match = item.match(/^(\S+)\s*(.*)$/);
    const name = canonicalizeIngredientName(match ? match[1] : item);
    const amount = toHalfWidthDigits(match ? match[2].trim() : "");
    return { name, amount, category: "その他", price: 0 };
  }
  const name = canonicalizeIngredientName((item && item.name) || "");
  const amount = toHalfWidthDigits((item && item.amount) || "");
  const category = CATEGORY_ORDER.includes(item && item.category) ? item.category : "その他";
  const price = parsePrice(item && item.price);
  return { name, amount, category, price };
}

// 「2本」「300g」「大さじ2」のような分量を、できる範囲で数値として読み取る。
// 単位が同じもの同士だけ合計できる（単位が違う・読み取れないものが混ざっていたら合計はしない）。
function parseAmount(amount) {
  if (!amount) return null;
  const trimmed = amount.trim();

  // 「2本」「300g」「1/2個」のように数字が先にあるパターン
  let match = trimmed.match(/^(\d+\/\d+|\d+(?:\.\d+)?)\s*(\S*)$/);
  if (match) {
    let value;
    if (match[1].includes("/")) {
      const [a, b] = match[1].split("/").map(Number);
      value = b ? a / b : NaN;
    } else {
      value = parseFloat(match[1]);
    }
    if (Number.isNaN(value)) return null;
    return { value, unit: match[2] || "" };
  }

  // 「大さじ2」「小さじ1」のように数字が後ろにあるパターン
  match = trimmed.match(/^(\D+?)(\d+(?:\.\d+)?)$/);
  if (match) {
    const value = parseFloat(match[2]);
    if (Number.isNaN(value)) return null;
    return { value, unit: match[1] };
  }

  return null;
}

function sumAmounts(amounts) {
  const nonEmpty = amounts.filter(Boolean);
  if (nonEmpty.length === 0) return null;

  const parsed = nonEmpty.map(parseAmount);
  if (parsed.some((p) => !p)) return null;

  const unit = parsed[0].unit;
  if (!parsed.every((p) => p.unit === unit)) return null;

  const total = Math.round(parsed.reduce((sum, p) => sum + p.value, 0) * 100) / 100;
  return `${total}${unit}`;
}

// 「ほしいもの」を自分で買う食材リストに手動で追加する機能（期間ごとに保存）
const EXTRA_SHOPPING_KEY = "menuApp.extraShoppingItems";
const extraShoppingForm = document.getElementById("extra-shopping-form");
const extraShoppingNameInput = document.getElementById("extra-shopping-name-input");
const extraShoppingAmountInput = document.getElementById("extra-shopping-amount-input");

function loadAllExtraShoppingItems() {
  const raw = localStorage.getItem(EXTRA_SHOPPING_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function loadExtraShoppingItems(periodKey) {
  return loadAllExtraShoppingItems()[periodKey] || [];
}

function saveExtraShoppingItems(periodKey, items) {
  const all = loadAllExtraShoppingItems();
  all[periodKey] = items;
  localStorage.setItem(EXTRA_SHOPPING_KEY, JSON.stringify(all));
}

extraShoppingForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = extraShoppingNameInput.value.trim();
  if (!name) return;
  const amount = extraShoppingAmountInput.value.trim();

  const periodKey = getPeriodKey();
  const items = loadExtraShoppingItems(periodKey);
  items.push({ id: Date.now(), name, amount });
  saveExtraShoppingItems(periodKey, items);
  renderShoppingList();

  extraShoppingNameInput.value = "";
  extraShoppingAmountInput.value = "";
  extraShoppingNameInput.focus();
});

// チェック済み（買った）状態は期間ごとに分けて保存する。食材名だけで保存すると、
// 先週チェックした「鶏肉」が来週分でもチェック済みのまま出てきてしまうため。
const SHOPPING_CHECKED_KEY = "menuApp.shoppingChecked";

function loadAllShoppingChecked() {
  const raw = localStorage.getItem(SHOPPING_CHECKED_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function loadShoppingChecked(periodKey) {
  return loadAllShoppingChecked()[periodKey] || {};
}

function saveShoppingChecked(periodKey, checkedMap) {
  const all = loadAllShoppingChecked();
  all[periodKey] = checkedMap;
  localStorage.setItem(SHOPPING_CHECKED_KEY, JSON.stringify(all));
}

// 買う食材リストの中身（カテゴリごとにまとめた食材 + 手動追加した物）を組み立てる。
// 画面表示（renderShoppingList）と、共有用テキスト作成（buildShoppingShareText）の両方で使う。
function getShoppingGroups() {
  const menuMap = loadMenu();
  const grouped = new Map(); // 食材名 -> { category, items: [{ dayLabel, amount, price }] }

  for (const date of getPeriodDates()) {
    const entry = menuMap[toDateKey(date)];
    const ingredients = entry && (entry.ingredients || entry.vegetables);
    if (!ingredients) continue;

    const dayLabel = DAY_LABELS[(date.getDay() + 6) % 7];
    for (const raw of ingredients) {
      const { name, amount, category, price } = normalizeIngredient(raw);
      if (!name) continue;
      if (!grouped.has(name)) grouped.set(name, { category, items: [] });
      grouped.get(name).items.push({ dayLabel, amount, price });
    }
  }

  // 調味料マスタで「家にある」ものは、量を問わず買う食材リストから除く（常備している前提）
  const pantryExcludeSet = new Set(
    loadPantry().filter((item) => item.hasIt).map((item) => canonicalizeIngredientName(item.name))
  );
  for (const name of pantryExcludeSet) {
    grouped.delete(name);
  }

  // 「今ある食材」は、必要量から在庫量を差し引く。在庫だけで足りる（必要量以上ある）場合だけ
  // リストから除き、足りない場合は残りの必要量を表示する。量が比べられない場合は、
  // 買い忘れを防ぐため安全側に倒して全量をリストに残す。
  for (const stockItem of loadStock()) {
    const stockName = canonicalizeIngredientName(stockItem.name);
    const entry = grouped.get(stockName);
    if (!entry) continue;

    if (!stockItem.amount) {
      // 在庫に量の指定がない（品名だけ登録されている）場合は、これまで通り除外する
      grouped.delete(stockName);
      continue;
    }

    const neededTotal = sumAmounts(entry.items.map((item) => item.amount));
    const neededParsed = neededTotal ? parseAmount(neededTotal) : null;
    const stockParsed = parseAmount(stockItem.amount);

    if (neededParsed && stockParsed && neededParsed.unit === stockParsed.unit) {
      const remaining = Math.round((neededParsed.value - stockParsed.value) * 100) / 100;
      if (remaining <= 0) {
        grouped.delete(stockName);
      } else {
        entry.remainingAmount = `${remaining}${neededParsed.unit}`;
        // 予算も、必要量のうち在庫で賄えない割合だけに縮小する（そうしないと
        // 在庫を引いた後も、引く前の全量ぶんの金額が予算に乗ったままになる）
        entry.remainingRatio = neededParsed.value > 0 ? remaining / neededParsed.value : 1;
      }
    }
    // 単位が違う・量を読み取れない等で比べられない場合は何もしない（全量を残す）
  }

  const extraItems = loadExtraShoppingItems(getPeriodKey());
  return { grouped, extraItems };
}

function renderShoppingList() {
  const { grouped, extraItems } = getShoppingGroups();
  const periodKey = getPeriodKey();

  shoppingList.innerHTML = "";

  const checkedMap = loadShoppingChecked(periodKey);

  shoppingEmpty.style.display = grouped.size === 0 && extraItems.length === 0 ? "block" : "none";

  let totalBudget = 0;

  function appendShoppingRow(name, detailText, { deletable, onDelete } = {}) {
    const li = document.createElement("li");
    li.className = "shopping-item";
    if (checkedMap[name]) li.classList.add("is-checked");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "shopping-checkbox";
    checkbox.checked = Boolean(checkedMap[name]);
    checkbox.setAttribute("aria-label", `${name}を買った`);
    checkbox.addEventListener("change", () => {
      const current = loadShoppingChecked(periodKey);
      current[name] = checkbox.checked;
      saveShoppingChecked(periodKey, current);
      li.classList.toggle("is-checked", checkbox.checked);
    });
    li.appendChild(checkbox);

    const textWrap = document.createElement("span");
    textWrap.className = "shopping-text";

    const nameLabel = document.createElement("span");
    nameLabel.className = "shopping-name";
    nameLabel.textContent = name;
    textWrap.appendChild(nameLabel);

    if (detailText) {
      const detailLabel = document.createElement("span");
      detailLabel.className = "shopping-detail";
      detailLabel.textContent = detailText;
      textWrap.appendChild(detailLabel);
    }

    li.appendChild(textWrap);

    if (deletable) {
      const deleteBtn = document.createElement("button");
      deleteBtn.className = "delete-btn";
      deleteBtn.textContent = "×";
      deleteBtn.setAttribute("aria-label", "削除");
      deleteBtn.addEventListener("click", onDelete);
      li.appendChild(deleteBtn);
    }

    shoppingList.appendChild(li);
  }

  for (const category of CATEGORY_ORDER) {
    const entries = [...grouped].filter(([, value]) => value.category === category);
    if (entries.length === 0) continue;

    const headerLi = document.createElement("li");
    headerLi.className = "shopping-category";
    headerLi.textContent = category;
    shoppingList.appendChild(headerLi);

    for (const [name, { items, remainingAmount, remainingRatio }] of entries) {
      const rawTotal = items.reduce((sum, item) => sum + (item.price || 0), 0);
      const itemTotal = remainingRatio != null ? Math.round(rawTotal * remainingRatio) : rawTotal;
      totalBudget += itemTotal;

      const breakdown = items
        .map((item) => {
          const base = item.amount ? `${item.dayLabel} ${item.amount}` : item.dayLabel;
          return item.price ? `${base}（¥${item.price.toLocaleString()}）` : base;
        })
        .join(" ・ ");

      const total = sumAmounts(items.map((item) => item.amount));
      const totalLabel = remainingAmount
        ? `在庫を引いて残り ${remainingAmount}${itemTotal ? `（目安¥${itemTotal.toLocaleString()}）` : ""}`
        : total
          ? `合計 ${total}`
          : "";
      const detailText = totalLabel ? `${totalLabel} （${breakdown}）` : breakdown;

      appendShoppingRow(name, detailText);
    }
  }

  if (extraItems.length > 0) {
    const headerLi = document.createElement("li");
    headerLi.className = "shopping-category";
    headerLi.textContent = "追加した物";
    shoppingList.appendChild(headerLi);

    for (const item of extraItems) {
      appendShoppingRow(item.name, item.amount, {
        deletable: true,
        onDelete: () => {
          const current = loadExtraShoppingItems(getPeriodKey()).filter((i) => i.id !== item.id);
          saveExtraShoppingItems(getPeriodKey(), current);
          renderShoppingList();
        },
      });
    }
  }

  budgetEstimate.textContent =
    totalBudget > 0 ? `推定予算：約¥${totalBudget.toLocaleString()}（AIによる概算）` : "";
}

// 買う食材リストを、パートナーなどに頼みやすいテキストにして共有する機能。
// すでにチェック済み（買った）ものは除き、まだ買っていない分だけをまとめる。
function buildShoppingShareText() {
  const { grouped, extraItems } = getShoppingGroups();
  const checkedMap = loadShoppingChecked(getPeriodKey());
  const lines = [`買う食材リスト（${loadPeriodStart()} 〜 ${loadPeriodEnd()}）`];

  for (const category of CATEGORY_ORDER) {
    const entries = [...grouped].filter(
      ([name, value]) => value.category === category && !checkedMap[name]
    );
    if (entries.length === 0) continue;

    lines.push("", `【${category}】`);
    for (const [name, { items, remainingAmount }] of entries) {
      const total = sumAmounts(items.map((item) => item.amount));
      const amountText = remainingAmount || total || items.map((item) => item.amount).filter(Boolean).join("・");
      lines.push(amountText ? `・${name}（${amountText}）` : `・${name}`);
    }
  }

  const uncheckedExtra = extraItems.filter((item) => !checkedMap[item.name]);
  if (uncheckedExtra.length > 0) {
    lines.push("", "【追加した物】");
    for (const item of uncheckedExtra) {
      lines.push(item.amount ? `・${item.name}（${item.amount}）` : `・${item.name}`);
    }
  }

  return lines.join("\n").trim();
}

const shareShoppingBtn = document.getElementById("share-shopping-btn");
const shareShoppingStatus = document.getElementById("share-shopping-status");

shareShoppingBtn.addEventListener("click", async () => {
  const text = buildShoppingShareText();
  shareShoppingStatus.classList.remove("is-error");

  if (navigator.share) {
    try {
      await navigator.share({ text });
      return;
    } catch (err) {
      if (err && err.name === "AbortError") return; // 共有をキャンセルしただけなので何もしない
    }
  }

  try {
    await navigator.clipboard.writeText(text);
    shareShoppingStatus.textContent = "コピーしました。メッセージアプリなどに貼り付けてください。";
  } catch {
    shareShoppingStatus.textContent = "共有に失敗しました。もう一度お試しください。";
    shareShoppingStatus.classList.add("is-error");
  }
});

renderMenu();

// 「データのバックアップ」機能
// このアプリのデータ（menuApp. で始まるキー全部）をひとつのファイルに書き出し、
// 別の端末でそのファイルを取り込むと同じデータが復元できる（端末変更・夫婦間の共有用）。
const exportBackupBtn = document.getElementById("export-backup-btn");
const exportBackupStatus = document.getElementById("export-backup-status");
const lastBackupLabel = document.getElementById("last-backup-label");
const importBackupInput = document.getElementById("import-backup-input");
const importBackupStatus = document.getElementById("import-backup-status");
const importBackupLabel = document.getElementById("import-backup-label");

// ラベル要素は本来キーボードでは選べないので、Enter/Spaceでもファイル選択を開けるようにする
importBackupLabel.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    importBackupInput.click();
  }
});

// Safariはしばらく開かないと保存データが消えることがあるため、できるだけ消えにくくするよう頼んでおく
// （対応していないブラウザでは何もしない。ユーザーに確認が出ることもあるが、失敗しても無視してよい）
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

function collectBackupData() {
  const data = {};
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("menuApp.")) {
      data[key] = localStorage.getItem(key);
    }
  }
  return data;
}

// 最後にいつ書き出したか覚えておく（しばらく取っていないことに気づけるように）
const LAST_BACKUP_KEY = "menuApp.lastBackupAt";

function renderLastBackupDate() {
  const date = localStorage.getItem(LAST_BACKUP_KEY);
  if (!date) {
    lastBackupLabel.textContent = "まだ一度も書き出していません。";
    return;
  }
  const daysSince = Math.floor((new Date() - parseDateKey(date)) / (1000 * 60 * 60 * 24));
  const staleNote = daysSince >= 14 ? "（2週間以上たっています。書き出しをおすすめします）" : "";
  lastBackupLabel.textContent = `前回の書き出し：${date}${staleNote}`;
}

exportBackupBtn.addEventListener("click", () => {
  const json = JSON.stringify(collectBackupData(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `献立アプリ_バックアップ_${toDateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  localStorage.setItem(LAST_BACKUP_KEY, toDateKey(new Date()));
  renderLastBackupDate();

  exportBackupStatus.textContent = "書き出しました。このファイルを保存しておいてください。";
  exportBackupStatus.classList.remove("is-error");
});

renderLastBackupDate();

importBackupInput.addEventListener("change", async () => {
  const file = importBackupInput.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const keys = Object.keys(data).filter((key) => key.startsWith("menuApp."));
    if (keys.length === 0) throw new Error("menuAppのデータが見つからない");

    const ok = window.confirm("取り込むと、今この端末に入っているデータは上書きされます。よろしいですか？");
    if (!ok) {
      importBackupInput.value = "";
      return;
    }

    for (const key of keys) {
      localStorage.setItem(key, data[key]);
    }

    importBackupStatus.textContent = "取り込みました。画面を読み込み直します。";
    importBackupStatus.classList.remove("is-error");
    setTimeout(() => location.reload(), 800);
  } catch {
    importBackupStatus.textContent = "読み込めませんでした。「データを書き出す」で作ったファイルを選んでください。";
    importBackupStatus.classList.add("is-error");
    importBackupInput.value = "";
  }
});

// PWA用：Service Workerを登録してオフラインでも開けるようにする
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // 登録に失敗してもメモ機能自体は動くので無視してよい
    });
  });
}

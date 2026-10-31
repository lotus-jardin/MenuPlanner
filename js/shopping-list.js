// 「買う食材リスト」機能。献立（他ファイルの loadMenu）から自動で集計して表示する。
// CATEGORY_ORDER・normalizeIngredient・parseAmount・sumAmounts などの食材正規化は
// js/ingredient-utils.js にまとめてある。

const shoppingList = document.getElementById("shopping-list");
const shoppingEmpty = document.getElementById("shopping-empty");
const budgetEstimate = document.getElementById("budget-estimate");

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

  // チェックを入れた（買った）ものを除いた、残りの推定予算を計算し直すために、
  // 食材ごとの金額を覚えておく。
  const itemTotalByName = new Map();

  function recomputeBudgetEstimate() {
    const currentChecked = loadShoppingChecked(periodKey);
    let remaining = 0;
    for (const [name, itemTotal] of itemTotalByName) {
      if (!currentChecked[name]) remaining += itemTotal;
    }
    budgetEstimate.textContent =
      remaining > 0 ? `推定予算：約¥${remaining.toLocaleString()}（未購入分・AIによる概算）` : "";
  }

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
      recomputeBudgetEstimate();
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
      itemTotalByName.set(name, itemTotal);

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
          if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
          const current = loadExtraShoppingItems(getPeriodKey()).filter((i) => i.id !== item.id);
          saveExtraShoppingItems(getPeriodKey(), current);
          renderShoppingList();
        },
      });
    }
  }

  recomputeBudgetEstimate();
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

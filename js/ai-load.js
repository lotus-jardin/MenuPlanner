// AIの返事の読み込み・安全チェック・献立の表示と編集。
// 返事のJSON解析（extractJson等）は js/ai-parse.js にまとめてある。
const aiResponseInput = document.getElementById("ai-response-input");
const loadMenuBtn = document.getElementById("load-menu-btn");
const loadStatus = document.getElementById("load-status");
const menuList = document.getElementById("menu-list");

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

renderMenu();

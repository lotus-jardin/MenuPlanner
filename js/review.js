// 「ふりかえり」タブ：わが家の傾向（アプリが数える集計）・お気に入り料理・
// 好みと傾向（項目ごとの入力欄）・AIにまとめ直してもらう機能・更新のおすすめ表示。
const statsList = document.getElementById("stats-list");
const favoriteDishList = document.getElementById("favorite-dish-list");
const favoriteDishEmpty = document.getElementById("favorite-dish-empty");
const preferenceFieldsEl = document.getElementById("preference-fields");
const trendDetails = document.getElementById("trend-details");
const makeTrendPromptBtn = document.getElementById("make-trend-prompt-btn");
const copyTrendStatus = document.getElementById("copy-trend-status");
const trendPromptOutput = document.getElementById("trend-prompt-output");
const trendResponseInput = document.getElementById("trend-response-input");
const loadTrendBtn = document.getElementById("load-trend-btn");
const loadTrendStatus = document.getElementById("load-trend-status");
const preferenceUpdateBanner = document.getElementById("preference-update-banner");
const preferenceUpdateText = document.getElementById("preference-update-text");
const preferenceUpdateLink = document.getElementById("preference-update-link");

const TREND_DAYS = 56; // AIにまとめ直してもらうときに使う記録の期間（8週間）
const PREFERENCE_REMIND_DAYS = 28; // 前回の更新からこれだけ経ち、
const PREFERENCE_REMIND_MIN_RATED = 5; // その間に評価がこれだけたまったら更新をすすめる

function monthKeyOf(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function formatRating({ good, bad }) {
  const total = good + bad;
  if (total === 0) return "まだ評価がありません";
  return `👍 ${good}回・👎 ${bad}回（👍の割合 ${Math.round((good / total) * 100)}%）`;
}

function daysBetween(fromKey, toKey) {
  return Math.round((parseDateKey(toKey) - parseDateKey(fromKey)) / 86400000);
}

function renderStats() {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const todayKey = toDateKey(now);
  const favorites = getFavoriteDishes();
  const frequent = getFrequentIngredients(TREND_DAYS, 5);
  const longTimeNoSee = favorites.filter((s) => daysBetween(s.lastDate, todayKey) >= 30).slice(0, 5);

  const rows = [
    ["今月の評価", formatRating(getMonthlyRating(monthKeyOf(now)))],
    ["先月の評価", formatRating(getMonthlyRating(monthKeyOf(lastMonth)))],
    [
      "よく使う食材（直近8週間）",
      frequent.length ? frequent.map((f) => `${f.name}（${f.count}回）`).join("、") : "まだ記録がありません",
    ],
    [
      "👍が多い料理",
      favorites.length
        ? favorites
            .slice(0, 3)
            .map((s) => `${s.dish}（👍${s.good}）`)
            .join("、")
        : "まだありません",
    ],
    [
      "しばらく出ていない好評料理",
      longTimeNoSee.length ? longTimeNoSee.map((s) => s.dish).join("、") : "ありません",
    ],
  ];

  statsList.innerHTML = "";
  for (const [term, desc] of rows) {
    const dt = document.createElement("dt");
    dt.textContent = term;
    const dd = document.createElement("dd");
    dd.textContent = desc;
    statsList.appendChild(dt);
    statsList.appendChild(dd);
  }
}

function renderFavoriteDishes() {
  const favorites = getFavoriteDishes().slice(0, 15);
  favoriteDishList.innerHTML = "";
  favoriteDishEmpty.style.display = favorites.length === 0 ? "block" : "none";

  for (const s of favorites) {
    const li = document.createElement("li");
    const span = document.createElement("span");
    span.className = "wish-text";
    span.textContent = `${s.dish}（👍${s.good}${s.kid ? `・子ども${s.kid}` : ""}）`;
    li.appendChild(span);

    if (hasWish(s.dish)) {
      const note = document.createElement("span");
      note.className = "favorite-in-memo";
      note.textContent = "メモに入っています";
      li.appendChild(note);
    } else {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "secondary-btn small-btn";
      btn.textContent = "メモに入れる";
      btn.addEventListener("click", () => {
        addWish(s.dish);
        renderFavoriteDishes();
      });
      li.appendChild(btn);
    }
    favoriteDishList.appendChild(li);
  }
}

function renderPreferenceFields() {
  const fields = loadPreferenceFields();
  preferenceFieldsEl.innerHTML = "";
  for (const field of PREFERENCE_FIELDS) {
    const id = `preference-${field.key}`;
    const label = document.createElement("label");
    label.className = "field-label";
    label.htmlFor = id;
    label.textContent = field.label;

    const textarea = document.createElement("textarea");
    textarea.id = id;
    textarea.className = "ai-textarea";
    textarea.rows = 2;
    textarea.placeholder = field.placeholder;
    textarea.value = fields[field.key] || "";
    // blurだけだと入力直後にアプリを閉じた場合保存されないことがあるので、入力のたびに保存する
    textarea.addEventListener("input", () => {
      const current = loadPreferenceFields();
      current[field.key] = textarea.value;
      savePreferenceFields(current);
      renderPromptPreview();
    });

    preferenceFieldsEl.appendChild(label);
    preferenceFieldsEl.appendChild(textarea);
  }
}

function feedbackMarks(feedback) {
  if (!feedback) return "";
  const marks = [];
  if (feedback.rating === "good") marks.push("👍");
  if (feedback.rating === "bad") marks.push("👎");
  if (feedback.kidAte) marks.push("子どもが食べた");
  if (feedback.changed) marks.push("料理を変更");
  return marks.length ? `（${marks.join("・")}）` : "";
}

function buildPreferenceTrendPrompt() {
  const todayKey = toDateKey(new Date());
  const fromKey = shiftDateKey(todayKey, -TREND_DAYS);
  const menuMap = loadMenu();

  const dishLines = Object.keys(menuMap)
    .filter((dateKey) => dateKey >= fromKey && dateKey <= todayKey && menuMap[dateKey] && menuMap[dateKey].dish)
    .sort()
    .map((dateKey) => {
      const entry = menuMap[dateKey];
      if (entry.feedback && entry.feedback.skipped) return `・${dateKey} ${entry.dish}（作らなかった）`;
      return `・${dateKey} ${entry.dish}${feedbackMarks(entry.feedback)}`;
    });

  const notes = loadAllPeriodNotes();
  const costs = loadAllActualCosts();
  const periodKeys = [...new Set([...Object.keys(notes), ...Object.keys(costs)])]
    .filter((key) => key.split("_")[1] >= fromKey)
    .sort();
  const periodLines = periodKeys
    .map((key) => {
      const parts = [];
      if (notes[key]) parts.push(`感想: ${notes[key]}`);
      if (costs[key] != null) parts.push(`実際の金額: ¥${costs[key].toLocaleString()}`);
      return parts.length ? `・${key.replace("_", "〜")} ${parts.join(" / ")}` : "";
    })
    .filter(Boolean);

  const current = formatPreferenceForPrompt();
  const headings = PREFERENCE_FIELDS.map((f) => `【${f.label}】`).join("\n");

  return `以下は、わが家の直近8週間の晩ごはんの記録です。👍は好評、👎はいまいちだった料理です。
これをもとに、今後の献立作りに活かせる「好みと傾向」をまとめてください。

出力は、次の見出しごとに、短い箇条書きで書いてください。見出しの文字は変えないでください。書くことがない見出しは「特になし」と書いてください。説明や前置きは不要です。
${headings}

${current ? `【これまでの「好みと傾向」】\n${current}\n\n上記で今も正しいものは引き継ぎつつ、新しい記録を踏まえて更新してください。\n\n` : ""}【献立の記録】
${dishLines.length ? dishLines.join("\n") : "（記録なし）"}
${periodLines.length ? `\n【期間ごとの感想・金額】\n${periodLines.join("\n")}\n` : ""}`;
}

makeTrendPromptBtn.addEventListener("click", async () => {
  trendPromptOutput.value = buildPreferenceTrendPrompt();
  try {
    await navigator.clipboard.writeText(trendPromptOutput.value);
    trendPromptOutput.hidden = true;
    copyTrendStatus.textContent = "コピーしました。お使いのAIツールに貼り付けて送ってください。";
    copyTrendStatus.classList.remove("is-error");
  } catch {
    trendPromptOutput.hidden = false;
    trendPromptOutput.focus();
    trendPromptOutput.select();
    copyTrendStatus.textContent = "自動コピーできませんでした。下のテキストが選択されているので、そのままコピーしてください。";
    copyTrendStatus.classList.add("is-error");
  }
});

loadTrendBtn.addEventListener("click", () => {
  const text = removeMarkdownEscapes(trendResponseInput.value.trim());
  if (!text) {
    loadTrendStatus.textContent = "AIの返事を貼り付けてから押してください。";
    loadTrendStatus.classList.add("is-error");
    return;
  }
  if (hasAnyPreference() && !window.confirm("今の「好みと傾向」を、この結果で書き換えます。よろしいですか？")) {
    loadTrendStatus.textContent = "";
    return;
  }

  const parsed = parsePreferenceResponse(text);
  const fields = {};
  for (const field of PREFERENCE_FIELDS) {
    const value = (parsed[field.key] || "").trim();
    if (value && value !== "特になし") fields[field.key] = value;
  }
  savePreferenceFields(fields);
  localStorage.setItem(PREFERENCE_UPDATED_AT_KEY, toDateKey(new Date()));

  trendResponseInput.value = "";
  loadTrendStatus.textContent = "読み込みました。上の欄で自由に書き直せます。";
  loadTrendStatus.classList.remove("is-error");
  renderPreferenceFields();
  renderPreferenceBanner();
  renderPromptPreview();
});

// 評価がある程度たまったら、予定タブで「好みと傾向」の更新をすすめる
function renderPreferenceBanner() {
  const updatedAt = localStorage.getItem(PREFERENCE_UPDATED_AT_KEY);
  const todayKey = toDateKey(new Date());
  const stale = !updatedAt || daysBetween(updatedAt, todayKey) >= PREFERENCE_REMIND_DAYS;
  const rated = countRatedDays(updatedAt || undefined);
  const show = stale && rated >= PREFERENCE_REMIND_MIN_RATED;
  preferenceUpdateBanner.hidden = !show;
  if (show) {
    preferenceUpdateText.textContent = updatedAt
      ? `前回「好みと傾向」を更新してから、評価が${rated}日分たまりました。AIにまとめ直してもらうと、献立がもっと好みに近づきます。`
      : `評価が${rated}日分たまりました。AIに「好みと傾向」をまとめてもらうと、献立がもっと好みに近づきます。`;
  }
}

preferenceUpdateLink.addEventListener("click", () => {
  trendDetails.open = true;
});

function renderReview() {
  renderStats();
  renderFavoriteDishes();
  renderPreferenceFields();
  renderPreferenceBanner();
}

renderReview();

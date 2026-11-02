// 献立ごとの評価（👍👎・子どもが食べた・作らなかった・料理を変えた）の記録と集計。
// 評価は献立データ（menuApp.menu の各日）の feedback に入れる。AIの返事を読み込み直して
// その日の料理が変わると、評価も一緒に消える（別の料理の評価が残らないように）。
// feedback = { rating: "good" | "bad", kidAte: true, skipped: true, changed: true }

function setDishFeedback(dateKey, patch) {
  const menuMap = loadMenu();
  const entry = menuMap[dateKey];
  if (!entry) return;
  const feedback = { ...(entry.feedback || {}), ...patch };
  for (const key of Object.keys(feedback)) {
    if (feedback[key] === undefined || feedback[key] === false || feedback[key] === null) delete feedback[key];
  }
  if (Object.keys(feedback).length > 0) entry.feedback = feedback;
  else delete entry.feedback;
  saveMenu(menuMap);
}

function hasChild() {
  return loadFamilyMembers().some((m) => m.type === "child");
}

// 料理名ごとに評価をまとめる（同じ料理が何度か出ていれば合算）
function collectDishStats() {
  const stats = new Map();
  for (const [dateKey, entry] of Object.entries(loadMenu())) {
    if (!entry || !entry.dish) continue;
    const fb = entry.feedback || {};
    if (fb.skipped) continue;
    const s = stats.get(entry.dish) || { dish: entry.dish, good: 0, bad: 0, kid: 0, count: 0, lastDate: "" };
    s.count++;
    if (fb.rating === "good") s.good++;
    if (fb.rating === "bad") s.bad++;
    if (fb.kidAte) s.kid++;
    if (dateKey > s.lastDate) s.lastDate = dateKey;
    stats.set(entry.dish, s);
  }
  return [...stats.values()];
}

function byGoodThenRecent(a, b) {
  return b.good - a.good || (b.lastDate > a.lastDate ? 1 : b.lastDate < a.lastDate ? -1 : 0);
}

function getFavoriteDishes() {
  return collectDishStats().filter((s) => s.good > 0 && s.good > s.bad).sort(byGoodThenRecent);
}

function getDislikedDishes() {
  return collectDishStats()
    .filter((s) => s.bad > 0 && s.bad >= s.good)
    .sort((a, b) => b.bad - a.bad);
}

function getKidFavoriteDishes() {
  return collectDishStats()
    .filter((s) => s.kid > 0)
    .sort((a, b) => b.kid - a.kid);
}

function shiftDateKey(dateKey, days) {
  const d = parseDateKey(dateKey);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

// beforeDateKey の前の days 日間に出た料理（作らなかった日は除く、新しい順）
function getRecentDishes(beforeDateKey, days) {
  const fromKey = shiftDateKey(beforeDateKey, -days);
  const seen = new Set();
  return Object.entries(loadMenu())
    .filter(([dateKey, entry]) => dateKey >= fromKey && dateKey < beforeDateKey && entry && entry.dish)
    .filter(([, entry]) => !(entry.feedback && entry.feedback.skipped))
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([, entry]) => entry.dish)
    .filter((dish) => (seen.has(dish) ? false : seen.add(dish)));
}

// 直近 days 日間（今日まで）によく使った食材（調味料は除く）
function getFrequentIngredients(days, limit) {
  const todayKey = toDateKey(new Date());
  const fromKey = shiftDateKey(todayKey, -days);
  const counts = new Map();
  for (const [dateKey, entry] of Object.entries(loadMenu())) {
    if (dateKey < fromKey || dateKey > todayKey || !entry || !entry.dish) continue;
    if (entry.feedback && entry.feedback.skipped) continue;
    const names = new Set(
      (entry.ingredients || [])
        .map(normalizeIngredient)
        .filter((ing) => ing.name && ing.category !== "調味料")
        .map((ing) => ing.name)
    );
    for (const name of names) counts.set(name, (counts.get(name) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([name, count]) => ({ name, count }));
}

// その月（"YYYY-MM"）の 👍 / 👎 の数
function getMonthlyRating(monthKey) {
  let good = 0;
  let bad = 0;
  for (const [dateKey, entry] of Object.entries(loadMenu())) {
    if (!dateKey.startsWith(monthKey) || !entry || !entry.feedback) continue;
    if (entry.feedback.rating === "good") good++;
    if (entry.feedback.rating === "bad") bad++;
  }
  return { good, bad };
}

// 評価（👍👎・子どもが食べた）が付いた日の数。fromDateKey があればその日以降だけ数える
function countRatedDays(fromDateKey) {
  return Object.entries(loadMenu()).filter(([dateKey, entry]) => {
    if (fromDateKey && dateKey < fromDateKey) return false;
    const fb = entry && entry.feedback;
    return Boolean(fb && (fb.rating || fb.kidAte));
  }).length;
}

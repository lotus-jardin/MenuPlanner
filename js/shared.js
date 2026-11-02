// 複数のページで共通して使うデータ読み込み関数をまとめたファイル。
// 「家族構成」と「調味料マスタ」は、トップ画面・苦手な食材ページ・各自のページの
// 3箇所以上で必要になるので、ここに1つだけ定義しておく（前はページごとに
// コピーしていて、片方だけ直し忘れる事故が起きやすかったため）。
// index.html / family.html / dislikes.html / pantry.html で、各ページ自身の
// スクリプトより先に読み込む。

// アプリのバージョン。「？」パネルに表示して、スマホに新しい版が届いているか確かめるのに使う。
// 更新するときは sw.js の CACHE_NAME の番号も同じにそろえる。
const APP_VERSION = "v26";

const FAMILY_STORAGE_KEY = "menuApp.familyMembers";
const DEFAULT_FAMILY_MEMBERS = [
  { id: 0, name: "ママ", type: "adult", phase: "" },
  { id: 1, name: "パパ", type: "adult", phase: "" },
  { id: 2, name: "子ども", type: "child", phase: "〜3歳（大人の1/3〜1/2程度）" },
];

function loadFamilyMembers() {
  const raw = localStorage.getItem(FAMILY_STORAGE_KEY);
  if (!raw) {
    localStorage.setItem(FAMILY_STORAGE_KEY, JSON.stringify(DEFAULT_FAMILY_MEMBERS));
    return DEFAULT_FAMILY_MEMBERS;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

const PANTRY_STORAGE_KEY = "menuApp.pantryItems";
const DEFAULT_PANTRY_ITEMS = [
  "醤油", "みそ", "塩", "砂糖", "酢", "みりん", "料理酒",
  "サラダ油", "ごま油", "こしょう", "だしの素", "片栗粉", "マヨネーズ", "ケチャップ",
];

function loadPantry() {
  const raw = localStorage.getItem(PANTRY_STORAGE_KEY);
  if (!raw) {
    // 初回だけ、よくある調味料をデフォルトで入れておく
    const defaults = DEFAULT_PANTRY_ITEMS.map((name, i) => ({ id: i, name, hasIt: true }));
    localStorage.setItem(PANTRY_STORAGE_KEY, JSON.stringify(defaults));
    return defaults;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

// 「アレルギー」「苦手な食材」「献立」「副菜」「保存した献立」のデータ読み書きも、
// index.html・dislikes.html・menus.html など複数ページで必要になるので、ここにまとめる。

const ALLERGY_STORAGE_KEY = "menuApp.allergies";

function loadAllergies() {
  const raw = localStorage.getItem(ALLERGY_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveAllergies(items) {
  localStorage.setItem(ALLERGY_STORAGE_KEY, JSON.stringify(items));
}

const DISLIKE_STORAGE_KEY = "menuApp.dislikedIngredients";
const DEFAULT_DISLIKED_INGREDIENTS = [];

function loadDislikedIngredients() {
  const raw = localStorage.getItem(DISLIKE_STORAGE_KEY);
  if (!raw) {
    const defaults = DEFAULT_DISLIKED_INGREDIENTS.map((text, i) => ({ id: i, text, until: "", memberIds: [] }));
    saveDislikedIngredients(defaults);
    return defaults;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveDislikedIngredients(items) {
  localStorage.setItem(DISLIKE_STORAGE_KEY, JSON.stringify(items));
}

const MENU_STORAGE_KEY = "menuApp.menu";

function loadMenu() {
  const raw = localStorage.getItem(MENU_STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveMenu(menuMap) {
  localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menuMap));
}

const SIDE_DISH_KEY = "menuApp.sideDishes";

function loadAllSideDishes() {
  const raw = localStorage.getItem(SIDE_DISH_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveSideDishesForPeriod(periodKey, dishes) {
  const all = loadAllSideDishes();
  all[periodKey] = dishes;
  localStorage.setItem(SIDE_DISH_KEY, JSON.stringify(all));
}

const SAVED_MENUS_KEY = "menuApp.savedMenus";

function loadSavedMenus() {
  const raw = localStorage.getItem(SAVED_MENUS_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveSavedMenus(list) {
  localStorage.setItem(SAVED_MENUS_KEY, JSON.stringify(list));
}

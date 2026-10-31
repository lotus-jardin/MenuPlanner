// 食材の名前・量・値段を正規化するための純粋な関数群。
// shopping-list.js（買う食材リストの集計）と ai-load.js（AIの返事・手入力の読み込み）の
// 両方から使われる。

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

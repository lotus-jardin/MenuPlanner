// 「好みと傾向」を項目ごとに持つ。毎回のAIへの質問文に入る。
// 以前は1つの文章（menuApp.preferenceProfile）で持っていたので、まだ項目ごとの
// 保存が無いときは、その文章を「その他」に入れて引き継ぐ。
const PREFERENCE_FIELDS = [
  { key: "taste", label: "好きな味付け", placeholder: "例：甘辛い味が好評。酸っぱいものは控えめに。" },
  { key: "ingredients", label: "よく使う・好きな食材", placeholder: "例：鶏もも肉、鮭、きのこ類" },
  { key: "avoid", label: "避けたい傾向", placeholder: "例：揚げ物は週1回まで。辛いものは避ける。" },
  { key: "kids", label: "子どもの反応", placeholder: "例：豆腐や卵の料理はよく食べる。葉物は細かく刻むと食べる。" },
  { key: "other", label: "その他", placeholder: "例：平日は30分以内で作れるものがうれしい。" },
];
const PREFERENCE_LEGACY_KEY = "menuApp.preferenceProfile";
const PREFERENCE_V2_KEY = "menuApp.preferenceProfileV2";
const PREFERENCE_UPDATED_AT_KEY = "menuApp.preferenceUpdatedAt";

function loadPreferenceFields() {
  const raw = localStorage.getItem(PREFERENCE_V2_KEY);
  if (raw) {
    try {
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }
  const legacy = localStorage.getItem(PREFERENCE_LEGACY_KEY) || "";
  return legacy ? { other: legacy } : {};
}

function savePreferenceFields(fields) {
  localStorage.setItem(PREFERENCE_V2_KEY, JSON.stringify(fields));
}

function hasAnyPreference() {
  const fields = loadPreferenceFields();
  return PREFERENCE_FIELDS.some((f) => (fields[f.key] || "").trim());
}

// 質問文に入れる形（中身がある項目だけ）
function formatPreferenceForPrompt() {
  const fields = loadPreferenceFields();
  return PREFERENCE_FIELDS.filter((f) => (fields[f.key] || "").trim())
    .map((f) => `■${f.label}\n${fields[f.key].trim()}`)
    .join("\n");
}

// AIの返事を「【好きな味付け】…」の見出しごとに分ける。見出しが1つも無ければ全部「その他」に入れる
function parsePreferenceResponse(text) {
  const result = {};
  const labelToKey = new Map(PREFERENCE_FIELDS.map((f) => [f.label, f.key]));
  const pattern = /[【\[]\s*([^】\]\n]+?)\s*[】\]]/g;
  const headings = [...text.matchAll(pattern)].filter((m) => labelToKey.has(m[1].trim()));
  if (headings.length === 0) return { other: text.trim() };
  headings.forEach((m, i) => {
    const start = m.index + m[0].length;
    const end = i + 1 < headings.length ? headings[i + 1].index : text.length;
    const body = text.slice(start, end).replace(/^[\s:：]+|\s+$/g, "");
    if (body) result[labelToKey.get(m[1].trim())] = body;
  });
  return result;
}

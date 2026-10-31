// 「苦手な食材」のデータ読み書き（DISLIKE_STORAGE_KEY・loadDislikedIngredients）は
// js/shared.js にまとめてある（画面はdislikes.htmlの方にある）。
// ここに登録したものは、毎回のAIへの質問文で「使わないでください」として伝える。
// 「いつまで」が設定されていて、その日を過ぎていたら対象外にする（体調や時期によって一時的に避けたいもの、等）。
function loadActiveDislikedIngredients() {
  const todayKeyValue = toDateKey(new Date());
  return loadDislikedIngredients().filter((item) => !item.until || item.until >= todayKeyValue);
}

// 「アレルギー」のデータ読み書き（ALLERGY_STORAGE_KEY・loadAllergies）は js/shared.js に
// まとめてある。苦手な食材とは別枠で管理し、AIへの質問文では「絶対に使わないでください」
// という強い言い方で伝える。安全に関わるため、誰が対象かも書いて伝える。

// 「AIに献立を考えてもらう」質問文の作成・コピー機能
// 裏方サーバーは使わず、質問文をコピーしてお好きなAIツールに貼り付けてもらい、
// 返ってきた答えを貼り付けてもらう方式（無料で使える）。
const makePromptBtn = document.getElementById("make-prompt-btn");
const promptArea = document.getElementById("prompt-area");
const promptOutput = document.getElementById("prompt-output");
const copyPromptBtn = document.getElementById("copy-prompt-btn");
const copyStatus = document.getElementById("copy-status");

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
説明や前置きは一切不要です。次の見本と同じ形のJSONだけを、見本と同じようにコードブロックに入れて出力してください。
\`\`\`json
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
}
\`\`\`

【大事】返事は必ず \`\`\`json の行で始めて、\`\`\` の行で終えてください。コードブロックの外には何も書かないでください。`;
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

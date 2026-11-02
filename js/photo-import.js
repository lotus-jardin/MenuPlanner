// 写真から食材を登録する機能（レシート・ネットスーパーの注文履歴 / 冷蔵庫の中）。
// アプリから直接AIは呼ばず、いつもと同じ「質問文をコピー → AIツールに写真と一緒に送る →
// 返事を貼り付ける」流れ。読み取りは間違えることがあるので、登録する前に一覧で確認・修正してもらう。
//   receipt：買う食材リストの同じ食材にチェックを入れる。リストに無い食材は「今ある食材」に追加。
//   fridge ：「今ある食材」に追加（同じ名前がすでにあれば量を書き換える）。
// <details class="photo-import" data-photo-mode="receipt|fridge"> の中身はここで作る。

// intro は固定の文言だけなので innerHTML で入れている（利用者の入力は入らない）
const PHOTO_IMPORT_TEXT = {
  receipt: {
    intro: `<p class="section-note">レシートや、ネットスーパーの注文履歴・領収書の画面写真から、買った物を読み取ります。</p>
      <ul class="photo-flow">
        <li><span class="photo-badge is-check">✓ チェック</span>買い物リストにある物 → このリストにチェックが付きます</li>
        <li><span class="photo-badge is-add">＋ 追加</span>リストに無い物 → 「予定」タブの「今ある食材」に入ります</li>
      </ul>
      <p class="section-note">登録する前に、どれがどこに入るかを一覧で確かめられます。名前や住所が写っている部分は切り取ってから送っても大丈夫です。</p>`,
    sendStep: "② AIツール（ChatGPTなど）に写真を付けて、質問文を貼り付けて送る",
  },
  fridge: {
    intro: `<p class="section-note">冷蔵庫・冷凍庫・野菜室の写真から、今ある食材を読み取ります。</p>
      <ul class="photo-flow">
        <li><span class="photo-badge is-add">＋ 追加</span>読み取った物 → この下の「今ある食材」の一覧に入ります</li>
        <li><span class="photo-badge is-update">↻ 更新</span>すでに一覧にある物 → 量が書き換わります</li>
      </ul>
      <p class="section-note">奥の物や容器の中身は見落としやすいので、あとで手で足してください。</p>`,
    sendStep: "② AIツール（ChatGPTなど）に写真を付けて（何枚でも可）、質問文を貼り付けて送る",
  },
};

// 今の期間の買う食材リストに出ている名前（自動集計分＋自分で追加した物）
function getCurrentShoppingNames() {
  const { grouped, extraItems } = getShoppingGroups();
  return [...grouped.keys(), ...extraItems.map((item) => item.name)];
}

function buildPhotoImportPrompt(mode) {
  const categories = "肉・魚 / 野菜 / その他 / 調味料";
  if (mode === "receipt") {
    const names = getCurrentShoppingNames();
    const listBlock = names.length
      ? `\n【今回の買う食材リスト】\n${names.join("、")}\n上のリストと同じ食材なら、name はリストと同じ書き方にしてください（例：リストが「玉ねぎ」なら「たまねぎ」ではなく「玉ねぎ」）。\n`
      : "";
    return `添付した画像は、食材を買ったときのレシート（またはネットスーパーの注文履歴・領収書）です。買った物を読み取って、下の形のJSONだけを返してください。説明や前置きは不要です。
${listBlock}
【書き方のルール】
- name：料理で使う一般的な名前に直してください（例：「[鮮度+] 北海道産 たまねぎ 1.2kg(5-6個) 1袋」→「玉ねぎ」、「国産若鶏モモ」→「鶏もも肉」）。
- amount：買った量の合計。数量が2以上なら掛け算してください（例：180g×2 → "360g"、10個入り1パック → "10個"）。わからなければ ""。
- category：${categories} のどれか。
- price：値引き後の金額（数字だけ。税抜きでもよい）。わからなければ 0。
- forCooking：お菓子・アイス・飲み物・お酒・日用品など、ごはんの材料にならない物は false、それ以外は true。
- total：お支払い合計（税込）の金額。読み取れなければ null。
- 写真が何枚かあるときは、全部まとめて1つのJSONにしてください。

\`\`\`json
{
  "items": [
    { "name": "玉ねぎ", "amount": "1.2kg", "category": "野菜", "price": 398, "forCooking": true },
    { "name": "アイスクリーム", "amount": "2個", "category": "その他", "price": 1796, "forCooking": false }
  ],
  "total": 8984
}
\`\`\`

【大事】返事は、上のような \`\`\`json で始まるコードブロック1つだけにしてください。`;
  }

  const stockNames = loadStock().map((item) => item.name);
  const stockBlock = stockNames.length
    ? `\n【すでに登録してある食材】\n${stockNames.join("、")}\n同じ食材なら、name は上と同じ書き方にしてください。\n`
    : "";
  return `添付した画像は、うちの冷蔵庫・冷凍庫・野菜室などの中の写真です。写っている食材を読み取って、下の形のJSONだけを返してください。説明や前置きは不要です。
${stockBlock}
【書き方のルール】
- ごはんの材料になる物だけを書いてください。調味料（しょうゆ・マヨネーズ・ドレッシングなど）・飲み物・お菓子は書かないでください。
- name：料理で使う一般的な名前（例：「鶏もも肉」「にんじん」「木綿豆腐」）。
- amount：見てわかる範囲の量（例："2本"、"1/2個"、"300g"、"1パック"）。わからなければ ""。
- category：${categories} のどれか。
- unsure：ラベルが読めない・何かはっきりしない物は true、それ以外は false。
- 写真が何枚かあるときは、全部まとめて1つのJSONにしてください。同じ食材は1つにまとめてください。

\`\`\`json
{
  "items": [
    { "name": "にんじん", "amount": "2本", "category": "野菜", "unsure": false },
    { "name": "鶏もも肉", "amount": "300g", "category": "肉・魚", "unsure": false }
  ]
}
\`\`\`

【大事】返事は、上のような \`\`\`json で始まるコードブロック1つだけにしてください。`;
}

// 名前が同じ（表記ゆれをまとめた上で）か、短すぎない名前どうしで片方がもう片方を含む場合に同じ食材とみなす
function findSameIngredientName(name, candidates) {
  const target = canonicalizeIngredientName(name);
  const exact = candidates.find((c) => canonicalizeIngredientName(c) === target);
  if (exact) return exact;
  if (target.length < 2) return null;
  return (
    candidates.find((c) => {
      const cand = canonicalizeIngredientName(c);
      return cand.length >= 2 && (cand.includes(target) || target.includes(cand));
    }) || null
  );
}

function parsePhotoImportResponse(text) {
  const parsed = extractJson(text);
  const rawItems = parsed && (Array.isArray(parsed) ? parsed : parsed.items);
  if (!Array.isArray(rawItems)) return null;
  const items = rawItems
    .filter((raw) => raw && (typeof raw === "string" || raw.name))
    .map((raw) => {
      const norm = normalizeIngredient(raw);
      return {
        ...norm,
        forCooking: typeof raw === "object" ? raw.forCooking !== false : true,
        unsure: typeof raw === "object" ? raw.unsure === true : false,
      };
    })
    .filter((item) => item.name);
  const total = parsed && !Array.isArray(parsed) ? parsePrice(parsed.total) : 0;
  return { items, total };
}

function setupPhotoImport(root) {
  const mode = root.dataset.photoMode;
  const text = PHOTO_IMPORT_TEXT[mode];
  const body = root.querySelector(".photo-import-body");

  body.innerHTML = `
    <div class="photo-intro"></div>
    <div class="ai-step">
      <p class="ai-step-title">① 質問文を作ってコピーする</p>
      <button type="button" class="primary-btn photo-make-btn">質問文を作ってコピー</button>
      <p class="copy-status photo-copy-status" aria-live="polite"></p>
      <textarea class="ai-textarea photo-prompt-output" readonly rows="5" hidden></textarea>
    </div>
    <div class="ai-step">
      <p class="ai-step-title photo-send-step"></p>
    </div>
    <div class="ai-step">
      <p class="ai-step-title">③ AIツールの返事をここに貼り付ける</p>
      <textarea class="ai-textarea photo-response-input" rows="4" placeholder="ここに貼り付け"></textarea>
      <button type="button" class="photo-load-btn">読み込む</button>
      <p class="load-status photo-load-status" aria-live="polite"></p>
    </div>
    <div class="photo-review" hidden>
      <p class="ai-step-title">④ どこに入るか確かめて登録する</p>
      <p class="section-note">読み間違いは名前や量を直せます。いらない物はチェックを外してください。</p>
      <ul class="photo-item-list"></ul>
      <label class="photo-total-row" hidden>
        <input type="checkbox" class="photo-total-checkbox">
        <span class="photo-total-label"></span>
      </label>
      <p class="photo-summary" aria-live="polite"></p>
      <button type="button" class="primary-btn photo-apply-btn">登録する</button>
      <button type="button" class="secondary-btn photo-cancel-btn">やめる</button>
    </div>
    <p class="copy-status photo-apply-status" aria-live="polite"></p>
    <div class="photo-after-links"></div>`;
  body.querySelector(".photo-intro").innerHTML = text.intro;
  body.querySelector(".photo-send-step").textContent = text.sendStep;

  const makeBtn = body.querySelector(".photo-make-btn");
  const copyStatusEl = body.querySelector(".photo-copy-status");
  const promptOutput = body.querySelector(".photo-prompt-output");
  const responseInput = body.querySelector(".photo-response-input");
  const loadBtn = body.querySelector(".photo-load-btn");
  const loadStatusEl = body.querySelector(".photo-load-status");
  const review = body.querySelector(".photo-review");
  const itemList = body.querySelector(".photo-item-list");
  const totalRow = body.querySelector(".photo-total-row");
  const totalCheckbox = body.querySelector(".photo-total-checkbox");
  const totalLabel = body.querySelector(".photo-total-label");
  const applyBtn = body.querySelector(".photo-apply-btn");
  const cancelBtn = body.querySelector(".photo-cancel-btn");
  const applyStatus = body.querySelector(".photo-apply-status");
  const summaryEl = body.querySelector(".photo-summary");
  const afterLinks = body.querySelector(".photo-after-links");

  let pendingTotal = 0;

  makeBtn.addEventListener("click", async () => {
    promptOutput.value = buildPhotoImportPrompt(mode);
    applyStatus.textContent = "";
    afterLinks.innerHTML = "";
    try {
      await navigator.clipboard.writeText(promptOutput.value);
      promptOutput.hidden = true;
      copyStatusEl.textContent = "コピーしました。AIツールに写真を付けて、貼り付けて送ってください。";
      copyStatusEl.classList.remove("is-error");
    } catch {
      promptOutput.hidden = false;
      promptOutput.focus();
      promptOutput.select();
      copyStatusEl.textContent = "自動コピーできませんでした。下のテキストが選択されているので、そのままコピーしてください。";
      copyStatusEl.classList.add("is-error");
    }
  });

  // 読み取った1品が、登録するとどこに入るか
  function getTarget(name) {
    if (mode === "receipt") {
      const match = findSameIngredientName(name, getCurrentShoppingNames());
      if (match) return { kind: "check", badge: "✓ チェック", text: `買い物リストの「${match}」にチェック` };
    }
    const existing = findSameIngredientName(name, loadStock().map((item) => item.name));
    if (existing) {
      return {
        kind: "update",
        badge: "↻ 更新",
        text: mode === "fridge" ? `今ある食材の「${existing}」の量を書き換え` : `今ある食材の「${existing}」に量を足す`,
      };
    }
    return { kind: "add", badge: "＋ 追加", text: "今ある食材に追加" };
  }

  // 「登録する」を押すと何が起きるかを、ボタンのすぐ上にまとめて出す
  function updateSummary() {
    const counts = { check: 0, add: 0, update: 0 };
    for (const li of itemList.querySelectorAll(".photo-item")) {
      if (li.querySelector(".photo-item-check").checked) counts[li.dataset.kind]++;
    }
    const parts = [];
    if (counts.check) parts.push(`買い物リストの${counts.check}品にチェック`);
    if (counts.add) parts.push(`今ある食材に${counts.add}品を追加`);
    if (counts.update) parts.push(`今ある食材の${counts.update}品を更新`);
    summaryEl.textContent = parts.length
      ? `「登録する」を押すと：${parts.join("、")}します。`
      : "登録する物が選ばれていません。";
  }

  function appendItemRow(item) {
    const li = document.createElement("li");
    li.className = "photo-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "photo-item-check";
    checkbox.checked = item.forCooking && !item.unsure;
    checkbox.setAttribute("aria-label", `${item.name}を登録する`);

    const fields = document.createElement("div");
    fields.className = "photo-item-fields";

    const nameInput = document.createElement("input");
    nameInput.type = "text";
    nameInput.className = "photo-item-name";
    nameInput.value = item.name;
    nameInput.setAttribute("aria-label", "品名");

    const amountInput = document.createElement("input");
    amountInput.type = "text";
    amountInput.className = "photo-item-amount";
    amountInput.value = item.amount;
    amountInput.placeholder = "量";
    amountInput.setAttribute("aria-label", "量");

    const target = document.createElement("span");
    target.className = "photo-item-target";
    const notes = [];
    if (!item.forCooking) notes.push("材料以外");
    if (item.unsure) notes.push("自信なし");
    const updateTarget = () => {
      const t = getTarget(nameInput.value.trim());
      li.dataset.kind = t.kind;
      target.innerHTML = "";
      const badge = document.createElement("span");
      badge.className = `photo-badge ${checkbox.checked ? `is-${t.kind}` : "is-skip"}`;
      badge.textContent = checkbox.checked ? t.badge : "登録しない";
      const desc = document.createElement("span");
      desc.textContent = `${notes.length ? `（${notes.join("・")}）` : ""}${checkbox.checked ? t.text : ""}`;
      target.append(badge, desc);
      li.classList.toggle("is-unchecked", !checkbox.checked);
      updateSummary();
    };
    nameInput.addEventListener("input", updateTarget);
    checkbox.addEventListener("change", updateTarget);

    const row = document.createElement("div");
    row.className = "photo-item-inputs";
    row.append(nameInput, amountInput);
    fields.append(row, target);
    li.dataset.category = item.category;
    li.append(checkbox, fields);
    itemList.appendChild(li);
    updateTarget();
  }

  loadBtn.addEventListener("click", () => {
    applyStatus.textContent = "";
    const result = parsePhotoImportResponse(responseInput.value);
    if (!result) {
      loadStatusEl.textContent =
        "読み取れませんでした。AIに「さっきの答えを、```json のコードブロックに入れて出し直して」と送って、出てきたものをもう一度ここに貼り付けてください。";
      loadStatusEl.classList.add("is-error");
      return;
    }
    if (result.items.length === 0) {
      loadStatusEl.textContent = "食材が1つも見つかりませんでした。写真が読み取れているか、AIの返事を確かめてください。";
      loadStatusEl.classList.add("is-error");
      return;
    }
    itemList.innerHTML = "";
    for (const item of result.items) appendItemRow(item);

    pendingTotal = mode === "receipt" ? result.total : 0;
    totalRow.hidden = !pendingTotal;
    totalCheckbox.checked = false;
    totalLabel.textContent = `この期間の「実際にかかった金額」に ¥${pendingTotal.toLocaleString()} を足す（お菓子なども含んだ合計です）`;

    loadStatusEl.textContent = `${result.items.length}品を読み取りました。下で確かめてから「登録する」を押してください。`;
    loadStatusEl.classList.remove("is-error");
    afterLinks.innerHTML = "";
    review.hidden = false;
    updateSummary();
  });

  function closeReview() {
    review.hidden = true;
    itemList.innerHTML = "";
    responseInput.value = "";
    loadStatusEl.textContent = "";
  }

  cancelBtn.addEventListener("click", closeReview);

  applyBtn.addEventListener("click", () => {
    const selected = [...itemList.querySelectorAll(".photo-item")]
      .filter((li) => li.querySelector(".photo-item-check").checked)
      .map((li) => ({
        name: canonicalizeIngredientName(li.querySelector(".photo-item-name").value),
        amount: toHalfWidthDigits(li.querySelector(".photo-item-amount").value.trim()),
      }))
      .filter((item) => item.name);

    const periodKey = getPeriodKey();
    const shoppingNames = getCurrentShoppingNames();
    const checkedMap = loadShoppingChecked(periodKey);
    const stock = loadStock();
    let checkedCount = 0;
    let addedCount = 0;
    let updatedCount = 0;

    selected.forEach((item, index) => {
      if (mode === "receipt") {
        const match = findSameIngredientName(item.name, shoppingNames);
        if (match) {
          checkedMap[match] = true;
          checkedCount++;
          return;
        }
      }
      const existing = stock.find(
        (s) => s.name === findSameIngredientName(item.name, stock.map((x) => x.name))
      );
      if (existing) {
        if (mode === "fridge") {
          existing.amount = item.amount;
        } else if (existing.amount && item.amount) {
          // 買い足した分は、単位が同じなら足し算、違えば並べて書く
          existing.amount = sumAmounts([existing.amount, item.amount]) || `${existing.amount}＋${item.amount}`;
        } else {
          existing.amount = "";
        }
        updatedCount++;
      } else {
        stock.unshift({ id: Date.now() + index, name: item.name, amount: item.amount, source: mode });
        addedCount++;
      }
    });

    saveShoppingChecked(periodKey, checkedMap);
    saveStock(stock);

    let costText = "";
    if (pendingTotal && totalCheckbox.checked) {
      const costs = loadAllActualCosts();
      costs[periodKey] = (costs[periodKey] || 0) + pendingTotal;
      localStorage.setItem(PERIOD_ACTUAL_COST_KEY, JSON.stringify(costs));
      costText = `、実際にかかった金額に ¥${pendingTotal.toLocaleString()} を足しました`;
      renderPeriodNotes();
    }

    renderStock();
    renderShoppingList();
    renderActualCostDiff();

    const parts = [];
    if (checkedCount) parts.push(`買い物リストの${checkedCount}品にチェック`);
    if (addedCount) parts.push(`今ある食材に${addedCount}品を追加`);
    if (updatedCount) parts.push(`今ある食材の${updatedCount}品を更新`);
    closeReview();
    applyStatus.textContent = parts.length
      ? `${parts.join("、")}しました${costText}。`
      : `登録する物が選ばれていませんでした${costText}。`;
    applyStatus.classList.remove("is-error");

    // 登録した先を見に行けるボタン（レシートの「今ある食材」は別のタブにあるので特に必要）
    afterLinks.innerHTML = "";
    if (checkedCount) afterLinks.appendChild(createJumpLink("買い物リストを見る ↓", "shopping", "shopping-list"));
    if (addedCount || updatedCount) {
      afterLinks.appendChild(
        mode === "receipt"
          ? createJumpLink("「予定」タブの今ある食材を見る →", "plan", "stock-section")
          : createJumpLink("今ある食材の一覧を見る ↓", "plan", "stock-list")
      );
    }
  });
}

// 別のタブ（または同じタブの下の方）の場所へ移動するボタン
function createJumpLink(label, tabName, elementId) {
  const link = document.createElement("a");
  link.href = `#${tabName}`;
  link.className = "secondary-btn small-btn photo-jump-link";
  link.textContent = label;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (location.hash !== `#${tabName}`) location.hash = tabName;
    // タブを切り替えると一番上に戻るので、そのあとで目的の場所まで動かす
    setTimeout(() => document.getElementById(elementId).scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  });
  return link;
}

for (const root of document.querySelectorAll(".photo-import[data-photo-mode]")) {
  setupPhotoImport(root);
}

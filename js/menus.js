// 「献立リスト」ページの画面表示
// トップ画面で保存した献立（期間のブックマーク）を一覧表示し、
// タップするとその期間を表示する状態にしてトップ画面に戻る。
// SAVED_MENUS_KEY・SIDE_DISH_KEY・loadSavedMenus・saveSavedMenus・loadAllSideDishes・
// MENU_STORAGE_KEY・loadMenu は js/shared.js にまとめてあり、menus.htmlでこのファイルより先に読み込んでいる。
const PERIOD_STORAGE_KEY = "menuApp.periodStart";
const PERIOD_END_STORAGE_KEY = "menuApp.periodEnd";

const savedMenuList = document.getElementById("saved-menu-list");
const savedMenuEmpty = document.getElementById("saved-menu-empty");

function renderSavedMenus() {
  const list = loadSavedMenus();
  savedMenuList.innerHTML = "";
  savedMenuEmpty.style.display = list.length === 0 ? "block" : "none";

  for (const item of list) {
    const li = document.createElement("li");

    const openBtn = document.createElement("button");
    openBtn.type = "button";
    openBtn.className = "saved-menu-btn";

    const labelSpan = document.createElement("span");
    labelSpan.className = "saved-menu-label";
    labelSpan.textContent = item.label;

    const rangeSpan = document.createElement("span");
    rangeSpan.className = "saved-menu-range";
    rangeSpan.textContent = `${item.periodStart} 〜 ${item.periodEnd}`;

    openBtn.appendChild(labelSpan);
    openBtn.appendChild(rangeSpan);
    openBtn.addEventListener("click", () => {
      // 保存した時点の献立・副菜の中身があれば復元する。そうしないと、同じ日付で
      // AIの献立を読み込み直していた場合、保存したはずの内容ではなく今の内容が開いてしまう。
      if (item.menuSnapshot && Object.keys(item.menuSnapshot).length > 0) {
        const menuMap = loadMenu();
        for (const [dateKey, entry] of Object.entries(item.menuSnapshot)) {
          menuMap[dateKey] = entry;
        }
        localStorage.setItem(MENU_STORAGE_KEY, JSON.stringify(menuMap));

        const periodKey = `${item.periodStart}_${item.periodEnd}`;
        const allSideDishes = loadAllSideDishes();
        allSideDishes[periodKey] = item.sideDishesSnapshot || [];
        localStorage.setItem(SIDE_DISH_KEY, JSON.stringify(allSideDishes));
      }
      localStorage.setItem(PERIOD_STORAGE_KEY, item.periodStart);
      localStorage.setItem(PERIOD_END_STORAGE_KEY, item.periodEnd);
      location.href = "index.html";
    });
    li.appendChild(openBtn);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "削除");
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm(`「${item.label}」を削除しますか？`)) return;
      const current = loadSavedMenus().filter((i) => i.id !== item.id);
      saveSavedMenus(current);
      renderSavedMenus();
    });
    li.appendChild(deleteBtn);

    savedMenuList.appendChild(li);
  }
}

renderSavedMenus();

// 「好みと傾向を分析する」機能
// 保存した献立＋その期間の結果・メモをもとに質問文を作り、AIの返事を
// 「好みと傾向」欄に読み込む。この欄は、今後のメイン画面での献立生成にも使われる。
const PERIOD_NOTES_KEY = "menuApp.periodNotes";
const PREFERENCE_PROFILE_KEY = "menuApp.preferenceProfile";

const makeTrendPromptBtn = document.getElementById("make-trend-prompt-btn");
const trendPromptArea = document.getElementById("trend-prompt-area");
const trendPromptOutput = document.getElementById("trend-prompt-output");
const copyTrendPromptBtn = document.getElementById("copy-trend-prompt-btn");
const copyTrendStatus = document.getElementById("copy-trend-status");
const trendResponseInput = document.getElementById("trend-response-input");
const loadTrendBtn = document.getElementById("load-trend-btn");
const loadTrendStatus = document.getElementById("load-trend-status");
const preferenceProfileInput = document.getElementById("preference-profile-input");

function loadAllPeriodNotes() {
  const raw = localStorage.getItem(PERIOD_NOTES_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function loadPreferenceProfile() {
  return localStorage.getItem(PREFERENCE_PROFILE_KEY) || "";
}

function savePreferenceProfile(text) {
  localStorage.setItem(PREFERENCE_PROFILE_KEY, text);
}

function datesBetween(startKey, endKey) {
  const [sy, sm, sd] = startKey.split("-").map(Number);
  const [ey, em, ed] = endKey.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  const keys = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    keys.push(`${y}-${m}-${day}`);
  }
  return keys;
}

function buildTrendPrompt() {
  const saved = loadSavedMenus();
  if (saved.length === 0) {
    return "まだ保存した献立がありません。トップ画面で気に入った期間を「保存」してから、もう一度お試しください。";
  }

  const menuMap = loadMenu();
  const notesMap = loadAllPeriodNotes();

  const blocks = saved.map((item) => {
    const dishLines = datesBetween(item.periodStart, item.periodEnd)
      .map((dateKey) => menuMap[dateKey])
      .filter((entry) => entry && entry.dish)
      .map((entry) => `・${entry.dish}`);

    const periodKey = `${item.periodStart}_${item.periodEnd}`;
    const note = notesMap[periodKey];

    return [
      `【${item.label}（${item.periodStart}〜${item.periodEnd}）】`,
      dishLines.length > 0 ? dishLines.join("\n") : "（献立の記録なし）",
      note ? `感想・メモ: ${note}` : "",
    ]
      .filter(Boolean)
      .join("\n");
  });

  const currentProfile = loadPreferenceProfile();
  const currentProfileBlock = currentProfile
    ? `【これまでの「好みと傾向」（手で書き直した内容を含む）】\n${currentProfile}\n\n上記はこれまでの分析結果です。これまでの内容で今も正しいものは引き継ぎつつ、新しい記録を踏まえて更新してください。\n\n`
    : "";

  return `以下は、保存したお気に入りの献立と、その感想の記録です。これらから、味付けの傾向・よく使う食材・好評だった料理の共通点などを分析し、今後の献立作りに活かせるポイントを箇条書きで5〜8個程度にまとめてください。
説明や前置きは不要です。箇条書きの本文だけを出力してください。

${currentProfileBlock}${blocks.join("\n\n")}`;
}

makeTrendPromptBtn.addEventListener("click", () => {
  trendPromptOutput.value = buildTrendPrompt();
  trendPromptArea.hidden = false;
  copyTrendStatus.textContent = "";
});

copyTrendPromptBtn.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(trendPromptOutput.value);
    copyTrendStatus.textContent = "コピーしました。お使いのAIツールに貼り付けてください。";
    copyTrendStatus.classList.remove("is-error");
  } catch {
    trendPromptOutput.focus();
    trendPromptOutput.select();
    copyTrendStatus.textContent = "自動コピーできませんでした。テキストが選択されているので、そのままコピーしてください。";
    copyTrendStatus.classList.add("is-error");
  }
});

loadTrendBtn.addEventListener("click", () => {
  const text = trendResponseInput.value.trim();
  if (!text) {
    loadTrendStatus.textContent = "AIの返事を貼り付けてから押してください。";
    loadTrendStatus.classList.add("is-error");
    return;
  }

  if (loadPreferenceProfile()) {
    const ok = window.confirm("今の「好みと傾向」の内容を、この結果で上書きします。よろしいですか？");
    if (!ok) {
      loadTrendStatus.textContent = "";
      return;
    }
  }

  preferenceProfileInput.value = text;
  savePreferenceProfile(text);

  loadTrendStatus.textContent = "読み込みました。下の「好みと傾向」欄で自由に書き直せます。";
  loadTrendStatus.classList.remove("is-error");
  trendResponseInput.value = "";
});

preferenceProfileInput.value = loadPreferenceProfile();
// blurだけだと入力直後にアプリを閉じた場合保存されないことがあるので、入力のたびにも保存する
preferenceProfileInput.addEventListener("input", () => {
  savePreferenceProfile(preferenceProfileInput.value);
});
preferenceProfileInput.addEventListener("blur", () => {
  preferenceProfileInput.value = preferenceProfileInput.value.trim();
  savePreferenceProfile(preferenceProfileInput.value);
});

// PWA用：Service Workerを登録してオフラインでも開けるようにする
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // 登録に失敗しても画面自体は動くので無視してよい
    });
  });
}

// 「家族構成」のデータ読み込み（loadFamilyMembers）と、「苦手な食材」「アレルギー」の
// データ読み書き（DISLIKE/ALLERGY_STORAGE_KEY・load/save系）は js/shared.js にまとめてあり、
// dislikes.htmlでこのファイルより先に読み込んでいる。

// 「苦手な食材」ページの画面表示
// 「いつまで」を設定すると、その日を過ぎたらAIへの質問文には含めなくなる
// （体調や時期によって一時的に避けたいもの、のための制限）。空欄ならずっと有効。

const dislikeForm = document.getElementById("dislike-form");
const dislikeNameInput = document.getElementById("dislike-name-input");
const dislikeMemberGroup = document.getElementById("dislike-member-group");
const dislikeUntilInput = document.getElementById("dislike-until-input");
const dislikeList = document.getElementById("dislike-list");
const dislikeEmptyMessage = document.getElementById("dislike-empty-message");

let selectedDislikeMemberIds = new Set();

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// フォームの「対象の家族」ボタン群を作る。未選択（何も押していない）状態は
// 「家族全員が対象」として扱う（これまで通りの挙動を変えないための初期値）。
function renderDislikeMemberButtons() {
  const members = loadFamilyMembers();
  dislikeMemberGroup.innerHTML = "";

  for (const member of members) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "status-btn member-btn";
    btn.textContent = member.name;
    const isSelected = selectedDislikeMemberIds.has(member.id);
    if (isSelected) btn.classList.add("is-selected");
    btn.setAttribute("aria-pressed", String(isSelected));
    btn.addEventListener("click", () => {
      if (selectedDislikeMemberIds.has(member.id)) {
        selectedDislikeMemberIds.delete(member.id);
      } else {
        selectedDislikeMemberIds.add(member.id);
      }
      renderDislikeMemberButtons();
    });
    dislikeMemberGroup.appendChild(btn);
  }
}

function renderDislikes() {
  const members = loadFamilyMembers();
  const memberById = new Map(members.map((m) => [m.id, m]));
  const items = loadDislikedIngredients();
  dislikeList.innerHTML = "";
  dislikeEmptyMessage.style.display = items.length === 0 ? "block" : "none";

  for (const item of items) {
    const li = document.createElement("li");
    const isExpired = item.until && item.until < todayKey();
    if (isExpired) li.classList.add("is-expired");

    const names = (item.memberIds || [])
      .map((id) => memberById.get(id))
      .filter(Boolean)
      .map((m) => m.name);
    const targetText = names.length > 0 ? names.join("・") : "家族全員";
    const untilText = item.until ? `・〜${item.until}${isExpired ? "・期限切れ" : ""}` : "";

    const nameLabel = document.createElement("span");
    nameLabel.className = "pantry-name";
    nameLabel.textContent = `${item.text}（対象：${targetText}${untilText}）`;
    li.appendChild(nameLabel);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "削除");
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm(`「${item.text}」を削除しますか？`)) return;
      const current = loadDislikedIngredients().filter((i) => i.id !== item.id);
      saveDislikedIngredients(current);
      renderDislikes();
    });
    li.appendChild(deleteBtn);

    dislikeList.appendChild(li);
  }
}

dislikeForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = dislikeNameInput.value.trim();
  if (!text) return;
  const until = dislikeUntilInput.value;

  const items = loadDislikedIngredients();
  items.unshift({ id: Date.now(), text, until, memberIds: [...selectedDislikeMemberIds] });
  saveDislikedIngredients(items);
  renderDislikes();

  dislikeNameInput.value = "";
  dislikeUntilInput.value = "";
  selectedDislikeMemberIds = new Set();
  renderDislikeMemberButtons();
  dislikeNameInput.focus();
});

renderDislikeMemberButtons();
renderDislikes();

// 「アレルギー」機能
// 苦手な食材とは別枠。安全に関わるため、AIへの質問文では「絶対に使わないでください」と
// 強く伝える（app.jsのbuildPrompt内）。誰が対象かも家族構成から選べるようにする。

const allergyForm = document.getElementById("allergy-form");
const allergyNameInput = document.getElementById("allergy-name-input");
const allergyMemberGroup = document.getElementById("allergy-member-group");
const allergyList = document.getElementById("allergy-list");
const allergyEmptyMessage = document.getElementById("allergy-empty-message");

let selectedAllergyMemberIds = new Set();

// フォームの「対象の家族」ボタン群を作る。未選択（何も押していない）状態は
// 「家族全員が対象」として扱う＝デフォルトで一番安全な側に倒す。
function renderAllergyMemberButtons() {
  const members = loadFamilyMembers();
  allergyMemberGroup.innerHTML = "";

  for (const member of members) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "status-btn member-btn";
    btn.textContent = member.name;
    const isSelected = selectedAllergyMemberIds.has(member.id);
    if (isSelected) btn.classList.add("is-selected");
    btn.setAttribute("aria-pressed", String(isSelected));
    btn.addEventListener("click", () => {
      if (selectedAllergyMemberIds.has(member.id)) {
        selectedAllergyMemberIds.delete(member.id);
      } else {
        selectedAllergyMemberIds.add(member.id);
      }
      renderAllergyMemberButtons();
    });
    allergyMemberGroup.appendChild(btn);
  }
}

function renderAllergies() {
  const members = loadFamilyMembers();
  const memberById = new Map(members.map((m) => [m.id, m]));
  const items = loadAllergies();
  allergyList.innerHTML = "";
  allergyEmptyMessage.style.display = items.length === 0 ? "block" : "none";

  for (const item of items) {
    const li = document.createElement("li");

    const names = (item.memberIds || [])
      .map((id) => memberById.get(id))
      .filter(Boolean)
      .map((m) => m.name);
    const targetText = names.length > 0 ? names.join("・") : "家族全員";

    const nameLabel = document.createElement("span");
    nameLabel.className = "pantry-name";
    nameLabel.textContent = `${item.text}（対象：${targetText}）`;
    li.appendChild(nameLabel);

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "削除");
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm(`「${item.text}」を削除しますか？`)) return;
      const current = loadAllergies().filter((i) => i.id !== item.id);
      saveAllergies(current);
      renderAllergies();
    });
    li.appendChild(deleteBtn);

    allergyList.appendChild(li);
  }
}

allergyForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = allergyNameInput.value.trim();
  if (!text) return;

  const items = loadAllergies();
  items.unshift({ id: Date.now(), text, memberIds: [...selectedAllergyMemberIds] });
  saveAllergies(items);
  renderAllergies();

  allergyNameInput.value = "";
  selectedAllergyMemberIds = new Set();
  renderAllergyMemberButtons();
  allergyNameInput.focus();
});

renderAllergyMemberButtons();
renderAllergies();

// PWA用：Service Workerを登録してオフラインでも開けるようにする
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // 登録に失敗しても画面自体は動くので無視してよい
    });
  });
}

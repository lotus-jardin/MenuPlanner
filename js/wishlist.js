// 「食べたいものメモ」機能
// localStorage = スマホのブラウザの中にある保存場所。ページを閉じても消えない。
const STORAGE_KEY = "menuApp.wishList";

const form = document.getElementById("wish-form");
const input = document.getElementById("wish-input");
const list = document.getElementById("wish-list");
const emptyMessage = document.getElementById("empty-message");

function loadWishes() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveWishes(wishes) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(wishes));
}

function render(wishes) {
  list.innerHTML = "";
  emptyMessage.style.display = wishes.length === 0 ? "block" : "none";

  for (const wish of wishes) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "wish-text";
    span.textContent = wish.text;

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "削除");
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm(`「${wish.text}」を削除しますか？`)) return;
      const wishes = loadWishes().filter((w) => w.id !== wish.id);
      saveWishes(wishes);
      render(wishes);
    });

    li.appendChild(span);
    li.appendChild(deleteBtn);
    list.appendChild(li);
  }
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;

  const wishes = loadWishes();
  wishes.unshift({ id: Date.now(), text });
  saveWishes(wishes);
  render(wishes);

  input.value = "";
  input.focus();
});

render(loadWishes());

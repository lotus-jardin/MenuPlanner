// 「今ある食材」機能
// 家にある食材（品名＋量）を書いておくと、AIへの質問文に含めて使い切りを提案してもらえる。
// 買う食材リストからも自動で除外される。
const STOCK_STORAGE_KEY = "menuApp.stock";
const STOCK_SOURCE_LABELS = { receipt: "📷 レシートから", fridge: "📷 冷蔵庫の写真から" };

const stockForm = document.getElementById("stock-form");
const stockNameInput = document.getElementById("stock-name-input");
const stockAmountInput = document.getElementById("stock-amount-input");
const stockList = document.getElementById("stock-list");
const stockEmptyMessage = document.getElementById("stock-empty-message");

function loadStock() {
  const raw = localStorage.getItem(STOCK_STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveStock(items) {
  localStorage.setItem(STOCK_STORAGE_KEY, JSON.stringify(items));
}

function renderStock() {
  const items = loadStock();
  stockList.innerHTML = "";
  stockEmptyMessage.style.display = items.length === 0 ? "block" : "none";

  for (const item of items) {
    const li = document.createElement("li");

    const span = document.createElement("span");
    span.className = "wish-text";
    span.textContent = item.amount ? `${item.name}（${item.amount}）` : item.name;
    // 写真から登録した物は、どこから来たかがわかるように小さく表示する
    const sourceLabel = STOCK_SOURCE_LABELS[item.source];
    if (sourceLabel) {
      const source = document.createElement("span");
      source.className = "stock-source";
      source.textContent = sourceLabel;
      span.appendChild(source);
    }

    const deleteBtn = document.createElement("button");
    deleteBtn.className = "delete-btn";
    deleteBtn.textContent = "×";
    deleteBtn.setAttribute("aria-label", "削除");
    deleteBtn.addEventListener("click", () => {
      if (!window.confirm(`「${item.name}」を削除しますか？`)) return;
      const current = loadStock().filter((i) => i.id !== item.id);
      saveStock(current);
      renderStock();
      renderShoppingList();
    });

    li.appendChild(span);
    li.appendChild(deleteBtn);
    stockList.appendChild(li);
  }
}

stockForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = stockNameInput.value.trim();
  if (!name) return;
  const amount = stockAmountInput.value.trim();

  const items = loadStock();
  items.unshift({ id: Date.now(), name, amount });
  saveStock(items);
  renderStock();
  renderShoppingList();

  stockNameInput.value = "";
  stockAmountInput.value = "";
  stockNameInput.focus();
});

renderStock();

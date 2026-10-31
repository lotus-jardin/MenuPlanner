// AIが提案する「副菜」の表示（期間ごとに保存）
// SIDE_DISH_KEY・loadAllSideDishes・saveSideDishesForPeriod は js/shared.js にまとめてある。
const sideDishList = document.getElementById("side-dish-list");
const sideDishEmpty = document.getElementById("side-dish-empty");

function renderSideDishes() {
  const dishes = loadAllSideDishes()[getPeriodKey()] || [];
  sideDishList.innerHTML = "";
  sideDishEmpty.style.display = dishes.length === 0 ? "block" : "none";

  for (const dish of dishes) {
    const li = document.createElement("li");

    const dishLabel = document.createElement("span");
    dishLabel.className = "menu-dish-btn";
    dishLabel.textContent = dish.dish || "";
    li.appendChild(dishLabel);

    if (dish.note) {
      const noteLabel = document.createElement("span");
      noteLabel.className = "menu-note";
      noteLabel.textContent = dish.note;
      li.appendChild(noteLabel);
    }

    sideDishList.appendChild(li);
  }
}

renderSideDishes();

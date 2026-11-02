// 「お気に入りの献立」ページの画面表示
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
      location.href = "index.html#menu";
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

// PWA用：Service Workerを登録してオフラインでも開けるようにする
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // 登録に失敗しても画面自体は動くので無視してよい
    });
  });
}

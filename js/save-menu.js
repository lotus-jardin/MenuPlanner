// 「お気に入りの献立」への登録（期間に名前を付けてブックマークしておく機能。画面は menus.html）
// SAVED_MENUS_KEY・loadSavedMenus・saveSavedMenus は js/shared.js にまとめてある。
const saveMenuForm = document.getElementById("save-menu-form");
const saveMenuLabelInput = document.getElementById("save-menu-label-input");
const saveMenuStatus = document.getElementById("save-menu-status");

saveMenuForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const start = loadPeriodStart();
  const end = loadPeriodEnd();
  const label = saveMenuLabelInput.value.trim() || `${start} 〜 ${end}`;

  // 期間（開始日・終了日）のしおりだけでなく、保存した時点の献立・副菜の
  // 中身も一緒に保存しておく。しおりだけだと、同じ日付でAIの献立を読み込み
  // 直したときに、保存したはずの内容が気づかないうちに置き換わってしまう。
  const menuMap = loadMenu();
  const menuSnapshot = {};
  for (const date of getPeriodDates()) {
    const dateKey = toDateKey(date);
    if (menuMap[dateKey]) menuSnapshot[dateKey] = menuMap[dateKey];
  }
  const sideDishesSnapshot = loadAllSideDishes()[getPeriodKey()] || [];

  const list = loadSavedMenus();
  list.unshift({
    id: Date.now(),
    periodStart: start,
    periodEnd: end,
    label,
    savedAt: new Date().toISOString(),
    menuSnapshot,
    sideDishesSnapshot,
  });
  saveSavedMenus(list);

  saveMenuLabelInput.value = "";
  saveMenuStatus.textContent = "お気に入りに登録しました。「お気に入りの献立」から見られます。";
  saveMenuStatus.classList.remove("is-error");
});

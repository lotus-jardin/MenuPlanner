// 画面下のタブ（予定・献立・買い物・ふりかえり・設定）の切り替え。
// URLの「#menu」などで表示するタブを決めるので、他のページから index.html#review のように
// 直接開ける。最後に見ていたタブは覚えておき、次に開いたときにそのタブを出す。
// （この保存はデータではないので、バックアップの対象「menuApp.」とは別の名前にしている）
const TAB_NAMES = ["plan", "menu", "shopping", "review", "settings"];
const LAST_TAB_KEY = "menuAppUi.lastTab";

function showTab(name, { scroll = true } = {}) {
  if (!TAB_NAMES.includes(name)) name = "plan";
  for (const panel of document.querySelectorAll(".tab-panel")) {
    panel.hidden = panel.dataset.tab !== name;
  }
  for (const link of document.querySelectorAll(".tab-bar a[data-tab]")) {
    if (link.dataset.tab === name) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  try {
    localStorage.setItem(LAST_TAB_KEY, name);
  } catch {
    // 保存できなくても表示には影響しない
  }
  // ふりかえりは他のタブでの操作（👍やメモの削除）で中身が変わるので、開くたびに描き直す
  if (name === "review") renderReview();
  if (scroll) window.scrollTo(0, 0);
}

function tabFromHash() {
  const name = location.hash.replace("#", "");
  return TAB_NAMES.includes(name) ? name : null;
}

window.addEventListener("hashchange", () => showTab(tabFromHash() || "plan"));

let initialTab = tabFromHash();
if (!initialTab) {
  try {
    initialTab = localStorage.getItem(LAST_TAB_KEY);
  } catch {
    initialTab = null;
  }
}
showTab(initialTab || "plan", { scroll: false });

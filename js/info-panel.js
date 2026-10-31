// 「？」ボタン：このアプリについての説明パネル
const infoBtn = document.getElementById("info-btn");
const infoOverlay = document.getElementById("info-overlay");
const infoCloseBtn = document.getElementById("info-close-btn");

function openInfoPanel() {
  infoOverlay.hidden = false;
  infoCloseBtn.focus();
}

function closeInfoPanel() {
  infoOverlay.hidden = true;
  infoBtn.focus();
}

infoBtn.addEventListener("click", openInfoPanel);
infoCloseBtn.addEventListener("click", closeInfoPanel);
infoOverlay.addEventListener("click", (event) => {
  if (event.target === infoOverlay) closeInfoPanel();
});
infoOverlay.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeInfoPanel();
});

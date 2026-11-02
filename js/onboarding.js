// はじめて使う人向けの案内カード。閉じるか、献立がひとつでもできたら出さない。
const ONBOARDING_DONE_KEY = "menuApp.onboardingDone";
const onboardingCard = document.getElementById("onboarding-card");
const onboardingCloseBtn = document.getElementById("onboarding-close-btn");

function renderOnboarding() {
  const done = localStorage.getItem(ONBOARDING_DONE_KEY) === "1";
  const hasMenu = Object.values(loadMenu()).some((entry) => entry && entry.dish);
  onboardingCard.hidden = done || hasMenu;
}

onboardingCloseBtn.addEventListener("click", () => {
  localStorage.setItem(ONBOARDING_DONE_KEY, "1");
  renderOnboarding();
});

renderOnboarding();

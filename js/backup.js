// 「データのバックアップ」機能
// このアプリのデータ（menuApp. で始まるキー全部）をひとつのファイルに書き出し、
// 別の端末でそのファイルを取り込むと同じデータが復元できる（端末変更・夫婦間の共有用）。
const exportBackupBtn = document.getElementById("export-backup-btn");
const exportBackupStatus = document.getElementById("export-backup-status");
const lastBackupLabel = document.getElementById("last-backup-label");
const importBackupInput = document.getElementById("import-backup-input");
const importBackupStatus = document.getElementById("import-backup-status");
const importBackupLabel = document.getElementById("import-backup-label");

// ラベル要素は本来キーボードでは選べないので、Enter/Spaceでもファイル選択を開けるようにする
importBackupLabel.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    importBackupInput.click();
  }
});

// Safariはしばらく開かないと保存データが消えることがあるため、できるだけ消えにくくするよう頼んでおく
// （対応していないブラウザでは何もしない。ユーザーに確認が出ることもあるが、失敗しても無視してよい）
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().catch(() => {});
}

function collectBackupData() {
  const data = {};
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith("menuApp.")) {
      data[key] = localStorage.getItem(key);
    }
  }
  return data;
}

// 最後にいつ書き出したか覚えておく（しばらく取っていないことに気づけるように）
const LAST_BACKUP_KEY = "menuApp.lastBackupAt";

function renderLastBackupDate() {
  const date = localStorage.getItem(LAST_BACKUP_KEY);
  if (!date) {
    lastBackupLabel.textContent = "まだ一度も書き出していません。";
    return;
  }
  const daysSince = Math.floor((new Date() - parseDateKey(date)) / (1000 * 60 * 60 * 24));
  const staleNote = daysSince >= 14 ? "（2週間以上たっています。書き出しをおすすめします）" : "";
  lastBackupLabel.textContent = `前回の書き出し：${date}${staleNote}`;
}

exportBackupBtn.addEventListener("click", () => {
  const json = JSON.stringify(collectBackupData(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `献立アプリ_バックアップ_${toDateKey(new Date())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  localStorage.setItem(LAST_BACKUP_KEY, toDateKey(new Date()));
  renderLastBackupDate();

  exportBackupStatus.textContent = "書き出しました。このファイルを保存しておいてください。";
  exportBackupStatus.classList.remove("is-error");
});

renderLastBackupDate();

importBackupInput.addEventListener("change", async () => {
  const file = importBackupInput.files[0];
  if (!file) return;

  try {
    const data = JSON.parse(await file.text());
    const keys = Object.keys(data).filter((key) => key.startsWith("menuApp."));
    if (keys.length === 0) throw new Error("menuAppのデータが見つからない");

    const ok = window.confirm("取り込むと、今この端末に入っているデータは上書きされます。よろしいですか？");
    if (!ok) {
      importBackupInput.value = "";
      return;
    }

    for (const key of keys) {
      localStorage.setItem(key, data[key]);
    }

    importBackupStatus.textContent = "取り込みました。画面を読み込み直します。";
    importBackupStatus.classList.remove("is-error");
    setTimeout(() => location.reload(), 800);
  } catch {
    importBackupStatus.textContent = "読み込めませんでした。「データを書き出す」で作ったファイルを選んでください。";
    importBackupStatus.classList.add("is-error");
    importBackupInput.value = "";
  }
});

// PWA用：Service Workerを登録してオフラインでも開けるようにする
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      // 登録に失敗してもメモ機能自体は動くので無視してよい
    });
  });
}

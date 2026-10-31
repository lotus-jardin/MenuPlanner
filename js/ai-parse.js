// AIの返事（JSON）の読み取り。コードブロックで囲まれていたり、前置きの文章が
// 付いていたり、スマート引用符や配列の角かっこ抜けなど形式がバラつきやすいので、
// 何パターンか試して読み取れたものを使う。

// ChatGPTなどが「"」の代わりに全角っぽい引用符（" "）を使ってしまうことがある。
// JSONとしては無効なので、素直な引用符に直す。
function normalizeSmartQuotes(text) {
  return text.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
}

// ChatGPTの返事をコピーすると、「\[」「\]」のようにマークダウン用の「\」が付いてくる
// ことがある。JSONで意味のある「\"」「\n」などは残し、それ以外の「\」だけ取り除く。
function removeMarkdownEscapes(text) {
  return text.replace(/\\(.)/g, (match, ch) => ('"\\/bfnrtu'.includes(ch) ? match : ch));
}

// 「"ingredients": { … }, { … }, { … }」のように、本来 [ ... ] で囲むはずの
// オブジェクトの並びを、角かっこ無しでそのまま書いてしまうことがある
// （ChatGPTで時々見られる崩れ方）。コロンの直後が「{ … }, { … }」の形に
// なっている箇所を探して、[ ... ] で囲み直す。文字列の中の { } や , は
// 無視するよう、引用符の中身は読み飛ばしながら1文字ずつ見ていく。
function wrapMissingArrayBrackets(text) {
  let result = "";
  let i = 0;
  const n = text.length;

  function skipString(startIdx) {
    let j = startIdx + 1;
    while (j < n) {
      if (text[j] === "\\") {
        j += 2;
        continue;
      }
      if (text[j] === '"') return j + 1;
      j++;
    }
    return j;
  }

  function findMatchingBrace(startIdx) {
    let depth = 0;
    let j = startIdx;
    while (j < n) {
      const ch = text[j];
      if (ch === '"') {
        j = skipString(j);
        continue;
      }
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) return j;
      }
      j++;
    }
    return -1;
  }

  while (i < n) {
    if (text[i] === '"') {
      const end = skipString(i);
      result += text.slice(i, end);
      i = end;
      continue;
    }
    if (text[i] === ":") {
      result += text[i];
      i++;
      let k = i;
      while (k < n && /\s/.test(text[k])) k++;
      if (text[k] === "{") {
        const firstClose = findMatchingBrace(k);
        if (firstClose !== -1) {
          let m = firstClose + 1;
          while (m < n && /\s/.test(text[m])) m++;
          if (text[m] === ",") {
            let m2 = m + 1;
            while (m2 < n && /\s/.test(text[m2])) m2++;
            if (text[m2] === "{") {
              // 2つ目以降の { が続く＝配列のはずだったと判断し、末尾まで辿る
              let segEnd = firstClose;
              let cursor = m2;
              while (true) {
                const close = findMatchingBrace(cursor);
                if (close === -1) break;
                segEnd = close;
                let p = close + 1;
                while (p < n && /\s/.test(text[p])) p++;
                if (text[p] === ",") {
                  let p2 = p + 1;
                  while (p2 < n && /\s/.test(text[p2])) p2++;
                  if (text[p2] === "{") {
                    cursor = p2;
                    continue;
                  }
                }
                break;
              }
              result += text.slice(i, k);
              result += "[" + text.slice(k, segEnd + 1) + "]";
              i = segEnd + 1;
              continue;
            }
          }
        }
      }
      continue;
    }
    result += text[i];
    i++;
  }
  return result;
}

function extractJson(text) {
  const trimmed = text.trim();
  const candidates = [];

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) candidates.push(fenceMatch[1]);

  candidates.push(trimmed);

  const braceMatch = trimmed.match(/\{[\s\S]*\}/);
  if (braceMatch) candidates.push(braceMatch[0]);

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      // AIがたまに付けてしまう末尾の余分なカンマを取り除いて、もう一度だけ試す
      try {
        return JSON.parse(candidate.replace(/,\s*([}\]])/g, "$1"));
      } catch {
        // それでも読み取れない場合、「\[」・スマート引用符・配列の角かっこ抜けという
        // よくある崩れ方を直してから最後にもう一度だけ試す
        try {
          const cleaned = removeMarkdownEscapes(normalizeSmartQuotes(candidate));
          const repaired = wrapMissingArrayBrackets(cleaned).replace(
            /,\s*([}\]])/g,
            "$1"
          );
          return JSON.parse(repaired);
        } catch {
          continue;
        }
      }
    }
  }
  return null;
}

/*
 * check-html-refs.mjs — 檢查 HTML 引用的本機檔案是否存在
 * ============================================================
 * 掃描專案根目錄的所有 .html，抓出 src="..." 與 href="..." 的本機相對路徑
 * （略過 http(s):、//、#、mailto: 與空值），確認對應檔案真的存在。
 * 用來擋掉「CSS／JS／圖片路徑打錯或搬移後忘了改」導致線上壞掉。
 * 有任何缺檔則以非零狀態結束，讓 CI 失敗。
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";

const root = process.cwd();

// 找出根目錄的 .html 檔。
const htmlFiles = readdirSync(root).filter((f) => f.endsWith(".html"));

// 抓 src / href 屬性值。
const attrRe = /(?:src|href)\s*=\s*"([^"]*)"/gi;

// 需要略過的外部或非檔案引用。
function isExternal(ref) {
  return (
    ref === "" ||
    /^https?:\/\//i.test(ref) ||
    ref.startsWith("//") ||
    ref.startsWith("#") ||
    ref.startsWith("mailto:") ||
    ref.startsWith("data:") ||
    ref.startsWith("tel:")
  );
}

const problems = [];

for (const file of htmlFiles) {
  const html = readFileSync(join(root, file), "utf8");
  let m;
  while ((m = attrRe.exec(html)) !== null) {
    const ref = m[1].trim();
    if (isExternal(ref)) continue;
    // 去掉查詢字串與錨點（例如 index.html#cities、style.css?v=2）。
    const clean = ref.split("#")[0].split("?")[0];
    if (!clean) continue;
    const target = resolve(dirname(join(root, file)), clean);
    if (!existsSync(target)) {
      problems.push(`${file} → 找不到 "${ref}"`);
    }
  }
}

if (problems.length) {
  console.error("HTML 引用檢查失敗，以下本機檔案不存在：");
  for (const p of problems) console.error("  - " + p);
  process.exit(1);
}

console.log(`HTML 引用檢查通過（掃描 ${htmlFiles.length} 個 .html）。`);

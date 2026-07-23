import { chromium } from "playwright";
import fs from "fs/promises";
import path from "path";

(async () => {
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext();

  const page = await context.newPage();

  await page.goto("https://www.instagram.com/");

  console.log("");
  console.log("=====================================");
  console.log(" Instagram 로그인 후");
  console.log(" 프로필 화면까지 간 다음");
  console.log(" 이 창으로 돌아와 Enter를 누르세요.");
  console.log("=====================================");
  console.log("");

  process.stdin.resume();

  await new Promise((resolve) =>
    process.stdin.once("data", resolve)
  );

  const dir = path.join(process.cwd(), "playwright", ".auth");

  await fs.mkdir(dir, {
    recursive: true,
  });

  await context.storageState({
    path: path.join(dir, "instagram.json"),
  });

  console.log("저장 완료!");

  await browser.close();
})();
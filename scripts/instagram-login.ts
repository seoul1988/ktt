import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";

async function main() {
  const authDirectory = path.join(
    process.cwd(),
    "playwright",
    ".auth",
  );

  const authFile = path.join(
    authDirectory,
    "instagram.json",
  );

  fs.mkdirSync(authDirectory, {
    recursive: true,
  });

  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: {
      width: 1365,
      height: 900,
    },
  });

  const page = await context.newPage();

  await page.goto("https://www.instagram.com/accounts/login/", {
    waitUntil: "domcontentloaded",
  });

  console.log("");
  console.log("Instagram에 직접 로그인하세요.");
  console.log(
    "로그인이 끝나고 Instagram 홈 화면이 보이면 터미널에서 Enter를 누르세요.",
  );
  console.log("");

  const readlineInterface = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  await new Promise<void>((resolve) => {
    readlineInterface.question(
      "로그인 완료 후 Enter: ",
      () => resolve(),
    );
  });

  readlineInterface.close();

  await context.storageState({
    path: authFile,
  });

  console.log("");
  console.log(`로그인 파일 생성 완료: ${authFile}`);

  await browser.close();
}

main().catch((error) => {
  console.error("Instagram 로그인 파일 생성 실패:", error);
  process.exit(1);
});
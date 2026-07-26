const { expect, test } = require("@playwright/test");

// Vue 3 changes the rasterization of the collapsed, rotated control menu.
// The observed difference is confined to that control and stays below 0.1%
// of this viewport; keep the threshold tight so layout regressions still fail.
const MAX_VISUAL_DIFF_PIXELS = 800;

async function openHome(page) {
  await page.addInitScript(() => {
    window.localStorage.setItem("lastVersion", "3.3.1");
    Math.random = () => 0.4242;
  });
  await page.route("**/dynamic/init", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        payload: { version: "3.3.1", floatingNotice: "" },
      }),
    }),
  );
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
  await page.goto("/");
  await expect(page.locator(".intro")).toBeVisible();
}

async function rejectClipboardWrites(page) {
  await page.addInitScript(() => {
    window.unhandledRejections = [];
    window.addEventListener("unhandledrejection", (event) => {
      window.unhandledRejections.push(String(event.reason));
      event.preventDefault();
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: () =>
          Promise.reject(
            new DOMException("Write permission denied", "NotAllowedError"),
          ),
      },
    });
  });
}

async function openCreateRoomDialog(page) {
  const createRoom = page
    .locator(".intro")
    .getByText("创建房间", { exact: true });
  await expect(createRoom).toHaveCount(1);
  await createRoom.click();

  const nameDialog = page
    .getByRole("dialog")
    .filter({ hasText: "输入玩家昵称" });
  await expect(nameDialog).toHaveCount(1);
  await nameDialog.locator("#input-1").fill("测试说书人");
  await nameDialog.getByRole("button", { name: "确认", exact: true }).click();

  const roomDialog = page
    .getByRole("dialog")
    .filter({ hasText: "请输入房间号" });
  await expect(roomDialog).toHaveCount(1);
  await expect(roomDialog).toBeVisible();
}

test("首页展示可用的魔典入口", async ({ page }) => {
  await openHome(page);

  const intro = page.locator(".intro");
  await expect(intro).toContainText("欢迎来到城镇广场。");
  await expect(intro.getByText("创建房间", { exact: true })).toHaveCount(1);
  await expect(intro.getByText("加入房间", { exact: true })).toHaveCount(1);
});

test("创建房间打开房间和人数输入框", async ({ page }) => {
  await openHome(page);
  await openCreateRoomDialog(page);

  const roomDialog = page
    .getByRole("dialog")
    .filter({ hasText: "请输入房间号" });
  await expect(roomDialog.locator("#input-1")).toBeVisible();
  await expect(roomDialog.locator("#input-2")).toBeVisible();
  await expect(
    roomDialog.getByRole("button", { name: "确认", exact: true }),
  ).toHaveCount(1);
});

test("创建房间后进入说书人魔典", async ({ page }) => {
  await rejectClipboardWrites(page);
  await openHome(page);
  await openCreateRoomDialog(page);

  const roomDialog = page
    .getByRole("dialog")
    .filter({ hasText: "请输入房间号" });
  await roomDialog.locator("#input-1").fill("4242");
  await roomDialog.locator("#input-2").fill("2");
  await roomDialog.getByRole("button", { name: "确认", exact: true }).click();

  await expect(page.locator(".intro")).toHaveCount(0);
  await expect(page.locator("#townsquare .player")).toHaveCount(2);
  await expect(page.locator("#townsquare .donation")).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => window.unhandledRejections))
    .toEqual([]);
});

test("帮助菜单提供法律与署名入口", async ({ page }) => {
  await openHome(page);

  await page.locator("#controls .menu > svg").click();
  await page.locator("#controls .menu .tabs svg").last().click();

  const legalEntry = page.getByText("法律与署名", { exact: true });
  await expect(legalEntry).toBeVisible();
  await legalEntry.click();

  const legalDialog = page
    .getByRole("dialog")
    .filter({ hasText: "法律与署名" });
  await expect(legalDialog).toContainText("Copyright (C) 2026 @limpy01");
  await expect(legalDialog).toContainText("bra1n/townsquare");
});

test("首页空魔典视觉基线 @visual", async ({ page }) => {
  await openHome(page);

  await expect(page).toHaveScreenshot("home-empty.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: MAX_VISUAL_DIFF_PIXELS,
  });
});

test("创建房间弹窗视觉基线 @visual", async ({ page }) => {
  await openHome(page);
  await openCreateRoomDialog(page);
  const roomDialog = page
    .getByRole("dialog")
    .filter({ hasText: "请输入房间号" });
  await expect(roomDialog.locator("#input-1")).toBeVisible();

  await expect(page).toHaveScreenshot("create-room-dialog.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: MAX_VISUAL_DIFF_PIXELS,
  });
});

test("说书人魔典白天与夜晚视觉基线 @visual", async ({ page }) => {
  await rejectClipboardWrites(page);
  await openHome(page);
  await openCreateRoomDialog(page);

  const roomDialog = page
    .getByRole("dialog")
    .filter({ hasText: "请输入房间号" });
  await roomDialog.locator("#input-1").fill("4242");
  await roomDialog.locator("#input-2").fill("5");
  await roomDialog.getByRole("button", { name: "确认", exact: true }).click();
  await expect(page.locator("#townsquare .player")).toHaveCount(5);

  await expect(page).toHaveScreenshot("storyteller-day.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: MAX_VISUAL_DIFF_PIXELS,
  });

  await page.locator("#townsquare-app").focus();
  await page.keyboard.press("s");
  await expect(page.locator("#townsquare-app")).toHaveClass(/night/);
  await expect(page).toHaveScreenshot("storyteller-night.png", {
    animations: "disabled",
    caret: "hide",
    maxDiffPixels: MAX_VISUAL_DIFF_PIXELS,
  });
});

const { expect, test } = require("@playwright/test");

async function preparePage(page, random = 0.4242) {
  await page.addInitScript((value) => {
    window.localStorage.setItem("lastVersion", "3.3.1");
    Math.random = () => value;
  }, random);
  await page.route("https://fonts.googleapis.com/**", (route) => route.abort());
}

async function createRoom(page, roomId, playerCount) {
  await preparePage(page);
  await page.goto("/", { waitUntil: "domcontentloaded" });

  const createRoom = page
    .locator(".intro")
    .getByText("创建房间", { exact: true });
  await expect(createRoom).toHaveCount(1);
  await createRoom.click();

  const nameDialog = page
    .getByRole("dialog")
    .filter({ hasText: "输入玩家昵称" });
  await expect(nameDialog).toHaveCount(1);
  await nameDialog.locator("#input-1").fill("MIG-054 说书人");
  await nameDialog.getByRole("button", { name: "确认", exact: true }).click();

  const roomDialog = page
    .getByRole("dialog")
    .filter({ hasText: "请输入房间号" });
  await expect(roomDialog).toHaveCount(1);
  await roomDialog.locator("#input-1").fill(roomId);
  await roomDialog.locator("#input-2").fill(String(playerCount));
  await roomDialog.getByRole("button", { name: "确认", exact: true }).click();

  await expect(page.locator("#townsquare .circle > li")).toHaveCount(
    playerCount,
  );
}

async function joinRoom(page, roomId, name) {
  await preparePage(page, 0.5252);
  await page.goto(`/#${roomId}`, { waitUntil: "domcontentloaded" });

  const nameDialog = page
    .getByRole("dialog")
    .filter({ hasText: "输入玩家昵称" });
  await expect(nameDialog).toHaveCount(1);
  await nameDialog.locator("#input-1").fill(name);
  await nameDialog.getByRole("button", { name: "确认", exact: true }).click();

  await expect(page.locator("#townsquare.spectator")).toHaveCount(1);
}

async function openSeatMenu(page, seat) {
  const seats = page.locator("#townsquare .circle > li");
  await expect(seats).toHaveCount(2);
  const targetSeat = seats.nth(seat);
  const seatName = targetSeat.locator("div.name");
  await expect(seatName).toHaveCount(1);
  await seatName.click();
  await expect(targetSeat.locator(".menu")).toHaveCount(1);
  return targetSeat;
}

async function openSessionMenu(page) {
  await page.locator("#controls .menu > svg").click();
  await page.locator("#controls .menu .tabs svg").nth(1).click();
}

test("玩家可加入、认领和离开座位，并在重连后恢复连接", async ({
  browser,
  page: storyteller,
}) => {
  const roomId = "5401";
  await createRoom(storyteller, roomId, 2);

  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  await joinRoom(player, roomId, "MIG-054 玩家");

  const playerSeat = await openSeatMenu(player, 0);
  const sitDown = playerSeat
    .locator(".menu")
    .getByText("坐下", { exact: true });
  await expect(sitDown).toHaveCount(1);
  await sitDown.click();

  await expect(storyteller.locator("#townsquare")).toContainText(
    "MIG-054 玩家",
  );
  await player.reload({ waitUntil: "domcontentloaded" });
  await expect(player.locator("#townsquare.spectator")).toHaveCount(1);
  await expect(player.locator("#townsquare")).toContainText("MIG-054 玩家");

  const claimedSeat = await openSeatMenu(player, 0);
  const standUp = claimedSeat
    .locator(".menu")
    .getByText("起立", { exact: true });
  await expect(standUp).toHaveCount(1);
  await standUp.click();
  await expect(storyteller.locator("#townsquare")).not.toContainText(
    "MIG-054 玩家",
  );

  await playerContext.close();
});

test("说书人分发角色后，玩家只收到自己的身份", async ({
  browser,
  page: storyteller,
}) => {
  const roomId = "5402";
  await createRoom(storyteller, roomId, 2);

  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  await joinRoom(player, roomId, "MIG-054 角色玩家");
  const playerSeat = await openSeatMenu(player, 0);
  await playerSeat.locator(".menu").getByText("坐下", { exact: true }).click();
  await expect(storyteller.locator("#townsquare")).toContainText(
    "MIG-054 角色玩家",
  );

  await storyteller
    .locator("#townsquare .circle > li")
    .nth(0)
    .locator(".token")
    .dispatchEvent("click");
  const roleDialog = storyteller.getByRole("dialog").filter({
    hasText: "选择角色",
  });
  await expect(roleDialog).toHaveCount(1);
  await roleDialog.getByText("洗衣妇", { exact: true }).click();

  await openSessionMenu(storyteller);
  await storyteller.getByText("发送角色", { exact: true }).click();
  await storyteller.getByText("确定", { exact: true }).last().click();

  await expect(
    player.locator("#townsquare .circle > li").nth(0).locator(".token"),
  ).toContainText("洗衣妇");

  await playerContext.close();
});

const { expect, test } = require("@playwright/test");

// The cases share one local WebSocket service and intentionally exercise
// connection authorization, whose timeout is much shorter than a browser
// startup under parallel load. Keep the session matrix deterministic.
test.describe.configure({ mode: "serial" });

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

async function joinRoom(page, roomId, name, random = 0.5252) {
  await preparePage(page, random);
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

async function seatPlayer(page, seat = 0) {
  const playerSeat = await openSeatMenu(page, seat);
  const sitDown = playerSeat.locator(".menu").getByText("坐下", { exact: true });
  await expect(sitDown).toHaveCount(1);
  await sitDown.click();
}

async function startNomination(storyteller, nominator = 0, nominee = 1) {
  const nominatorSeat = await openSeatMenu(storyteller, nominator);
  const nominate = nominatorSeat
    .locator(".menu")
    .getByText("提名", { exact: true });
  await expect(nominate).toHaveCount(1);
  await nominate.click();

  const seats = storyteller.locator("#townsquare .circle > li");
  await expect(seats).toHaveCount(2);
  const nomineeAction = seats.nth(nominee).locator(".nominate");
  await expect(nomineeAction).toHaveCount(1);
  await nomineeAction.click();
  await expect(storyteller.locator("#vote")).toHaveCount(1);
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

  await seatPlayer(player);

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
  await seatPlayer(player);
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

test("说书人与玩家完成公开和闭眼投票，并在结束后恢复大厅", async ({
  browser,
  page: storyteller,
}) => {
  const roomId = "5501";
  await createRoom(storyteller, roomId, 2);

  const playerContext = await browser.newContext();
  const player = await playerContext.newPage();
  await joinRoom(player, roomId, "MIG-055 投票玩家");
  await seatPlayer(player);
  await expect(storyteller.locator("#townsquare")).toContainText(
    "MIG-055 投票玩家",
  );

  await startNomination(storyteller);
  await expect(player.locator("#townsquare.spectator")).toHaveCount(1);
  await expect(player.locator("#townsquare")).toContainText(
    "MIG-055 投票玩家",
  );
  const publicVote = player.locator("#vote").getByText("投票", { exact: true });
  await expect(publicVote).toHaveCount(1);
  await publicVote.click();

  const closePublicVote = storyteller
    .locator("#vote")
    .getByText("关闭", { exact: true });
  await expect(closePublicVote).toHaveCount(1);
  await closePublicVote.click();
  await expect(storyteller.locator("#vote")).toHaveCount(0);

  await startNomination(storyteller);
  const secretVote = storyteller.locator("#vote .secretVote");
  await expect(secretVote).toHaveCount(1);
  await secretVote.click();
  await expect(player.locator("#vote")).toContainText("闭眼投票");

  const privateVote = player.locator("#vote").getByText("投票", { exact: true });
  await expect(privateVote).toHaveCount(1);
  await privateVote.click();

  const closeSecretVote = storyteller
    .locator("#vote")
    .getByText("关闭", { exact: true });
  await expect(closeSecretVote).toHaveCount(1);
  await closeSecretVote.click();
  await expect(player.locator("#vote")).toHaveCount(0);
  await playerContext.close();
});

test("说书人可创建群聊并向已落座玩家发送成员资格", async ({
  browser,
  page: storyteller,
}) => {
  const roomId = "5502";
  await createRoom(storyteller, roomId, 2);

  const firstContext = await browser.newContext();
  const firstPlayer = await firstContext.newPage();
  await joinRoom(firstPlayer, roomId, "MIG-055 群聊甲");
  await seatPlayer(firstPlayer, 0);

  const secondContext = await browser.newContext();
  const secondPlayer = await secondContext.newPage();
  await joinRoom(secondPlayer, roomId, "MIG-055 群聊乙", 0.6262);
  await seatPlayer(secondPlayer, 1);
  await expect(storyteller.locator("#townsquare")).toContainText(
    "MIG-055 群聊甲",
  );
  await expect(storyteller.locator("#townsquare")).toContainText(
    "MIG-055 群聊乙",
  );

  await storyteller.locator("#townsquare-app").press("d");
  const groupDialog = storyteller
    .getByRole("dialog")
    .filter({ hasText: "创建群聊" });
  await expect(groupDialog).toHaveCount(1);
  const createGroup = groupDialog.getByText("创建", { exact: true });
  await expect(createGroup).toHaveCount(1);
  await createGroup.click();

  const members = groupDialog.locator("input.checkbox");
  await expect(members).toHaveCount(2);
  await members.nth(0).check();
  await members.nth(1).check();
  const confirmGroup = groupDialog.getByText("确定", { exact: true });
  await expect(confirmGroup).toHaveCount(1);
  await confirmGroup.click();

  await expect(groupDialog).toContainText("群聊1");
  await expect(groupDialog).toContainText("MIG-055 群聊甲");
  await expect(groupDialog).toContainText("MIG-055 群聊乙");

  await firstContext.close();
  await secondContext.close();
});

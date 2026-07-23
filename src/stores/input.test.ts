import { beforeEach, describe, expect, it } from "vitest";
import { pinia } from "../pinia";
import { useModalStore } from "./modals";
import { useInputStore } from "./input";

describe("input Pinia store", () => {
  const input = useInputStore(pinia);
  const modals = useModalStore(pinia);

  beforeEach(() => {
    input.$reset();
    modals.$reset();
  });

  it("opens an input modal and resolves its caller value", async () => {
    const result = input.open({
      inputType: "changeName",
      inputModal: "input",
      inputData: { name: ["输入玩家昵称"], length: 1, placeholder: [""] },
    });

    expect(modals.input).toBe(true);
    expect(input.inputType).toBe("changeName");

    input.resolve(["Alice"]);
    input.close();

    await expect(result).resolves.toEqual(["Alice"]);
    expect(modals.input).toBe(false);
    expect(input.inputResolver).toBeNull();
  });

  it("resolves text alerts when they are closed", async () => {
    const result = input.open({
      inputType: "alert",
      inputModal: "text",
      inputData: { name: ["连接失败"] },
    });

    input.close();

    await expect(result).resolves.toBe(true);
  });
});

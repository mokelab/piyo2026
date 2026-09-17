import { describe, expect, it } from "vitest";
import { World } from "../sim/world";
import { ManualInput } from "./manualInput";

function makeWorld(): World {
  return new World({ width: 480, height: 640, seed: 1 });
}

describe("ManualInput", () => {
  it("ドラッグした分だけ、速さの上限内で自機が追いかける", () => {
    const world = makeWorld();
    const input = new ManualInput();
    const { x, y } = world.player;
    input.drag(10, -4);
    for (let i = 0; i < 10; i++) world.step(input.intent(world));
    expect(world.player.x).toBeCloseTo(x + 10);
    expect(world.player.y).toBeCloseTo(y - 4);
  });

  it("1 フレームに動くのは speed まで", () => {
    const world = makeWorld();
    const input = new ManualInput();
    const { x } = world.player;
    input.drag(100, 0);
    world.step(input.intent(world));
    expect(world.player.x).toBeCloseTo(x + world.player.speed);
  });

  it("画面外へのドラッグは溜め込まない", () => {
    const world = makeWorld();
    const input = new ManualInput();
    input.drag(10000, 0);
    for (let i = 0; i < 200; i++) world.step(input.intent(world));
    expect(world.player.x).toBe(480);
    input.drag(-10, 0);
    for (let i = 0; i < 10; i++) world.step(input.intent(world));
    expect(world.player.x).toBeCloseTo(470);
  });

  it("斜めのキー入力は長さ 1 に正規化され、Shift で低速になる", () => {
    const world = makeWorld();
    const input = new ManualInput();
    input.keyDown("ArrowRight");
    input.keyDown("ArrowUp");
    const v = input.intent(world);
    expect(Math.hypot(v.dx, v.dy)).toBeCloseTo(1);
    input.keyDown("ShiftLeft");
    const slow = input.intent(world);
    expect(Math.hypot(slow.dx, slow.dy)).toBeCloseTo(0.4);
  });
});

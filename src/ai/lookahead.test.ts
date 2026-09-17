import { describe, expect, it } from "vitest";
import { demoStage } from "../sim/patterns/basic";
import { World } from "../sim/world";
import { aiDefinitions } from "./registry";
import type { DodgeAI } from "./types";

function play(ai: DodgeAI, frames: number, seed: number): number {
  const world = new World({ width: 480, height: 640, seed });
  world.spawn(demoStage);
  for (let i = 0; i < frames; i++) world.step(ai.decide(world));
  return world.stats.hits;
}

describe("LookaheadAI", () => {
  it("正面から来る弾を避ける", () => {
    const world = new World({ width: 480, height: 640, seed: 1 });
    const ai = aiDefinitions.find((d) => d.id === "lookahead")!.create();
    const { x, y } = world.player;
    world.bullets.add(x, y - 60, 0, 3, { radius: 5, color: 0 });
    for (let i = 0; i < 40; i++) world.step(ai.decide(world));
    expect(world.stats.hits).toBe(0);
  });

  it("デモステージで Idle より被弾が少ない", () => {
    const find = (id: string) => aiDefinitions.find((d) => d.id === id)!;
    const frames = 60 * 40;
    const lookahead = play(find("lookahead").create(), frames, 7);
    const idle = play(find("idle").create(), frames, 7);
    console.log(`hits in ${frames} frames: lookahead=${lookahead}, idle=${idle}`);
    expect(lookahead).toBeLessThan(idle);
  });
});

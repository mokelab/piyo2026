import { describe, expect, it } from "vitest";
import { BulletPool } from "./bullets";
import type { Pattern } from "./pattern";
import { demoStage, demoStageFrom } from "./patterns/basic";
import { World } from "./world";

const style = { radius: 4, color: 0xffffff };

describe("BulletPool", () => {
  it("画面外に出た弾を消し、生存弾を先頭に詰める", () => {
    const pool = new BulletPool(8);
    pool.add(10, 10, -20, 0, style); // 外に出る
    pool.add(50, 50, 1, 0, style);
    pool.step(100, 100, 5);
    expect(pool.count).toBe(1);
    expect(pool.x[0]).toBe(51);
  });

  it("容量を超えたら追加しない", () => {
    const pool = new BulletPool(1);
    expect(pool.add(0, 0, 0, 0, style)).toBe(true);
    expect(pool.add(0, 0, 0, 0, style)).toBe(false);
  });
});

describe("World", () => {
  it("yield n で n フレーム待つ", () => {
    const world = new World({ width: 100, height: 100, seed: 1 });
    const fired: number[] = [];
    const pattern: Pattern = function* (ctx) {
      fired.push(ctx.frame());
      yield 3;
      fired.push(ctx.frame());
    };
    world.spawn(pattern);
    for (let i = 0; i < 5; i++) world.step({ dx: 0, dy: 0 });
    expect(fired).toEqual([0, 3]);
  });

  it("同じシードなら同じ結果になる", () => {
    const run = () => {
      const world = new World({ width: 480, height: 640, seed: 42 });
      world.spawn(demoStage);
      for (let i = 0; i < 2000; i++) world.step({ dx: Math.sin(i * 0.1), dy: 0 });
      return [world.bullets.count, world.player.x, world.stats.hits, world.bullets.x[0]];
    };
    expect(run()).toEqual(run());
  });

  it("alive を false にした敵は次のフレームで消える", () => {
    const world = new World({ width: 100, height: 100, seed: 1 });
    const pattern: Pattern = function* (ctx) {
      const enemy = ctx.spawnEnemy(10, 20);
      yield 2;
      enemy.alive = false;
    };
    world.spawn(pattern);
    world.step({ dx: 0, dy: 0 });
    expect(world.enemies).toEqual([{ x: 10, y: 20, alive: true }]);
    world.step({ dx: 0, dy: 0 });
    world.step({ dx: 0, dy: 0 });
    expect(world.enemies).toEqual([]);
  });

  it("demoStageFrom で指定したパターンから始まる", () => {
    const world = new World({ width: 480, height: 640, seed: 1 });
    world.spawn(demoStageFrom("sideSpiralEnemies"));
    // spawn したサブパターンは次のフレームから動く
    world.step({ dx: 0, dy: 0 });
    world.step({ dx: 0, dy: 0 });
    expect(world.enemies.length).toBe(2);
  });

  it("移動指示は長さ 1 に正規化される", () => {
    const world = new World({ width: 480, height: 640, seed: 1, playerSpeed: 3 });
    const { x, y } = world.player;
    world.step({ dx: 10, dy: 10 });
    expect(Math.hypot(world.player.x - x, world.player.y - y)).toBeCloseTo(3);
  });
});

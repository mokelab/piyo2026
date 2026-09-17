import { describe, expect, it } from "vitest";
import { BulletPool } from "./bullets";
import type { Pattern } from "./pattern";
import { type BossMotion, bossSway, centerRandomPick, demoStage, demoStageFrom } from "./patterns/basic";
import { World } from "./world";

const style = { radius: 4, color: 0xffffff };

describe("BulletPool", () => {
  it("画面外に出た弾を消し、生存弾を先頭に詰める", () => {
    const pool = new BulletPool(8);
    pool.add(10, 10, -20, 0, style); // 外に出る
    pool.add(50, 50, 1, 0, style);
    pool.step(100, 100, 5, 0, 0);
    expect(pool.count).toBe(1);
    expect(pool.x[0]).toBe(51);
  });

  it("aimAfter フレーム経った弾は速さを保ったまま目標へ向きを変える", () => {
    const pool = new BulletPool(8);
    pool.add(50, 50, 2, 0, style, { aimAfter: 2 });
    pool.step(100, 100, 5, 52, 0);
    expect([pool.vx[0], pool.vy[0]]).toEqual([2, 0]);
    // 2 回目の移動の前に (52, 50) から (52, 0) へ向く
    pool.step(100, 100, 5, 52, 0);
    expect(pool.vx[0]).toBeCloseTo(0);
    expect(pool.vy[0]).toBeCloseTo(-2);
    expect(pool.y[0]).toBeCloseTo(48);
  });

  it("burst.after フレーム経った弾は消え、進行方向を基準に子弾をばらまく", () => {
    const pool = new BulletPool(8);
    const childStyle = { radius: 2, color: 0x123456 };
    pool.add(50, 50, 0, 2, style, { burst: { after: 2, count: 4, speed: 1, style: childStyle } });
    pool.step(100, 100, 5, 0, 0);
    expect(pool.count).toBe(1);
    // 2 回目の step で (50, 52) で破裂し、子弾はこのフレームでは動かない
    pool.step(100, 100, 5, 0, 0);
    expect(pool.count).toBe(4);
    expect(pool.x[0]).toBeCloseTo(50);
    expect(pool.y[0]).toBeCloseTo(52);
    expect(pool.vx[0]).toBeCloseTo(0);
    expect(pool.vy[0]).toBeCloseTo(1);
    expect(pool.radius[0]).toBe(2);
    // 子弾は破裂しない
    for (let t = 0; t < 5; t++) pool.step(100, 100, 5, 0, 0);
    expect(pool.count).toBe(4);
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

  it("centerRandomPick はボスを中央へ動かして撃ち、元の y へ戻って揺れを再開する", () => {
    const world = new World({ width: 480, height: 640, seed: 1 });
    const motion: BossMotion = { swaying: true };
    world.spawn(bossSway(motion));
    const shot: Pattern = function* (ctx) {
      ctx.fire(ctx.boss.x, ctx.boss.y, 0, 0, style);
      yield 10;
    };
    world.spawn(centerRandomPick(motion, [shot]));
    // 1 フレーム目は揺れの位置 (240, 128) を記録してから中央へ動き始める
    for (let i = 0; i < 62; i++) world.step({ dx: 0, dy: 0 });
    expect(motion.swaying).toBe(false);
    expect(world.boss).toEqual({ x: 240, y: 320 });
    expect(world.bullets.count).toBe(1);

    // 戻り終わった直後のフレーム。次のフレームから揺れの位置へ補間し始める
    for (let i = 0; i < 69; i++) world.step({ dx: 0, dy: 0 });
    expect(motion.swaying).toBe(true);
    expect(world.boss.y).toBeCloseTo(128);
  });

  it("移動指示は長さ 1 に正規化される", () => {
    const world = new World({ width: 480, height: 640, seed: 1, playerSpeed: 3 });
    const { x, y } = world.player;
    world.step({ dx: 10, dy: 10 });
    expect(Math.hypot(world.player.x - x, world.player.y - y)).toBeCloseTo(3);
  });
});

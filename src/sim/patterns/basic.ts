import type { Pattern } from "../pattern";

const TAU = Math.PI * 2;

/** ボスをゆっくり左右に揺らし続ける */
export const bossSway: Pattern = function* (ctx) {
  const cx = ctx.width / 2;
  const cy = ctx.height * 0.2;
  for (;;) {
    const f = ctx.frame();
    ctx.boss.x = cx + Math.sin(f * 0.008) * ctx.width * 0.15;
    ctx.boss.y = cy + Math.sin(f * 0.013) * 12;
    yield 1;
  }
};

/** 回転しながら複数の腕で撃ち続ける渦巻き */
export const spiral = (frames: number, arms = 5): Pattern =>
  function* (ctx) {
    for (let f = 0; f < frames; f += 3) {
      const base = f * 0.037;
      for (let a = 0; a < arms; a++) {
        const angle = base + (a / arms) * TAU;
        ctx.fire(ctx.boss.x, ctx.boss.y, angle, 2.2, { radius: 4, color: 0x66ccff });
        ctx.fire(ctx.boss.x, ctx.boss.y, -angle * 1.3, 1.6, { radius: 3, color: 0xcc88ff });
      }
      yield 3;
    }
  };

/** 自機狙いの扇状弾を連射 */
export const aimedFan = (frames: number): Pattern =>
  function* (ctx) {
    for (let f = 0; f < frames; f += 40) {
      const aim = Math.atan2(ctx.playerY() - ctx.boss.y, ctx.playerX() - ctx.boss.x);
      for (let burst = 0; burst < 5; burst++) {
        for (let i = -3; i <= 3; i++) {
          ctx.fire(ctx.boss.x, ctx.boss.y, aim + i * 0.16, 3.2 + burst * 0.25, { radius: 5, color: 0xff6688 });
        }
        yield 4;
      }
      yield 20;
    }
  };

/** ボスの周囲の位置をずらしながら全方位のリングを撃つ */
export const flowerRings = (frames: number): Pattern =>
  function* (ctx) {
    for (let f = 0; f < frames; f += 24) {
      const cx = ctx.boss.x + ctx.rng.range(-100, 100);
      const cy = ctx.boss.y + ctx.rng.range(-40, 60);
      const offset = ctx.rng.next() * TAU;
      const n = 36;
      for (let i = 0; i < n; i++) {
        ctx.fire(cx, cy, offset + (i / n) * TAU, 1.8, { radius: 4, color: 0xffcc55 });
      }
      yield 24;
    }
  };

/** 上から降るばらまき弾 */
export const rain = (frames: number): Pattern =>
  function* (ctx) {
    for (let f = 0; f < frames; f += 2) {
      const x = ctx.rng.range(0, ctx.width);
      const angle = Math.PI / 2 + ctx.rng.range(-0.25, 0.25);
      ctx.fire(x, -8, angle, ctx.rng.range(1.5, 3), { radius: 3, color: 0x88ffaa });
      yield 2;
    }
  };

/** 複数パターンを同時に走らせる */
export const together = (...patterns: Pattern[]): Pattern =>
  function* (ctx) {
    for (const p of patterns.slice(1)) ctx.spawn(p);
    yield* patterns[0](ctx);
  };

/** サンプルステージ: ボスを揺らしつつ、パターンを順番に無限ループ */
export const demoStage: Pattern = function* (ctx) {
  ctx.spawn(bossSway);
  for (;;) {
    yield* spiral(600)(ctx);
    yield 60;
    yield* aimedFan(480)(ctx);
    yield 60;
    yield* flowerRings(600)(ctx);
    yield 60;
    yield* together(spiral(600, 3), rain(600))(ctx);
    yield 90;
  }
};

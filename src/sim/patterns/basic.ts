import type { Pattern } from "../pattern";

const TAU = Math.PI * 2;

/** 回転しながら複数の腕で撃ち続ける渦巻き */
export const spiral = (frames: number, arms = 5): Pattern =>
  function* (ctx) {
    const cx = ctx.width / 2;
    const cy = ctx.height * 0.22;
    for (let f = 0; f < frames; f += 3) {
      const base = f * 0.037;
      for (let a = 0; a < arms; a++) {
        const angle = base + (a / arms) * TAU;
        ctx.fire(cx, cy, angle, 2.2, { radius: 4, color: 0x66ccff });
        ctx.fire(cx, cy, -angle * 1.3, 1.6, { radius: 3, color: 0xcc88ff });
      }
      yield 3;
    }
  };

/** 自機狙いの扇状弾を連射 */
export const aimedFan = (frames: number): Pattern =>
  function* (ctx) {
    const cx = ctx.width / 2;
    const cy = ctx.height * 0.2;
    for (let f = 0; f < frames; f += 40) {
      const aim = Math.atan2(ctx.playerY() - cy, ctx.playerX() - cx);
      for (let burst = 0; burst < 5; burst++) {
        for (let i = -3; i <= 3; i++) {
          ctx.fire(cx, cy, aim + i * 0.16, 3.2 + burst * 0.25, { radius: 5, color: 0xff6688 });
        }
        yield 4;
      }
      yield 20;
    }
  };

/** 位置をずらしながら全方位のリングを撃つ */
export const flowerRings = (frames: number): Pattern =>
  function* (ctx) {
    for (let f = 0; f < frames; f += 24) {
      const cx = ctx.rng.range(ctx.width * 0.2, ctx.width * 0.8);
      const cy = ctx.rng.range(ctx.height * 0.1, ctx.height * 0.3);
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

/** サンプルステージ: パターンを順番に無限ループ */
export const demoStage: Pattern = function* (ctx) {
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

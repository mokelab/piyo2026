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

/** ボスの周囲の位置をずらしながら、速さの違う全方位リングを2重に撃つ */
export const doubleScatteredRings = (frames: number): Pattern =>
  function* (ctx) {
    const n = 30;
    const interval = 32;
    for (let f = 0; f < frames; f += interval) {
      const cx = ctx.boss.x + ctx.rng.range(-100, 100);
      const cy = ctx.boss.y + ctx.rng.range(-40, 60);
      const offset = ctx.rng.next() * TAU;
      for (let i = 0; i < n; i++) {
        const angle = offset + (i / n) * TAU;
        ctx.fire(cx, cy, angle, 2.0, { radius: 4, color: 0xffcc55 });
        // 内側のリングは半コマずらして外側の隙間に置く
        ctx.fire(cx, cy, angle + Math.PI / n, 1.2, { radius: 4, color: 0xff9955 });
      }
      yield interval;
    }
  };

/** ボスから左右に子機を撃ち出し、止まった位置から渦巻きをばらまかせる */
export const sideSpiralEnemies = (frames: number): Pattern =>
  function* (ctx) {
    const interval = 150;
    for (let f = 0; f < frames; f += interval) {
      ctx.spawn(spiralEnemy(-1));
      ctx.spawn(spiralEnemy(1));
      yield interval;
    }
  };

/** 横に飛び出して止まり、渦巻きを撃ってから上へ去る子機。左右で回転の向きが逆になる。 */
const spiralEnemy = (dir: -1 | 1): Pattern =>
  function* (ctx) {
    const enemy = ctx.spawnEnemy(ctx.boss.x, ctx.boss.y);
    const startX = enemy.x;
    const startY = enemy.y;
    const targetX = Math.min(Math.max(startX + dir * 150, 40), ctx.width - 40);
    const targetY = startY + 50;
    const moveFrames = 30;
    for (let t = 1; t <= moveFrames; t++) {
      const k = 1 - (1 - t / moveFrames) ** 3;
      enemy.x = startX + (targetX - startX) * k;
      enemy.y = startY + (targetY - startY) * k;
      yield 1;
    }

    const arms = 4;
    for (let t = 0; t < 120; t += 4) {
      const base = dir * t * 0.05;
      for (let a = 0; a < arms; a++) {
        ctx.fire(enemy.x, enemy.y, base + (a / arms) * TAU, 1.8, { radius: 4, color: 0xff88cc });
      }
      yield 4;
    }

    while (enemy.y > -30) {
      enemy.y -= 3;
      yield 1;
    }
    enemy.alive = false;
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

/** サンプルステージで順番に流すパターン。id は URL の ?pattern= で指定する。 */
const demoSteps: { id: string; pattern: Pattern; rest: number }[] = [
  { id: "spiral", pattern: spiral(600), rest: 60 },
  { id: "aimedFan", pattern: aimedFan(480), rest: 60 },
  { id: "flowerRings", pattern: flowerRings(600), rest: 60 },
  { id: "doubleScatteredRings", pattern: doubleScatteredRings(600), rest: 60 },
  { id: "sideSpiralEnemies", pattern: sideSpiralEnemies(600), rest: 60 },
  { id: "spiralRain", pattern: together(spiral(600, 3), rain(600)), rest: 90 },
];

export const demoPatternIds: readonly string[] = demoSteps.map((step) => step.id);

/**
 * サンプルステージ: ボスを揺らしつつ、パターンを順番に無限ループ。
 * startId を渡すとそのパターンから始める（見つからなければ先頭から）。
 */
export const demoStageFrom = (startId?: string | null): Pattern =>
  function* (ctx) {
    ctx.spawn(bossSway);
    let i = Math.max(0, demoSteps.findIndex((step) => step.id === startId));
    for (;;) {
      const step = demoSteps[i];
      yield* step.pattern(ctx);
      yield step.rest;
      i = (i + 1) % demoSteps.length;
    }
  };

export const demoStage: Pattern = demoStageFrom();

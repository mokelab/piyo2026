import type { Pattern, PatternContext } from "../pattern";

const TAU = Math.PI * 2;

/** ボスの揺れを止めて、パターンからボスを直接動かすための制御 */
export interface BossMotion {
  swaying: boolean;
}

/** swaying が false の間は止まり、再開したら揺れの位置へなめらかに戻る */
const SWAY_BLEND_FRAMES = 60;

/** ボスをゆっくり左右に揺らし続ける */
export const bossSway = (motion: BossMotion = { swaying: true }): Pattern =>
  function* (ctx) {
    const cx = ctx.width / 2;
    const cy = ctx.height * 0.2;
    let blend = 1;
    for (;;) {
      if (!motion.swaying) {
        blend = 0;
        yield 1;
        continue;
      }
      const f = ctx.frame();
      const x = cx + Math.sin(f * 0.008) * ctx.width * 0.15;
      const y = cy + Math.sin(f * 0.013) * 12;
      if (blend < 1) {
        blend = Math.min(1, blend + 1 / SWAY_BLEND_FRAMES);
        ctx.boss.x += (x - ctx.boss.x) * blend;
        ctx.boss.y += (y - ctx.boss.y) * blend;
      } else {
        ctx.boss.x = x;
        ctx.boss.y = y;
      }
      yield 1;
    }
  };

/** ボスを frames フレームかけて (x, y) へ動かす（減速しながら止まる） */
function* moveBoss(ctx: PatternContext, x: number, y: number, frames: number): Generator<number, void, void> {
  const startX = ctx.boss.x;
  const startY = ctx.boss.y;
  for (let t = 1; t <= frames; t++) {
    const k = 1 - (1 - t / frames) ** 3;
    ctx.boss.x = startX + (x - startX) * k;
    ctx.boss.y = startY + (y - startY) * k;
    yield 1;
  }
}

/**
 * ボスの揺れを止めて画面中央へ移動し、candidates からランダムに 1 つ選んで撃つ。
 * 撃ち終わったら元の y 座標へ戻り、揺れを再開する。
 * 候補は固定で渡す（自身や組み合わせを引くと入れ子や弾の量が読めなくなるため）。
 */
export const centerRandomPick = (motion: BossMotion, candidates: readonly Pattern[]): Pattern =>
  function* (ctx) {
    const originalY = ctx.boss.y;
    motion.swaying = false;
    yield* moveBoss(ctx, ctx.width / 2, ctx.height / 2, 60);
    const picked = candidates[Math.floor(ctx.rng.next() * candidates.length)];
    yield* picked(ctx);
    yield* moveBoss(ctx, ctx.boss.x, originalY, 60);
    motion.swaying = true;
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
const demoSteps = (motion: BossMotion): { id: string; pattern: Pattern; rest: number }[] => [
  { id: "spiral", pattern: spiral(600), rest: 60 },
  { id: "aimedFan", pattern: aimedFan(480), rest: 60 },
  { id: "flowerRings", pattern: flowerRings(600), rest: 60 },
  { id: "doubleScatteredRings", pattern: doubleScatteredRings(600), rest: 60 },
  { id: "sideSpiralEnemies", pattern: sideSpiralEnemies(600), rest: 60 },
  { id: "spiralRain", pattern: together(spiral(600, 3), rain(600)), rest: 90 },
  {
    id: "centerRandomPick",
    pattern: centerRandomPick(motion, [
      spiral(600),
      aimedFan(480),
      flowerRings(600),
      doubleScatteredRings(600),
      sideSpiralEnemies(600),
    ]),
    rest: 60,
  },
];

export const demoPatternIds: readonly string[] = demoSteps({ swaying: true }).map((step) => step.id);

/**
 * サンプルステージ: ボスを揺らしつつ、パターンを順番に無限ループ。
 * startId を渡すとそのパターンから始める（見つからなければ先頭から）。
 */
export const demoStageFrom = (startId?: string | null): Pattern =>
  function* (ctx) {
    const motion: BossMotion = { swaying: true };
    ctx.spawn(bossSway(motion));
    const steps = demoSteps(motion);
    let i = Math.max(0, steps.findIndex((step) => step.id === startId));
    for (;;) {
      const step = steps[i];
      yield* step.pattern(ctx);
      yield step.rest;
      i = (i + 1) % steps.length;
    }
  };

export const demoStage: Pattern = demoStageFrom();

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

/**
 * base と、candidates からランダムに 1 つ選んだパターンを同時に撃つ。
 * 選んだ方は並行タスクとして走り、base が終わっても止まらないので、長さは base と揃えておく。
 */
export const togetherRandomPick = (base: Pattern, candidates: readonly Pattern[]): Pattern =>
  function* (ctx) {
    const picked = candidates[Math.floor(ctx.rng.next() * candidates.length)];
    yield* together(base, picked)(ctx);
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

/** flowerRings と同じリングを撃ち、1 秒後に各弾の向きを自機狙いに変える */
export const delayedAimScatteredRings = (frames: number): Pattern =>
  function* (ctx) {
    const n = 36;
    const interval = 24;
    for (let f = 0; f < frames; f += interval) {
      const cx = ctx.boss.x + ctx.rng.range(-100, 100);
      const cy = ctx.boss.y + ctx.rng.range(-40, 60);
      const offset = ctx.rng.next() * TAU;
      for (let i = 0; i < n; i++) {
        ctx.fire(cx, cy, offset + (i / n) * TAU, 1.8, { radius: 4, color: 0xffaa33 }, { aimAfter: 60 });
      }
      yield interval;
    }
  };

/**
 * ボスから少なめの全方位リングを撃ち、各弾が途中で破裂して小さな弾をばらまく。
 * 1 回で 12 × 8 = 96 発になるので、間隔を空けて doubleScatteredRings より少し多い程度の密度に抑える。
 */
export const burstingRings = (frames: number): Pattern =>
  function* (ctx) {
    const n = 12;
    const interval = 50;
    const burst = { after: 45, count: 8, speed: 1.3, style: { radius: 3, color: 0xffee88 } };
    for (let f = 0; f < frames; f += interval) {
      const offset = ctx.rng.next() * TAU;
      for (let i = 0; i < n; i++) {
        ctx.fire(ctx.boss.x, ctx.boss.y, offset + (i / n) * TAU, 2.2, { radius: 6, color: 0xff8844 }, { burst });
      }
      yield interval;
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

/**
 * ボスから全方位リングを撃ち、各弾が左右の壁で 1 回だけ跳ね返る。
 * 跳ね返った弾が後から撃ったリングと交差して網目になり、画面の端に逃げても戻ってくる弾に挟まれる。
 */
export const wallBounceRings = (frames: number): Pattern =>
  function* (ctx) {
    const n = 36;
    const interval = 24;
    for (let f = 0; f < frames; f += interval) {
      const offset = ctx.rng.next() * TAU;
      for (let i = 0; i < n; i++) {
        ctx.fire(ctx.boss.x, ctx.boss.y, offset + (i / n) * TAU, 1.5, { radius: 4, color: 0x66ffdd }, { wallBounces: 1 });
      }
      yield interval;
    }
  };

/**
 * 自機狙いの偶数弾（自機が隙間に来る扇）を密に撃ち続けて横移動を封じつつ、
 * 大きな自機狙い弾を一定間隔で混ぜて、狭い隙間の中で小さく避けさせる。
 */
export const evenFanStreamWithAimedShot = (frames: number): Pattern =>
  function* (ctx) {
    ctx.spawn(aimedBigShots(frames));
    const n = 6;
    const spacing = 0.28;
    const interval = 5;
    for (let f = 0; f < frames; f += interval) {
      const aim = Math.atan2(ctx.playerY() - ctx.boss.y, ctx.playerX() - ctx.boss.x);
      for (let i = 0; i < n; i++) {
        // 偶数弾なので、真ん中の 2 発の間に自機の方向が来る
        const angle = aim + (i - (n - 1) / 2) * spacing;
        ctx.fire(ctx.boss.x, ctx.boss.y, angle, 2.6, { radius: 4, color: 0x77ddff });
      }
      yield interval;
    }
  };

/** 大きな自機狙い弾を 1 秒に 1 発撃ち続ける */
const aimedBigShots = (frames: number): Pattern =>
  function* (ctx) {
    const interval = 60;
    yield 30;
    for (let f = 30; f < frames; f += interval) {
      const aim = Math.atan2(ctx.playerY() - ctx.boss.y, ctx.playerX() - ctx.boss.x);
      ctx.fire(ctx.boss.x, ctx.boss.y, aim, 3.4, { radius: 12, color: 0xff5577 });
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

/** ステージで流すパターン 1 つ分。id は URL の ?pattern= で指定する。 */
interface StageStep {
  id: string;
  pattern: Pattern;
  rest: number;
}

/** 難易度グループ。グループ内のパターンを CLEARS_PER_GROUP 個クリアすると次のグループへ進む。 */
interface DifficultyGroup {
  id: string;
  steps: StageStep[];
}

/** 次のグループへ進むのに必要なクリア数。被弾しても流し切ればクリアとする。 */
export const CLEARS_PER_GROUP = 3;

/** 1 周ごとに弾速の倍率に足す量と、倍率の上限 */
const SPEED_SCALE_PER_LOOP = 0.15;
const MAX_SPEED_SCALE = 1.6;

/** loop 周目（0 始まり）の弾速の倍率 */
export const speedScaleForLoop = (loop: number): number => Math.min(1 + SPEED_SCALE_PER_LOOP * loop, MAX_SPEED_SCALE);

/** 難易度グループ。やさしい順に並べる。id は URL の ?group= で指定する。 */
const difficultyGroups = (motion: BossMotion): DifficultyGroup[] => [
  {
    id: "easy",
    steps: [
      { id: "spiral", pattern: spiral(600), rest: 60 },
      { id: "aimedFan", pattern: aimedFan(480), rest: 60 },
      { id: "flowerRings", pattern: flowerRings(600), rest: 60 },
    ],
  },
  {
    id: "normal",
    steps: [
      { id: "doubleScatteredRings", pattern: doubleScatteredRings(600), rest: 60 },
      { id: "delayedAimScatteredRings", pattern: delayedAimScatteredRings(600), rest: 60 },
      { id: "burstingRings", pattern: burstingRings(600), rest: 60 },
      { id: "sideSpiralEnemies", pattern: sideSpiralEnemies(600), rest: 60 },
      {
        id: "centerRandomPick",
        pattern: centerRandomPick(motion, [
          spiral(600),
          aimedFan(480),
          flowerRings(600),
          doubleScatteredRings(600),
          delayedAimScatteredRings(600),
          burstingRings(600),
          sideSpiralEnemies(600),
          evenFanStreamWithAimedShot(600),
        ]),
        rest: 60,
      },
    ],
  },
  {
    id: "hard",
    steps: [
      { id: "evenFanStreamWithAimedShot", pattern: evenFanStreamWithAimedShot(600), rest: 60 },
      { id: "spiralRain", pattern: together(spiral(600, 3), rain(600)), rest: 90 },
      { id: "wallBounceRings", pattern: wallBounceRings(600), rest: 90 },
      {
        id: "evenFanRandomMix",
        pattern: togetherRandomPick(evenFanStreamWithAimedShot(600), [
          spiral(600, 3),
          flowerRings(600),
          burstingRings(600),
          sideSpiralEnemies(600),
          rain(600),
        ]),
        rest: 90,
      },
    ],
  },
];

const groupsForIds = difficultyGroups({ swaying: true });
export const difficultyGroupIds: readonly string[] = groupsForIds.map((group) => group.id);
export const demoPatternIds: readonly string[] = groupsForIds.flatMap((group) => group.steps.map((step) => step.id));

/** ステージの進み具合。ステージが書き換え、HUD などから読む。 */
export interface StageProgress {
  /** 何周目か（0 始まり） */
  loop: number;
  /** 今の周の弾速の倍率 */
  speedScale: number;
  /** 今のグループの id */
  groupId: string;
  /** 今のグループで何個目のパターンか（0 始まり） */
  index: number;
  /** 今のグループで撃つパターンの数 */
  total: number;
  /** 今撃っているパターンの id */
  patternId: string;
}

export interface StageStart {
  /** この周（0 始まり）から始める */
  loop?: number | null;
  /** このグループから始める */
  group?: string | null;
  /** このパターンを含むグループから、このパターンを最初に撃って始める。group より優先する。 */
  pattern?: string | null;
}

/** steps から count 個を重複なしで選ぶ。first を渡すとそれを先頭にする。 */
function pickSteps(ctx: PatternContext, steps: readonly StageStep[], count: number, first?: StageStep): StageStep[] {
  const rest = steps.filter((step) => step !== first);
  // Fisher–Yates（シード再現のため ctx.rng を使う）
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(ctx.rng.next() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  const picked = first ? [first, ...rest] : rest;
  return picked.slice(0, Math.min(count, steps.length));
}

/**
 * サンプルステージ: ボスを揺らしつつ、難易度グループを順に進む。
 * 各グループからパターンを重複なしで CLEARS_PER_GROUP 個選んで撃ち、最後のグループの後は次の周として最初に戻る。
 * 周を重ねるごとに弾速を上げる（speedScaleForLoop）。
 */
export const demoStageFrom = (start: StageStart = {}, progress?: StageProgress): Pattern =>
  function* (ctx) {
    const motion: BossMotion = { swaying: true };
    ctx.spawn(bossSway(motion));
    const groups = difficultyGroups(motion);

    let first: StageStep | undefined;
    let g = Math.max(0, groups.findIndex((group) => group.id === start.group));
    if (start.pattern != null) {
      const found = groups.findIndex((group) => group.steps.some((step) => step.id === start.pattern));
      if (found >= 0) {
        g = found;
        first = groups[found].steps.find((step) => step.id === start.pattern);
      }
    }

    for (let loop = Math.max(0, Math.floor(start.loop ?? 0)); ; loop++) {
      const speedScale = speedScaleForLoop(loop);
      ctx.bulletSpeedScale = speedScale;
      for (; g < groups.length; g++) {
        const group = groups[g];
        const picked = pickSteps(ctx, group.steps, CLEARS_PER_GROUP, first);
        first = undefined;
        for (let i = 0; i < picked.length; i++) {
          if (progress) {
            Object.assign(progress, { loop, speedScale, groupId: group.id, index: i, total: picked.length, patternId: picked[i].id });
          }
          yield* picked[i].pattern(ctx);
          yield picked[i].rest;
        }
      }
      g = 0;
    }
  };

export const demoStage: Pattern = demoStageFrom();

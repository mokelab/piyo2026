import { BulletPool, type BulletsView } from "./bullets";
import { PatternRunner, type EnemyHandle, type Pattern, type PatternContext } from "./pattern";
import { Rng } from "./rng";

export interface PlayerView {
  readonly x: number;
  readonly y: number;
  /** 当たり判定の半径 */
  readonly radius: number;
  /** 1 フレームに動ける最大距離 */
  readonly speed: number;
}

export interface BossView {
  readonly x: number;
  readonly y: number;
}

export interface EnemyView {
  readonly x: number;
  readonly y: number;
}

/** AI と描画に公開する、読み取り専用のワールド状態。 */
export interface WorldView {
  readonly width: number;
  readonly height: number;
  readonly frame: number;
  readonly player: PlayerView;
  readonly boss: BossView;
  readonly enemies: readonly EnemyView[];
  readonly bullets: BulletsView;
  readonly stats: Readonly<WorldStats>;
}

/** 自機の移動指示。dx, dy は [-1, 1] で、長さ 1 を超える分は正規化される。 */
export interface MoveIntent {
  dx: number;
  dy: number;
}

export interface WorldOptions {
  width: number;
  height: number;
  seed: number;
  bulletCapacity?: number;
  playerRadius?: number;
  playerSpeed?: number;
  /** 残機。この回数被弾すると GAME OVER になる。省略時は無制限 */
  lives?: number;
}

export interface WorldStats {
  hits: number;
  /** 被弾後の無敵残りフレーム */
  invincible: number;
  /** 最初の残機 */
  maxLives: number;
  /** 残機。0 になると GAME OVER で、以降 step しても何も進まない */
  lives: number;
}

const OFFSCREEN_MARGIN = 32;
const INVINCIBLE_FRAMES = 60;

export class World implements WorldView {
  readonly width: number;
  readonly height: number;
  readonly rng: Rng;
  readonly bullets: BulletPool;
  readonly player: { x: number; y: number; radius: number; speed: number };
  readonly boss: { x: number; y: number };
  readonly enemies: EnemyHandle[] = [];
  readonly stats: WorldStats;
  frame = 0;

  private readonly runner: PatternRunner;

  constructor(options: WorldOptions) {
    this.width = options.width;
    this.height = options.height;
    this.rng = new Rng(options.seed);
    const lives = options.lives ?? Infinity;
    this.stats = { hits: 0, invincible: 0, maxLives: lives, lives };
    this.bullets = new BulletPool(options.bulletCapacity ?? 20000);
    this.player = {
      x: options.width / 2,
      y: options.height * 0.85,
      radius: options.playerRadius ?? 3,
      speed: options.playerSpeed ?? 3,
    };
    this.boss = { x: options.width / 2, y: options.height * 0.2 };

    const ctx: PatternContext = {
      width: this.width,
      height: this.height,
      rng: this.rng,
      frame: () => this.frame,
      playerX: () => this.player.x,
      playerY: () => this.player.y,
      boss: this.boss,
      bulletSpeedScale: 1,
      fire: (x, y, angle, speed, style, behavior) => {
        const scale = ctx.bulletSpeedScale;
        if (scale !== 1 && behavior?.burst) {
          behavior = { ...behavior, burst: { ...behavior.burst, speed: behavior.burst.speed * scale } };
        }
        const v = speed * scale;
        this.bullets.add(x, y, Math.cos(angle) * v, Math.sin(angle) * v, style, behavior);
      },
      spawnEnemy: (x, y) => {
        const enemy = { x, y, alive: true };
        this.enemies.push(enemy);
        return enemy;
      },
      spawn: (pattern) => this.runner.spawn(pattern),
    };
    this.runner = new PatternRunner(ctx);
  }

  spawn(pattern: Pattern): void {
    this.runner.spawn(pattern);
  }

  get gameOver(): boolean {
    return this.stats.lives <= 0;
  }

  /** 1 フレーム進める。順序: パターン発射 → 敵の片付け → 弾移動 → 自機移動 → 当たり判定。GAME OVER 後は何もしない */
  step(intent: MoveIntent): void {
    if (this.gameOver) return;
    this.runner.step();
    this.removeDeadEnemies();
    this.bullets.step(this.width, this.height, OFFSCREEN_MARGIN, this.player.x, this.player.y);
    this.movePlayer(intent);
    this.checkHit();
    this.frame++;
  }

  private removeDeadEnemies(): void {
    let alive = 0;
    for (const enemy of this.enemies) {
      if (enemy.alive) this.enemies[alive++] = enemy;
    }
    this.enemies.length = alive;
  }

  private movePlayer(intent: MoveIntent): void {
    let { dx, dy } = intent;
    if (!Number.isFinite(dx) || !Number.isFinite(dy)) return;
    const len = Math.hypot(dx, dy);
    if (len > 1) {
      dx /= len;
      dy /= len;
    }
    const p = this.player;
    p.x = clamp(p.x + dx * p.speed, 0, this.width);
    p.y = clamp(p.y + dy * p.speed, 0, this.height);
  }

  private checkHit(): void {
    if (this.stats.invincible > 0) {
      this.stats.invincible--;
      return;
    }
    const { x, y, radius, count } = this.bullets;
    const p = this.player;
    for (let i = 0; i < count; i++) {
      const r = radius[i] + p.radius;
      const ddx = x[i] - p.x;
      const ddy = y[i] - p.y;
      if (ddx * ddx + ddy * ddy < r * r) {
        this.stats.hits++;
        this.stats.lives--;
        this.stats.invincible = INVINCIBLE_FRAMES;
        return;
      }
    }
  }
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

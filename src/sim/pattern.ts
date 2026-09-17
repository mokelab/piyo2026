import type { BulletStyle } from "./bullets";
import type { Rng } from "./rng";

/**
 * 弾幕パターン。ジェネレータとして書き、`yield n` で n フレーム待つ。
 *
 * @example
 * const ring: Pattern = function* (ctx) {
 *   for (;;) {
 *     for (let i = 0; i < 24; i++) ctx.fire(240, 160, (i / 24) * Math.PI * 2, 2, style);
 *     yield 30;
 *   }
 * };
 */
export type Pattern = (ctx: PatternContext) => Generator<number, void, void>;

export interface PatternContext {
  readonly width: number;
  readonly height: number;
  readonly rng: Rng;
  /** 現在のフレーム番号 */
  frame(): number;
  /** 自機の現在位置（自機狙い弾用） */
  playerX(): number;
  playerY(): number;
  /** ボスの位置。パターンから書き換えてボスを動かせる。 */
  readonly boss: { x: number; y: number };
  /** 角度（ラジアン、0 = 右、π/2 = 下）と速さ（px/frame）で弾を撃つ */
  fire(x: number, y: number, angle: number, speed: number, style: BulletStyle): void;
  /** 並行して動くサブパターンを起動する */
  spawn(pattern: Pattern): void;
}

interface Task {
  gen: Generator<number, void, void>;
  wait: number;
}

/** パターン（ジェネレータ）群を 1 フレームずつ進めるスケジューラ。 */
export class PatternRunner {
  private tasks: Task[] = [];
  private pending: Task[] = [];

  constructor(private readonly ctx: PatternContext) {}

  spawn(pattern: Pattern): void {
    this.pending.push({ gen: pattern(this.ctx), wait: 0 });
  }

  step(): void {
    if (this.pending.length > 0) {
      this.tasks.push(...this.pending);
      this.pending.length = 0;
    }
    let alive = 0;
    for (const task of this.tasks) {
      if (task.wait > 0) task.wait--;
      if (task.wait <= 0) {
        const r = task.gen.next();
        if (r.done) continue;
        task.wait = Math.max(1, Math.floor(r.value));
      }
      this.tasks[alive++] = task;
    }
    this.tasks.length = alive;
  }

  clear(): void {
    this.tasks.length = 0;
    this.pending.length = 0;
  }

  get taskCount(): number {
    return this.tasks.length + this.pending.length;
  }
}

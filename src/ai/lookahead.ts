import type { MoveIntent, WorldView } from "../sim/world";
import type { DodgeAI, DodgeAIDefinition } from "./types";

export interface LookaheadOptions {
  /** 移動候補の方向数（これに「静止」が加わる） */
  directions: number;
  /** 何フレーム先まで読むか */
  horizon: number;
  /** 弾との隙間がこの距離を下回ったら危険度を加算する */
  safetyMargin: number;
  /** 未来の危険ほど軽く見る減衰率（1 フレームごとに掛ける） */
  decay: number;
  /** 定位置（画面下部中央）に戻ろうとする強さ */
  homeWeight: number;
  /** 前フレームと同じ方向を選び続けるボーナス（ブレ防止） */
  inertiaBonus: number;
}

const DEFAULT_OPTIONS: LookaheadOptions = {
  directions: 16,
  horizon: 24,
  safetyMargin: 12,
  decay: 0.93,
  homeWeight: 0.002,
  inertiaBonus: 0.05,
};

const COLLISION_PENALTY = 100;

/**
 * 候補方向ごとに「その方向へ等速で動き続けた場合」を horizon フレーム先までシミュレートし、
 * 弾との近さ・衝突・定位置からのずれで評価して最良の方向を選ぶ AI。
 * 弾は等速直線運動すると仮定して外挿する。
 */
export class LookaheadAI implements DodgeAI {
  private readonly options: LookaheadOptions;
  private readonly candidates: MoveIntent[];
  private nearby = new Int32Array(1024);
  private previous = 0;

  constructor(options: Partial<LookaheadOptions> = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.candidates = [{ dx: 0, dy: 0 }];
    for (let i = 0; i < this.options.directions; i++) {
      const a = (i / this.options.directions) * Math.PI * 2;
      this.candidates.push({ dx: Math.cos(a), dy: Math.sin(a) });
    }
  }

  reset(): void {
    this.previous = 0;
  }

  decide(world: WorldView): MoveIntent {
    const nearbyCount = this.collectNearby(world);
    let best = 0;
    let bestCost = Infinity;
    for (let c = 0; c < this.candidates.length; c++) {
      let cost = this.evaluate(world, this.candidates[c], nearbyCount);
      if (c === this.previous) cost -= this.options.inertiaBonus;
      if (cost < bestCost) {
        bestCost = cost;
        best = c;
      }
    }
    this.previous = best;
    return this.candidates[best];
  }

  /** horizon 内に自機へ届きうる弾だけを抜き出す */
  private collectNearby(world: WorldView): number {
    const { bullets, player } = world;
    const { horizon, safetyMargin } = this.options;
    if (this.nearby.length < bullets.count) {
      this.nearby = new Int32Array(bullets.count * 2);
    }
    let n = 0;
    for (let i = 0; i < bullets.count; i++) {
      const bulletSpeed = Math.hypot(bullets.vx[i], bullets.vy[i]);
      const reach = horizon * (player.speed + bulletSpeed) + bullets.radius[i] + player.radius + safetyMargin;
      const dx = bullets.x[i] - player.x;
      const dy = bullets.y[i] - player.y;
      if (dx * dx + dy * dy < reach * reach) this.nearby[n++] = i;
    }
    return n;
  }

  private evaluate(world: WorldView, move: MoveIntent, nearbyCount: number): number {
    const { bullets, player, width, height } = world;
    const { horizon, safetyMargin, decay, homeWeight } = this.options;
    let cost = 0;
    let weight = 1;
    let px = player.x;
    let py = player.y;
    for (let t = 1; t <= horizon; t++) {
      px = clamp(px + move.dx * player.speed, 0, width);
      py = clamp(py + move.dy * player.speed, 0, height);
      for (let k = 0; k < nearbyCount; k++) {
        const i = this.nearby[k];
        const bx = bullets.x[i] + bullets.vx[i] * t;
        const by = bullets.y[i] + bullets.vy[i] * t;
        const gap = Math.hypot(bx - px, by - py) - bullets.radius[i] - player.radius;
        if (gap < 0) {
          cost += COLLISION_PENALTY * weight;
        } else if (gap < safetyMargin) {
          const d = (safetyMargin - gap) / safetyMargin;
          cost += d * d * weight;
        }
      }
      weight *= decay;
    }
    // 定位置への引力と、壁際に追い詰められることへのペナルティ
    const hx = px - width / 2;
    const hy = py - height * 0.8;
    cost += (hx * hx + hy * hy) * homeWeight * 0.01;
    cost += wallPenalty(px, width) + wallPenalty(py, height);
    return cost;
  }
}

function wallPenalty(v: number, size: number): number {
  const edge = 24;
  const d = Math.min(v, size - v);
  return d < edge ? ((edge - d) / edge) * 0.5 : 0;
}

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

export const lookaheadAI: DodgeAIDefinition = {
  id: "lookahead",
  label: "Lookahead（候補方向の先読み）",
  create: () => new LookaheadAI(),
};

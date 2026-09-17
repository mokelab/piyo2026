/** 読み取り専用で公開する弾の状態。AI や描画はこれだけを見る。 */
export interface BulletsView {
  readonly count: number;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly radius: Float32Array;
  readonly color: Uint32Array;
}

export interface BulletStyle {
  radius: number;
  color: number;
}

/** 撃った後の弾の動き */
export interface BulletBehavior {
  /** このフレーム数が経ったら、速さはそのままで自機の方へ向きを変える */
  aimAfter?: number;
}

/**
 * 弾を Structure of Arrays で保持するプール。
 * 生存中の弾は常に [0, count) に詰めて並べる（削除は末尾と入れ替え）。
 */
export class BulletPool implements BulletsView {
  count = 0;
  readonly x: Float32Array;
  readonly y: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly radius: Float32Array;
  readonly color: Uint32Array;
  /** 自機へ向きを変えるまでの残りフレーム（0 = 向きを変えない） */
  readonly aimDelay: Int32Array;

  constructor(readonly capacity: number) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.color = new Uint32Array(capacity);
    this.aimDelay = new Int32Array(capacity);
  }

  /** 弾を追加する。容量いっぱいなら追加せず false を返す。 */
  add(x: number, y: number, vx: number, vy: number, style: BulletStyle, behavior?: BulletBehavior): boolean {
    if (this.count >= this.capacity) return false;
    const i = this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.radius[i] = style.radius;
    this.color[i] = style.color;
    this.aimDelay[i] = Math.max(0, Math.floor(behavior?.aimAfter ?? 0));
    return true;
  }

  /**
   * 全弾を 1 フレーム進め、[-margin, width+margin] x [-margin, height+margin] の外に出た弾を消す。
   * 向きを変える時が来た弾は、移動の前に (targetX, targetY) へ向ける。
   */
  step(width: number, height: number, margin: number, targetX: number, targetY: number): void {
    const { x, y, vx, vy, aimDelay } = this;
    let i = 0;
    while (i < this.count) {
      if (aimDelay[i] > 0 && --aimDelay[i] === 0) {
        const speed = Math.hypot(vx[i], vy[i]);
        const angle = Math.atan2(targetY - y[i], targetX - x[i]);
        vx[i] = Math.cos(angle) * speed;
        vy[i] = Math.sin(angle) * speed;
      }
      const nx = x[i] + vx[i];
      const ny = y[i] + vy[i];
      if (nx < -margin || nx > width + margin || ny < -margin || ny > height + margin) {
        this.removeAt(i);
        continue;
      }
      x[i] = nx;
      y[i] = ny;
      i++;
    }
  }

  clear(): void {
    this.count = 0;
  }

  private removeAt(i: number): void {
    const last = --this.count;
    this.x[i] = this.x[last];
    this.y[i] = this.y[last];
    this.vx[i] = this.vx[last];
    this.vy[i] = this.vy[last];
    this.radius[i] = this.radius[last];
    this.color[i] = this.color[last];
    this.aimDelay[i] = this.aimDelay[last];
  }
}

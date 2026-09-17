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
  /** 一定フレーム後に消えて、その位置から小さな弾をばらまく */
  burst?: BulletBurst;
}

/** 破裂の設定。子弾は親弾の進行方向を基準に全方位へ等間隔に撃つ（子弾自身は破裂しない）。 */
export interface BulletBurst {
  /** 撃ってから破裂するまでのフレーム数 */
  after: number;
  /** 子弾の数 */
  count: number;
  /** 子弾の速さ（px/frame） */
  speed: number;
  style: BulletStyle;
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
  /** 破裂までの残りフレーム（0 = 破裂しない） */
  readonly burstDelay: Int32Array;
  private readonly burstSpec: (BulletBurst | undefined)[];
  /** step 中に破裂した弾。子弾はループの後でまとめて追加する */
  private readonly pendingBursts: { x: number; y: number; angle: number; spec: BulletBurst }[] = [];

  constructor(readonly capacity: number) {
    this.x = new Float32Array(capacity);
    this.y = new Float32Array(capacity);
    this.vx = new Float32Array(capacity);
    this.vy = new Float32Array(capacity);
    this.radius = new Float32Array(capacity);
    this.color = new Uint32Array(capacity);
    this.aimDelay = new Int32Array(capacity);
    this.burstDelay = new Int32Array(capacity);
    this.burstSpec = new Array(capacity);
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
    this.burstDelay[i] = Math.max(0, Math.floor(behavior?.burst?.after ?? 0));
    this.burstSpec[i] = behavior?.burst;
    return true;
  }

  /**
   * 全弾を 1 フレーム進め、[-margin, width+margin] x [-margin, height+margin] の外に出た弾を消す。
   * 向きを変える時が来た弾は、移動の前に (targetX, targetY) へ向ける。
   * 破裂する時が来た弾は消え、子弾は次のフレームから動き出す。
   */
  step(width: number, height: number, margin: number, targetX: number, targetY: number): void {
    const { x, y, vx, vy, aimDelay, burstDelay } = this;
    let i = 0;
    while (i < this.count) {
      if (burstDelay[i] > 0 && --burstDelay[i] === 0) {
        const spec = this.burstSpec[i];
        if (spec) this.pendingBursts.push({ x: x[i], y: y[i], angle: Math.atan2(vy[i], vx[i]), spec });
        this.removeAt(i);
        continue;
      }
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
    this.releaseBursts();
  }

  private releaseBursts(): void {
    for (const { x, y, angle, spec } of this.pendingBursts) {
      for (let k = 0; k < spec.count; k++) {
        const a = angle + (k / spec.count) * Math.PI * 2;
        this.add(x, y, Math.cos(a) * spec.speed, Math.sin(a) * spec.speed, spec.style);
      }
    }
    this.pendingBursts.length = 0;
  }

  clear(): void {
    this.count = 0;
    this.pendingBursts.length = 0;
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
    this.burstDelay[i] = this.burstDelay[last];
    this.burstSpec[i] = this.burstSpec[last];
    this.burstSpec[last] = undefined;
  }
}

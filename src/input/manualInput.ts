import type { MoveIntent, WorldView } from "../sim/world";

/** キーボードで Shift を押している間の速さの倍率（精密に避ける低速移動） */
const SLOW_SCALE = 0.4;

/**
 * 手動操作の入力状態。タッチドラッグとキーボードの両方から書き込まれ、手動操作 AI が毎フレーム読む。
 * DOM には依存しない（イベントの取り付けは `touchDrag.ts` が行う）。
 */
export class ManualInput {
  /** ドラッグで指が動いたが、自機がまだ動いていない分（論理座標） */
  private pendingX = 0;
  private pendingY = 0;
  private readonly keys = new Set<string>();

  /** 指が動いた分（論理座標）を足す。自機は速さの上限内でこの分だけ後から追いかける */
  drag(dx: number, dy: number): void {
    this.pendingX += dx;
    this.pendingY += dy;
  }

  keyDown(code: string): void {
    this.keys.add(code);
  }

  keyUp(code: string): void {
    this.keys.delete(code);
  }

  /** 押しっぱなしのキーや、動き残りのドラッグを捨てる（フォーカスが外れたときなど） */
  clear(): void {
    this.keys.clear();
    this.pendingX = 0;
    this.pendingY = 0;
  }

  /** 現在の移動指示。ドラッグの動き残りがあればそちらを優先する */
  intent(world: WorldView): MoveIntent {
    const p = world.player;
    // 画面外へ向かう分は自機が動けないので、目標が画面内に収まるように切り詰める
    this.pendingX = clamp(p.x + this.pendingX, 0, world.width) - p.x;
    this.pendingY = clamp(p.y + this.pendingY, 0, world.height) - p.y;
    if (this.pendingX !== 0 || this.pendingY !== 0) {
      const dist = Math.hypot(this.pendingX, this.pendingY);
      const move = Math.min(dist, p.speed);
      const dx = (this.pendingX / dist) * move;
      const dy = (this.pendingY / dist) * move;
      this.pendingX -= dx;
      this.pendingY -= dy;
      // 浮動小数の端数でいつまでも止まらないのを防ぐ
      if (Math.abs(this.pendingX) < 1e-6) this.pendingX = 0;
      if (Math.abs(this.pendingY) < 1e-6) this.pendingY = 0;
      return { dx: dx / p.speed, dy: dy / p.speed };
    }

    const k = this.keys;
    let dx = 0;
    let dy = 0;
    if (k.has("ArrowLeft") || k.has("KeyA")) dx -= 1;
    if (k.has("ArrowRight") || k.has("KeyD")) dx += 1;
    if (k.has("ArrowUp") || k.has("KeyW")) dy -= 1;
    if (k.has("ArrowDown") || k.has("KeyS")) dy += 1;
    const len = Math.hypot(dx, dy);
    if (len === 0) return { dx: 0, dy: 0 };
    const scale = (k.has("ShiftLeft") || k.has("ShiftRight") ? SLOW_SCALE : 1) / len;
    return { dx: dx * scale, dy: dy * scale };
  }
}

/** 手動操作 AI とタッチドラッグが共有する入力状態 */
export const manualInput = new ManualInput();

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

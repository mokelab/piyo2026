import type { ManualInput } from "./manualInput";

/** 指の移動量に掛ける倍率。1 なら指と同じだけ自機が動く */
const DRAG_SENSITIVITY = 1;

/**
 * 画面のどこをドラッグしても、指が動いた分だけ自機を動かす相対ドラッグ操作。
 * 指で自機が隠れないように、自機から離れた場所（画面下の方など）を触って動かせる。
 * `enabled` が false の間はタッチを受け付けない。
 */
export class TouchDrag {
  private pointerId: number | null = null;
  private lastX = 0;
  private lastY = 0;

  /**
   * @param logicalWidth 論理解像度の幅。画面 px を論理座標に換算するのに使う
   */
  constructor(
    private readonly el: HTMLElement,
    private readonly input: ManualInput,
    private readonly logicalWidth: number,
  ) {
    el.addEventListener("pointerdown", (e) => this.onDown(e));
    el.addEventListener("pointermove", (e) => this.onMove(e));
    el.addEventListener("pointerup", (e) => this.onUp(e));
    el.addEventListener("pointercancel", (e) => this.onUp(e));
    // 長押しでメニューが出てドラッグが途切れないようにする
    el.addEventListener("contextmenu", (e) => e.preventDefault());
  }

  set enabled(value: boolean) {
    this.el.hidden = !value;
    if (!value) this.pointerId = null;
  }

  private onDown(e: PointerEvent): void {
    if (this.pointerId !== null) return;
    e.preventDefault();
    this.pointerId = e.pointerId;
    this.el.setPointerCapture(e.pointerId);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  private onMove(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    const scale = (this.logicalWidth / this.el.getBoundingClientRect().width) * DRAG_SENSITIVITY;
    this.input.drag((e.clientX - this.lastX) * scale, (e.clientY - this.lastY) * scale);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  }

  private onUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
  }
}

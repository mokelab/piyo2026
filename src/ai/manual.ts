import { manualInput } from "../input/manualInput";
import type { DodgeAIDefinition } from "./types";

/**
 * 人が操作する「AI」。タッチのドラッグ（スマホ。指が動いた分だけ自機が動く）かキーボード（矢印 / WASD、Shift で低速）の入力をそのまま返す。
 * AI の一つとして登録しておくことで、セレクトや ?ai=manual から切り替えられる。
 */
export const manualAI: DodgeAIDefinition = {
  id: "manual",
  label: "Manual（自分で操作）",
  create: () => ({
    decide: (world) => manualInput.intent(world),
    reset: () => manualInput.clear(),
  }),
};

import type { DodgeAIDefinition } from "./types";

/** 何もしない AI。比較用のベースライン。 */
export const idleAI: DodgeAIDefinition = {
  id: "idle",
  label: "Idle（動かない）",
  create: () => ({
    decide: () => ({ dx: 0, dy: 0 }),
  }),
};

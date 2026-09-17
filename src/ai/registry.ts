import { idleAI } from "./idle";
import { lookaheadAI } from "./lookahead";
import { manualAI } from "./manual";
import type { DodgeAIDefinition } from "./types";

/**
 * 利用可能な回避AIの一覧。新しい AI を作ったらここに追加するだけで UI と ?ai= から選べるようになる。
 * 先頭がデフォルト。
 */
export const aiDefinitions: readonly DodgeAIDefinition[] = [lookaheadAI, idleAI, manualAI];

export function findAI(id: string | null): DodgeAIDefinition {
  return aiDefinitions.find((d) => d.id === id) ?? aiDefinitions[0];
}

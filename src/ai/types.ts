import type { MoveIntent, WorldView } from "../sim/world";

/**
 * 回避AIのインターフェース。
 *
 * 毎フレーム、ワールドの状態（読み取り専用）を受け取って移動指示を返す。
 * AI はワールドを書き換えてはならない（先読みしたい場合は自前のバッファにコピーする）。
 */
export interface DodgeAI {
  decide(world: WorldView): MoveIntent;
  /** ワールドがリセットされたときに呼ばれる。内部状態を持つ AI はここで初期化する。 */
  reset?(): void;
}

/** 登録用の定義。AI は状態を持ちうるので、インスタンスではなくファクトリを登録する。 */
export interface DodgeAIDefinition {
  /** URL パラメータ ?ai=<id> で指定する識別子 */
  id: string;
  label: string;
  create(): DodgeAI;
}

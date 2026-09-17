# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 概要

弾幕を自動回避 AI が避けるのを眺める「弾幕鑑賞アプリ」。ボスはモケラ、自機はぴよ。TypeScript + Vite + PixiJS v8。
コメント・ドキュメント・コミットメッセージは日本語で書く。

## コマンド

```sh
npm run dev        # 開発サーバー
npm run build      # tsc --noEmit で型チェック → vite build
npm run typecheck  # 型チェックのみ
npm test           # vitest run（全テスト）
npx vitest run src/sim/world.test.ts        # 1 ファイルだけ
npx vitest run -t "BulletPool"              # テスト名で絞り込み
npm run deploy     # build して dist を gh-pages ブランチへ push（GitHub Pages に公開）
```

- 公開先: https://mokelab.github.io/piyo2026/ 。`main` への push とは別に、公開したいときに手動で `npm run deploy` する
- `vite.config.ts` の `base: "./"` により、サブパス配信でもそのまま動く

## URL パラメータ（動作確認用）

- `?seed=<n>`: 乱数シード。同じシードなら同じ弾幕が再現される
- `?pattern=<id>`: デモステージをこのパターンから始める（id は `difficultyGroups` 内の各 step の `id`。そのパターンを含むグループから始まる）
- `?group=<id>`: デモステージをこの難易度グループから始める（`easy` / `normal` / `hard`）
- `?loop=<n>`: デモステージを n 周目（1 始まり）から始める。周を重ねるほど弾が速い
- `?ai=<id>`: 回避 AI を選ぶ
- クエリ無しで開くとタイトル画面から始まり、Start 後に `seed` が URL に書き込まれる

## アーキテクチャ

シミュレーション（`src/sim`）・AI（`src/ai`）・描画（`src/render`）が分離されている。

- **固定ステップ**: `src/main.ts` が 60fps 固定ステップでループし、毎ステップ `ai.decide(world)` → `world.step(intent)` を呼ぶ。描画はフレームごとに 1 回。
- **決定性**: 乱数は必ず `ctx.rng`（`World` が持つシード付き mulberry32）を使う。`Math.random()` を使うとシード再現が壊れる。
- **読み取り専用ビュー**: AI と Renderer は `WorldView` / `BulletsView` だけを見て、ワールドを書き換えない。先読みしたい AI は自前でコピー・外挿する。
- **`World.step` の順序**: パターン実行 → 死んだ敵の除去 → 弾移動 → 自機移動 → 当たり判定。被弾してもゲームは止まらず、ヒット数を数えて一定時間無敵になるだけ。

### 弾（`src/sim/bullets.ts`）

`BulletPool` は Structure of Arrays（TypedArray）で弾を保持し、生存弾を常に `[0, count)` に詰める（削除は末尾と入れ替え）。
弾ごとの属性を増やすときは、配列の追加に加えて `add` と `removeAt` の両方を更新する必要がある。
撃った後の動き（`aimAfter` で自機狙いに向き直る、`burst` で破裂して子弾をばらまく）は `BulletBehavior` で指定する。

### パターン（`src/sim/pattern.ts`, `src/sim/patterns/basic.ts`）

- 弾幕パターンはジェネレータ関数 `(ctx: PatternContext) => Generator<number>` で、`yield n` で n フレーム待つ。`PatternRunner` が並行タスクとして 1 フレームずつ進める。
- パターンは `spiral(frames)` のように長さなどを引数に取るファクトリとして書く。`yield*` で直列、`together` / `ctx.spawn` で並列に組み合わせる。
- ボスの位置は `ctx.boss` を書き換えて動かす。`bossSway` が常時揺らしているので、パターンからボスを動かすときは `BossMotion.swaying` を false にして止める（`centerRandomPick` 参照）。
- 子機は `ctx.spawnEnemy` で出し、`x, y` を書き換えて動かし、`alive = false` で消す（当たり判定は無い）。
- デモステージは難易度グループ（`difficultyGroups`）順に進む。各グループから `CLEARS_PER_GROUP` 個を `ctx.rng` で重複なしに選んで流し切ると次のグループへ進み、最後の後は最初に戻る。周を重ねるごとに `ctx.bulletSpeedScale`（`fire` の速さと破裂の子弾の速さに掛かる倍率）を上げる。進み具合は `StageProgress` に書き込まれ、HUD に出る。
- **新しいパターンを追加したら**、難しさに合う `difficultyGroups` のグループの `steps` に `{ id, pattern, rest }` を追加し（これで `?pattern=` から選べる）、必要なら `centerRandomPick` の候補にも加える。`docs/patterns.md` の表にも動きを追記する。命名方針（「狙い方 + 形 + 撃ち方」）と未決事項もこのドキュメントにある。

### 回避 AI（`src/ai`）

- `DodgeAI.decide(world)` が `MoveIntent { dx, dy }`（[-1, 1]、長さ 1 超は正規化）を返す。
- AI は状態を持ちうるので、`DodgeAIDefinition`（`id`, `label`, `create()` ファクトリ）として `src/ai/registry.ts` の `aiDefinitions` に登録する。登録するだけで UI のセレクトと `?ai=` から選べる。先頭がデフォルト。
- `lookahead.ts` は候補方向ごとに弾を等速直線運動と仮定して数十フレーム先まで外挿し、危険度で最良方向を選ぶ。HUD に AI の処理時間が出るので、重さはそこで確認できる。

### 描画（`src/render/renderer.ts`）

PixiJS の `ParticleContainer` で弾を描画する（加算合成、弾の半径に合わせてテクスチャをスケール）。論理解像度は 480x640 で、ウィンドウに合わせて縦横比を保って拡大する。

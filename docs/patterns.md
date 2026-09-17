# 弾幕パターンの命名

`src/sim/patterns/basic.ts` にある基本パターンの名前を整理するためのメモ。
表示名の方向性（かわいい系 / 必殺技名風）はまだ決めていない。

## 基本パターン

| 現在の関数名 | 実際の動き | 識別子の案 | 表示名の案 |
|---|---|---|---|
| `spiral` | 腕が複数ある渦巻き。速い弾が正回転、遅い弾が 1.3 倍の速さで逆回転していて、二重の渦になっている | `doubleSpiral`（または `counterSpiral`） | ぐるぐる二重渦 |
| `aimedFan` | 自機を狙った 7 方向の弾を、速さを変えながら 5 回続けて撃つ。狙った方向にくさび状の塊が飛ぶ | `aimedFanBurst`（または `aimedWedge`） | 狙い撃ち扇連弾 |
| `flowerRings` | ボスの近くのランダムな場所から、36 発の全方位リングを撃つ | `scatteredRings` | 咲き散らしリング |
| `doubleScatteredRings` | `flowerRings` の 2 重版。速さ 2.0 と 1.2 のリングを、内側を半コマずらして同じ場所から撃つ（30 発 × 2、32 フレーム間隔） | `doubleScatteredRings`（命名方針に沿って追加済み） | 咲き散らし二重リング |
| `delayedAimScatteredRings` | `flowerRings` と同じ位置・弾数・速さでリングを撃ち、発射から 60 フレーム（1 秒）後に各弾が速さを保ったまま自機の方へ向きを変える | `delayedAimScatteredRings`（新規追加） | （未定） |
| `burstingRings` | ボスから 12 発の全方位リングを撃ち、発射から 45 フレーム後に各弾が消えて、進行方向を基準に 8 発の小さな弾をばらまく（50 フレーム間隔。1 回 96 発。子弾が遅く長く残るため、画面上の弾数は `doubleScatteredRings` より少し多い） | `burstingRings`（新規追加） | （未定） |
| `sideSpiralEnemies` | ボスから左右に子モケラを撃ち出し、止まった位置から 4 本腕の渦巻きを撃たせる。左右で回転が逆向き。撃ち終わると上へ去る（150 フレームごとに 1 組） | `sideSpiralEnemies`（新規追加） | 子モケラぐるぐる |
| `evenFanStreamWithAimedShot` | 自機狙いの 6 way 偶数弾（自機の方向が真ん中の隙間に来る扇、間隔 0.28 rad）を 5 フレームごとに撃ち続けて横移動を封じ、60 フレーム（1 秒）ごとに大きな自機狙い弾（半径 12）を 1 発撃って、隙間の中で小さく避けさせる | `evenFanStreamWithAimedShot`（新規追加） | （未定） |
| `centerRandomPick` | ボスの揺れを止めて画面中央（縦横とも）へ移動し、固定の候補（`spiral` / `aimedFan` / `flowerRings` / `doubleScatteredRings` / `delayedAimScatteredRings` / `burstingRings` / `sideSpiralEnemies` / `evenFanStreamWithAimedShot`）から 1 つ抽選して撃つ。撃ち終わったら元の y 座標へ戻り、揺れを再開する | `centerRandomPick`（新規追加） | （未定） |
| `evenFanRandomMix` | `evenFanStreamWithAimedShot` を撃ちながら、固定の候補（`spiral`（3 本腕）/ `flowerRings` / `burstingRings` / `sideSpiralEnemies` / `rain`）から 1 つ抽選して同時に撃つ。自機狙いの多いパターン（`aimedFan` / `delayedAimScatteredRings`）は偶数弾の隙間を潰してしまうので候補から外している | `evenFanRandomMix`（組み合わせ） | （未定） |
| `rain` | 画面上端のランダムな位置から、少しばらけながら弾が降る | `rain`（揃えるなら `randomRain`） | ひよこ雨 |

攻撃パターン以外のもの:

- `bossSway`: ボスを左右にゆっくり揺らす動き。`BossMotion` の `swaying` を false にすると止まり、戻すとなめらかに揺れへ戻る
- `together`: 複数のパターンを同時に走らせる
- `togetherRandomPick`: 基本のパターンと、候補から 1 つ抽選したパターンを同時に走らせる
- `demoStage`: 上のパターンを順番に無限ループするサンプルステージ

## 命名方針

- **識別子は「狙い方 + 形 + 撃ち方」で揃える**
  - 狙い方: `aimed` / `random` / （省略 = 固定方向）
  - 形: `fan` / `ring` / `spiral` / `rain`
  - 撃ち方: `burst`（連射のまとまり）/ `stream`（途切れず撃ち続ける）
- **表示名は識別子とは別に持たせる。** パターンに `{ id, title, pattern }` のようなメタ情報を付けて、鑑賞画面での表示や選択に使えるようにする。
- **組み合わせは基本パターンと分ける。** `demoStage` の 4 番目（`together(spiral(600, 3), rain(600))`）は `spiralRain` のように組み合わせとして名前をつける。

## 未決事項

- 表示名の方向性（ぴよ・モケラ寄りのかわいい系か、必殺技名風か）
- 識別子のリネームとメタ情報の追加をいつやるか

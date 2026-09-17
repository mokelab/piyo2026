# piyo2026

公開先: https://mokelab.github.io/piyo2026/

## 開発

```sh
npm install
npm run dev
```

## デプロイ

GitHub Pages に `gh-pages` ブランチから公開している。

```sh
npm run deploy
```

`npm run build` でビルドしてから、`dist` の中身を `gh-pages` ブランチへ push する。数十秒ほどで公開先に反映される。

- `main` への push とは別の操作なので、公開したいタイミングで手動で実行する
- `vite.config.ts` で `base: "./"` にしているため、`/piyo2026/` のようなサブパスでもそのまま動く

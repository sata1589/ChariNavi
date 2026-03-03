# ChariNavi サンプルアプリ

このディレクトリは、自転車用経路探索ライブラリ **ChariNavi** を使った Next.js サンプルアプリです。  
危険エリア（Danger Zone）を考慮したルート探索 API の動作確認ができます。

## 前提

- Node.js 20 以上
- pnpm
- Google Maps API キー

## セットアップ

1. `sample` ディレクトリへ移動

   ```bash
   cd sample
   ```

2. 依存関係をインストール

   ```bash
   pnpm install
   ```

3. 環境変数ファイルを作成して API キーを設定

   ```bash
   copy sample.env .env.local
   ```

   `.env.local` の以下 2 つを設定してください。
   - `GOOGLE_MAPS_API_KEY`
   - `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

## 起動方法

開発サーバーを起動:

```bash
pnpm dev
```

ブラウザで `http://localhost:3000` を開きます。

## Danger Zone の設定

ライブラリ利用者向けの危険エリア設定は以下で管理します。

- `config/danger-zones.ts`

`DEFAULT_DANGER_ZONES` を編集すると、サンプル API が参照する通行回避エリアを変更できます。

## 主な API

- `POST /api/charinavi/sample`

リクエストで `startPoint` と `endPoint` を渡すと、ChariNavi による安全寄りルート計算結果を返します。

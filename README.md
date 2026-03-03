# ChariNavi

危険区域を考慮して、自転車向けの安全ルートを選択する TypeScript ライブラリです。  
関数ベース API を採用しており、テストしやすく拡張しやすい構成になっています。

## 概要

- Google Directions API から複数候補ルートを取得
- 危険区域との重なりを評価して安全スコアを算出
- 最も安全なルートを選び、代替ルートも返却
- 主要 API は `calculateSafeRoute` と `createSafeRouteCalculator`

詳細なファイル責務は [docs/file-operations.md](docs/file-operations.md) を参照してください。

## 導入方法（GitHub配布）

npm 公開はせず、GitHub リポジトリから直接インストールして利用する想定です。

### 1. GitHub からインストール

```bash
pnpm add github:sata1589/ChariNavi
# または
npm install github:sata1589/ChariNavi
```

### 2. 関数をインポート

```ts
import { calculateSafeRoute, createSafeRouteCalculator } from "charinavi";
```

## 使い方

### 1. 依存関係をインストール

```bash
pnpm install
```

> この手順はライブラリ開発者向け（このリポジトリを直接触る場合）です。

### 2. API キーを用意

Google Maps Directions API を有効化した API キーを準備してください。

### 3. 関数を呼び出す

`calculateSafeRoute` は 1 回実行向け、`createSafeRouteCalculator` は API キーを固定したい場合に便利です。

## 使用例

### 使用例1: `calculateSafeRoute` を直接使う

```ts
import { calculateSafeRoute } from "charinavi";

const result = await calculateSafeRoute({
  apiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  startPoint: { latitude: 35.681236, longitude: 139.767125 },
  endPoint: { latitude: 35.658034, longitude: 139.701636 },
  dangerZones: [
    {
      id: "zone-1",
      latitude: 35.67,
      longitude: 139.74,
      radius: 150,
      severity: "high",
      title: "交通事故多発地点",
    },
  ],
  options: {
    avoidDangerZones: true,
    preferBikeRoutes: true,
    dangerZoneBuffer: 30,
    maxDetourDistance: 2,
    safetyWeight: 0.8,
    distanceWeight: 0.2,
    shortRouteThresholdKm: 3,
    maxShortRouteDetourRatio: 1.25,
  },
});

console.log(result.safetyScore);
console.log(result.routeInfo.distance, result.routeInfo.duration);
console.log(result.warnings);
```

### 使用例2: `createSafeRouteCalculator` で API キーを固定

```ts
import { createSafeRouteCalculator } from "charinavi";

const calculate = createSafeRouteCalculator(
  process.env.GOOGLE_MAPS_API_KEY ?? "",
);

const result = await calculate(
  { latitude: 35.681236, longitude: 139.767125 },
  { latitude: 35.658034, longitude: 139.701636 },
  [
    {
      id: "zone-2",
      latitude: 35.666,
      longitude: 139.73,
      radius: 120,
      severity: "medium",
    },
  ],
  {
    avoidDangerZones: true,
    dangerZoneBuffer: 20,
  },
);

console.log(result.route.length);
```

## パラメータ説明

### `calculateSafeRoute` の入力

```ts
{
  apiKey: string;
  startPoint: { latitude: number; longitude: number; address?: string };
  endPoint: { latitude: number; longitude: number; address?: string };
  dangerZones: DangerZone[];
  options?: Partial<SafeRouteOptions>;
}
```

- `apiKey`: Google Maps Directions API のキー
- `startPoint`: 出発地点の座標
- `endPoint`: 到着地点の座標
- `dangerZones`: 危険区域の配列
- `options`: ルート探索設定（未指定時はデフォルト値を使用）

### `startPoint` / `endPoint`

```ts
{
  latitude: number;
  longitude: number;
  address?: string;
}
```

- `latitude`: 緯度
- `longitude`: 経度
- `address`: 任意の住所文字列（表示用途）

### `dangerZones`

`dangerZones` は危険区域の配列です。各要素は次の形式です。

```ts
{
	id: string;
	latitude: number;
	longitude: number;
	radius: number; // メートル
	severity?: "low" | "medium" | "high";
	title?: string;
	description?: string;
}
```

- `id`: 危険区域の識別子
- `latitude` / `longitude`: 危険区域の中心座標
- `radius`: 危険区域の半径（m）
- `severity`: 危険度（未指定時は `"medium"` 扱い）
- `title` / `description`: 画面表示やログ出力向けの任意情報

### `options`

`options` は安全ルート探索時の挙動を調整します。

```ts
{
  avoidDangerZones: boolean;
  preferBikeRoutes: boolean;
  dangerZoneBuffer: number; // メートル
  maxDetourDistance: number; // km
  safetyWeight: number;
  distanceWeight: number;
  shortRouteThresholdKm: number;
  maxShortRouteDetourRatio: number;
}
```

- `avoidDangerZones`: `true` の場合、危険区域回避の迂回候補を追加生成
- `preferBikeRoutes`: `true` の場合、高速道路回避など自転車寄り候補を追加取得
- `dangerZoneBuffer`: 危険区域半径に追加する安全マージン（m）
- `maxDetourDistance`: 許容する迂回距離（km）
- `safetyWeight`: 最終選定時の安全性重み（0以上、距離重みと正規化）
- `distanceWeight`: 最終選定時の距離重み（0以上、安全性重みと正規化）
- `shortRouteThresholdKm`: 近距離とみなす閾値（km）
- `maxShortRouteDetourRatio`: 近距離時に許容する遠回り倍率（例: `1.35` = 35% まで）

デフォルト値（`getDefaultSafeRouteOptions()`）:

- `avoidDangerZones: true`
- `preferBikeRoutes: true`
- `dangerZoneBuffer: 10`
- `maxDetourDistance: 2`
- `safetyWeight: 0.7`
- `distanceWeight: 0.3`
- `shortRouteThresholdKm: 3`
- `maxShortRouteDetourRatio: 1.35`

## 戻り値の主な項目

- `route`: ルートの座標配列
- `routeInfo`: 距離・所要時間・ステップ案内
- `segments`: セグメントごとの危険判定とスコア
- `safetyScore`: 0〜100 の総合安全スコア
- `alternativeRoutes`: 代替ルート（最大2件）
- `warnings`: 注意喚起メッセージ

## 備考

- `checkBikePath` は現在、Directions の案内文に含まれるキーワード（例: `自転車道`, `cycleway`）で自転車道らしさを判定します。
- 判定ロジックを調整したい場合は `src/domain/bike-path.ts` のキーワード定義を編集してください。

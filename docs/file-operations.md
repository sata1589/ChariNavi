# ファイル別 操作ドキュメント

このドキュメントは、`src` 配下の各ファイルが担う責務と処理内容をまとめたものです。

## 公開エントリ

### src/index.ts

- ライブラリの公開 API を再エクスポートします。
- `calculateSafeRoute` / `createSafeRouteCalculator`（コア関数）を公開します。
- オプション解決関数と型定義を公開します。

## コア

### src/core/calculate-safe-route.ts

- 入力 (`CalculateSafeRouteInput`) を受け取り、オプションを正規化します。
- `getMultipleRoutes` で候補ルートを取得します。
- 候補ごとに `evaluateRouteSafety` で安全性評価を行います。
- `selectSafestRoute` で最終ルートを選択して返します。
- `createSafeRouteCalculator` で API キー固定の実行関数を生成します。

## ドメイン

### src/domain/types.ts

- ドメイン型（`RoutePoint`, `DangerZone`, `SafeRouteResult` など）を定義します。
- ルーティング処理の入出力契約（型の共通言語）を提供します。

### src/domain/options.ts

- `getDefaultSafeRouteOptions` でデフォルト設定を返します。
- `resolveSafeRouteOptions` で部分オプションをデフォルトとマージします。

### src/domain/safety-rules.ts

- 危険度の序列化 (`getDangerLevelValue`) を行います。
- セグメントが危険区域に入るか判定 (`checkDangerousSegment`) します。
- セグメント単位の安全スコア計算 (`calculateSegmentSafetyScore`) を行います。
- 全体スコアの距離加重平均 (`calculateSafetyScore`) を計算します。

### src/domain/bike-path.ts

- 自転車道判定の拡張ポイントです。
- 現在は `checkBikePath` が常に `false` を返す最小実装です。

## アルゴリズム

### src/algorithms/geometry.ts

- ハヴァサイン式で 2 点間距離を計算 (`calculateDistance`) します。
- セグメント距離の合計 (`calculateSegmentDistance`) を計算します。

### src/algorithms/polyline.ts

- Google Directions の polyline 文字列を座標列へデコード (`decodePolyline`) します。
- ルート全体の点列を抽出 (`extractRoutePoints`) します。

### src/algorithms/detour-generator.ts

- 危険区域周囲の迂回点を生成 (`generateDetourPoints`) します。
- 迂回点を waypoint としてルート候補を収集 (`generateDetourRoutes`) します。
- ルート取得はコールバック注入で受け取り、API 依存を分離しています。

### src/algorithms/route-evaluator.ts

- 1本の Directions ルートを `SafeRouteResult` へ変換 (`evaluateRouteSafety`) します。
- ルートをセグメント分割して危険判定・距離計算・スコア化します。
- 警告文を組み立て (`generateWarnings`) します。

### src/algorithms/route-selector.ts

- 候補ルートの総合スコア (`calculateTotalScore`) を算出します。
- 危険区域通過の有無・危険区間数・総合スコアで最適ルートを選択します。
- 上位 2 件を代替ルートとして付与します。

## サービス（外部 API 境界）

### src/services/directions-types.ts

- Directions API レスポンスの内部利用型を定義します。
- `route` / `leg` / `step` の形を明示し、型安全に利用できるようにします。

### src/services/directions-client.ts

- Directions API 呼び出し (`fetchRoutes`) を担当します。
- 標準候補・自転車優先候補・迂回候補を統合取得 (`getMultipleRoutes`) します。
- `fetchImpl` を注入可能にし、テスト時のモック差し替えに対応します。
- `removeDuplicateRoutes` で重複候補を排除します。

## ユーティリティ

### src/utils/route-signature.ts

- ルートの特徴量から署名文字列 (`generateRouteSignature`) を生成します。
- 署名ベースで重複ルートを除去 (`removeDuplicateRoutes`) します。

## 処理フロー（全体）

1. `calculateSafeRoute` が入力とオプションを受け取る。
2. `getMultipleRoutes` が Directions API から候補を収集する。
3. `evaluateRouteSafety` が各候補を安全性評価する。
4. `selectSafestRoute` が最適ルートと代替案を返す。

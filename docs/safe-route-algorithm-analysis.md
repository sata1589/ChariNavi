# ChariNavi 安全ルート探索アルゴリズム解析

このドキュメントは、ライブラリ内部の「どのように安全性を判定して最終ルートを選ぶか」を実装ベースで整理したものです。

## 1. 全体フロー

起点は `calculateSafeRoute` です。

1. 入力 (`apiKey`, `startPoint`, `endPoint`, `dangerZones`, `options`) を受け取る
2. `resolveSafeRouteOptions` でデフォルトオプションを解決
3. `getMultipleRoutes` で候補ルート群を取得
4. 各候補を `evaluateRouteSafety` で評価
5. `selectSafestRoute` で最適ルート + 代替ルートを返す

## 2. 候補ルートの収集 (`getMultipleRoutes`)

候補ルートは以下の3系統をマージして作ります。

### 2.1 標準候補

- Google Directions API (`mode=bicycling`, `alternatives=true`, `avoid=highways`) を取得

### 2.2 自転車優先候補（`preferBikeRoutes` が true のとき）

- 自転車特化のため、初期取得自体を `avoid=highways` 前提で実施

### 2.3 危険ゾーン迂回候補（`avoidDangerZones` が true のとき）

- 初回取得したベースラインルート（先頭）を1本選ぶ
- ベースラインルートが実際に通過した danger zone のみ抽出する
- 抽出された zone を基に、左右回避シミュレーションで waypoint 列を算出
- waypoint 付きで Directions API を 1 回だけ再呼び出し（`alternatives=false`）
- ベースラインがどの danger zone も踏まない場合、迂回 API 呼び出しは行わない

最後に `removeDuplicateRoutes` で重複候補を除去します。

## 3. 重複除去ロジック (`removeDuplicateRoutes`)

各ルートに署名を作り、同一署名を1本にまとめます。

- 署名構成
  - 開始地点（小数4桁）
  - 終了地点（小数4桁）
  - 距離（100m単位へ丸め）
  - 所要時間（分単位へ丸め）

完全一致比較ではなく「特徴量ベース」の重複除去です。

## 4. 1候補ルートの安全評価 (`evaluateRouteSafety`)

### 4.1 ルート点列化

- `extractRoutePoints` が Google polyline をデコードし、`RoutePoint[]` を生成
- 各 `RoutePoint.address` には、対応するステップの案内文（HTMLタグ除去済み）を保持

### 4.2 セグメント分割

- `segmentSize = max(1, floor(routePoints.length / 20))`
- ルート点列を `segmentSize` 刻みで分割
- 概ね最大20セグメント程度で評価

### 4.3 各セグメント評価 (`createRouteSegment`)

各セグメントで以下を計算します。

- 距離: `calculateSegmentDistance`
- 危険判定: `checkDangerousSegment`
- 自転車道判定: `checkBikePath`
- セグメント安全スコア: `calculateSegmentSafetyScore`

### 4.4 ルート全体スコア

- `calculateSafetyScore` で「距離加重平均」を取り、四捨五入した整数を返す

## 5. 危険判定の中身 (`checkDangerousSegment`)

セグメント内の全点 × 全 danger zone を走査して判定します。

- 距離はハヴァサイン式 (`calculateDistance`) でメートル計算
- 危険条件:  
  `distance <= zone.radius + options.dangerZoneBuffer`

1点でも条件を満たすと `isDangerous = true`。
複数ゾーンにかかる場合は、最も強い `severity` を採用します。

`severity` の優先順位:

- `high` > `medium` > `low`
- 未指定は `medium` 扱い

## 6. スコア計算式

### 6.1 セグメント安全スコア (`calculateSegmentSafetyScore`)

初期値 100 から減点・加点します。

- 危険減点
  - low: -20
  - medium: -40
  - high: -60
- 自転車道加点
  - `isBikePath === true` なら +20
- 最終的に 0〜100 にクランプ

### 6.2 ルート安全スコア (`calculateSafetyScore`)

距離加重平均:

- `weight_i = segmentDistance_i / totalDistance`
- `routeSafety = round(Σ(segmentScore_i × weight_i))`

距離0またはセグメント0の場合は 0。

### 6.3 ルート総合スコア (`calculateTotalScore`)

最終選定用に安全性と距離を混合します。

- `total = safetyScore × safetyWeight + distanceScore × distanceWeight - shortRouteDetourPenalty`
- `distanceScore = clamp((baselineDistanceKm / routeDistanceKm) × 100, 0, 100)`

補足:

- `safetyWeight` / `distanceWeight` は入力値を正規化して使用（合計0の場合は `0.7/0.3`）
- `baselineDistanceKm` は候補内の最短距離
- `routeDistanceKm` は `routeInfo.distance.text` を km に正規化して算出
- 近距離（`baselineDistanceKm <= shortRouteThresholdKm`）で遠回り倍率が
  `maxShortRouteDetourRatio` を超える場合は追加減点

## 7. 最終ルート選定ルール (`selectSafestRoute`)

選定は段階的フィルタ + 比較です。

1. 危険セグメントが 1 つもないルート群を最優先候補にする
2. それが無ければ、`high` 危険を含まないルート群に絞る
3. それも無ければ、全候補で比較

比較優先順位:

1. 危険セグメントなしを優先
2. 両方危険ありなら、危険セグメント数が少ない方を優先
3. 同条件なら `totalScore` が高い方を採用

採用外候補のうち `totalScore` 上位2件を `alternativeRoutes` に入れて返します。

## 8. 警告文生成 (`generateWarnings`)

以下の条件で警告を返します。

- 危険セグメントがある場合
  - 「危険区域が何箇所あるか」
  - `high` があれば「高危険区域の箇所数」
- 自転車道利用率 (`bikePathSegments / segments`) が 30% 未満の場合
  - 「自転車道の利用率が低い」警告

## 9. オプションが与える影響

デフォルト値:

- `avoidDangerZones: true`
- `preferBikeRoutes: true`
- `dangerZoneBuffer: 10`
- `maxDetourDistance: 2`
- `safetyWeight: 0.7`
- `distanceWeight: 0.3`
- `shortRouteThresholdKm: 3`
- `maxShortRouteDetourRatio: 1.35`

影響:

- `preferBikeRoutes` は「候補収集段階」に影響
- `avoidDangerZones` は「迂回候補生成」に影響
- `dangerZoneBuffer` は危険判定のしきい値に直接影響
- `safetyWeight` / `distanceWeight` は最終選定の重みを制御
- `shortRouteThresholdKm` / `maxShortRouteDetourRatio` は近距離での遠回り抑制に影響
- `maxDetourDistance` は現状ロジックでは未使用

## 10. 実装上の注意点（現状）

- `checkBikePath` は現在、案内文キーワード（例: `自転車道`, `cycleway`, `bike`）で判定するヒューリスティック実装
  - Directions の表記に依存するため、過検知・見逃しの可能性がある
- `distanceScore` は `distance.text` の文字列数値に依存
  - 単位（m / km）は現在正規化しているが、文字列表記依存は残る
- `avoidDangerZones=true` は「危険判定を無効化する」のではなく、
  「迂回候補を追加して選択肢を増やす」挙動

---

必要であれば次の段階として、上記ロジックに対する「改善提案（精度・性能・説明可能性）」を別章で追記できます。

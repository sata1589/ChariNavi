import { RouteInfo, RoutePoint, DangerZone } from "./type";

export interface SafeRouteOptions {
  avoidDangerZones: boolean;
  preferBikeRoutes: boolean;
  dangerZoneBuffer: number; // 危険区域から何メートル離れるか
  maxDetourDistance: number; // 最大迂回距離（km）
  dangerZones?: DangerZone[]; // 危険区域データ
}

export interface RouteSegment {
  points: RoutePoint[];
  isBikePath: boolean;
  isDangerous: boolean;
  dangerLevel?: "low" | "medium" | "high";
  distance: number;
  safetyScore: number; // 0-100のスコア（100が最も安全）
}

export interface SafeRouteResult {
  route: RoutePoint[];
  routeInfo: RouteInfo;
  segments: RouteSegment[];
  safetyScore: number;
  alternativeRoutes?: SafeRouteResult[];
  warnings: string[];
}

export class SafeRouteCalculator {
  private googleMapsApiKey: string;

  constructor(apiKey: string) {
    this.googleMapsApiKey = apiKey;
  }

  /**
   * 安全ルートを計算
   */
  async calculateSafeRoute(
    startPoint: RoutePoint,
    endPoint: RoutePoint,
    dangerZones: DangerZone[],
    options: SafeRouteOptions = this.getDefaultOptions(),
  ): Promise<SafeRouteResult> {
    try {
      // 複数のルートオプションを取得
      const routeOptions = await this.getMultipleRoutes(
        startPoint,
        endPoint,
        options,
      );

      // 各ルートの安全性を評価
      const evaluatedRoutes = await Promise.all(
        routeOptions.map((route) =>
          this.evaluateRouteSafety(route, dangerZones, options),
        ),
      );

      // 最も安全なルートを選択
      const safeRoute = this.selectSafestRoute(evaluatedRoutes, options);

      return safeRoute;
    } catch (error) {
      console.error("Safe route calculation error:", error);
      throw new Error("安全ルートの計算に失敗しました");
    }
  }

  /**
   * Google Maps Directions APIで複数のルートを取得
   */
  private async getMultipleRoutes(
    startPoint: RoutePoint,
    endPoint: RoutePoint,
    options: SafeRouteOptions,
  ): Promise<any[]> {
    const routes: any[] = [];

    // 基本パラメータ
    const baseParams = {
      origin: `${startPoint.latitude},${startPoint.longitude}`,
      destination: `${endPoint.latitude},${endPoint.longitude}`,
      key: this.googleMapsApiKey,
      mode: "bicycling",
      language: "ja",
    };

    // 1. 標準的なルートを取得（複数の代替案を含む）
    try {
      const standardParams = { ...baseParams, alternatives: "true" };
      const standardRoutes = await this.fetchRoutes(standardParams);
      routes.push(...standardRoutes);
    } catch (error) {
      console.warn("Standard routes fetch failed:", error);
    }

    // 2. 自転車道優先ルートを取得
    if (options.preferBikeRoutes) {
      try {
        const bikeParams = {
          ...baseParams,
          alternatives: "true",
          avoid: "highways",
        };
        const bikeRoutes = await this.fetchRoutes(bikeParams);
        routes.push(...bikeRoutes);
      } catch (error) {
        console.warn("Bike-friendly routes fetch failed:", error);
      }
    }

    // 3. 迂回ルートを取得（危険区域を避けるために中間地点を設定）
    if (options.avoidDangerZones) {
      try {
        const detourRoutes = await this.generateDetourRoutes(
          startPoint,
          endPoint,
          baseParams,
          options,
        );
        routes.push(...detourRoutes);
      } catch (error) {
        console.warn("Detour routes generation failed:", error);
      }
    }

    // 重複ルートを除去
    const uniqueRoutes = this.removeDuplicateRoutes(routes);

    if (uniqueRoutes.length === 0) {
      throw new Error("ルートを取得できませんでした");
    }

    return uniqueRoutes;
  }

  /**
   * ルートを取得するヘルパー関数
   */
  private async fetchRoutes(params: any): Promise<any[]> {
    const queryString = new URLSearchParams(params).toString();
    const url = `https://maps.googleapis.com/maps/api/directions/json?${queryString}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== "OK") {
      throw new Error(`Directions API error: ${data.status}`);
    }

    return data.routes || [];
  }

  /**
   * 危険区域を回避するための迂回ルートを生成
   */
  private async generateDetourRoutes(
    startPoint: RoutePoint,
    endPoint: RoutePoint,
    baseParams: any,
    options: SafeRouteOptions,
  ): Promise<any[]> {
    const detourRoutes: any[] = [];

    // 危険区域の重心を計算して迂回点を設定
    const dangerZones = options.dangerZones || [];
    if (dangerZones.length === 0) return detourRoutes;

    // 各危険区域の周囲に迂回点を設定
    for (const zone of dangerZones) {
      const detourPoints = this.generateDetourPoints(
        zone,
        startPoint,
        endPoint,
      );

      for (const detourPoint of detourPoints) {
        try {
          // 出発地 → 迂回点 → 目的地のルートを取得
          const waypointParams = {
            ...baseParams,
            waypoints: `${detourPoint.latitude},${detourPoint.longitude}`,
            alternatives: "false",
          };

          const detourRouteData = await this.fetchRoutes(waypointParams);
          detourRoutes.push(...detourRouteData);
        } catch (error) {
          console.warn("Detour route generation failed for waypoint:", error);
        }
      }
    }

    return detourRoutes;
  }

  /**
   * 危険区域の周囲に迂回点を生成
   */
  private generateDetourPoints(
    dangerZone: DangerZone,
    startPoint: RoutePoint,
    endPoint: RoutePoint,
  ): RoutePoint[] {
    const points: RoutePoint[] = [];
    const avoidanceRadius = dangerZone.radius + 200; // 危険区域から200m離れた地点

    // 危険区域を中心とした4方向に迂回点を設定
    const directions = [
      { lat: 1, lng: 0 }, // 北
      { lat: 0, lng: 1 }, // 東
      { lat: -1, lng: 0 }, // 南
      { lat: 0, lng: -1 }, // 西
    ];

    for (const dir of directions) {
      // 地球の半径を使った簡易的な座標計算
      const latOffset = (dir.lat * avoidanceRadius) / 111111; // 約111km/度
      const lngOffset =
        (dir.lng * avoidanceRadius) /
        (111111 * Math.cos((dangerZone.latitude * Math.PI) / 180));

      const detourPoint: RoutePoint = {
        latitude: dangerZone.latitude + latOffset,
        longitude: dangerZone.longitude + lngOffset,
      };

      points.push(detourPoint);
    }

    return points;
  }

  /**
   * 重複するルートを除去
   */
  private removeDuplicateRoutes(routes: any[]): any[] {
    const uniqueRoutes: any[] = [];
    const seenRoutes = new Set<string>();

    for (const route of routes) {
      // ルートの特徴的な点を使ってハッシュを生成
      const routeSignature = this.generateRouteSignature(route);

      if (!seenRoutes.has(routeSignature)) {
        seenRoutes.add(routeSignature);
        uniqueRoutes.push(route);
      }
    }

    return uniqueRoutes;
  }

  /**
   * ルートのシグネチャを生成（重複検出用）
   */
  private generateRouteSignature(route: any): string {
    try {
      const leg = route.legs?.[0];
      if (!leg) return Math.random().toString();

      const start = `${leg.start_location.lat.toFixed(4)},${leg.start_location.lng.toFixed(4)}`;
      const end = `${leg.end_location.lat.toFixed(4)},${leg.end_location.lng.toFixed(4)}`;
      const distance = leg.distance?.value || 0;
      const duration = leg.duration?.value || 0;

      return `${start}-${end}-${Math.round(distance / 100)}-${Math.round(duration / 60)}`;
    } catch {
      return Math.random().toString();
    }
  }

  /**
   * ルートの安全性を評価
   */
  private async evaluateRouteSafety(
    route: any,
    dangerZones: DangerZone[],
    options: SafeRouteOptions,
  ): Promise<SafeRouteResult> {
    const routePoints = this.extractRoutePoints(route);
    const segments = this.analyzeRouteSegments(
      routePoints,
      dangerZones,
      options,
    );
    const safetyScore = this.calculateSafetyScore(segments, options);
    const warnings = this.generateWarnings(segments, dangerZones);

    const routeInfo: RouteInfo = {
      distance: route.legs[0].distance.text,
      duration: route.legs[0].duration.text,
      steps: route.legs[0].steps.map((step: any) => ({
        instruction: step.html_instructions.replace(/<[^>]*>/g, ""),
        distance: step.distance.text,
        duration: step.duration.text,
      })),
    };

    return {
      route: routePoints,
      routeInfo,
      segments,
      safetyScore,
      warnings,
    };
  }

  /**
   * ルートからポイントを抽出
   */
  private extractRoutePoints(route: any): RoutePoint[] {
    const points: RoutePoint[] = [];

    route.legs.forEach((leg: any) => {
      leg.steps.forEach((step: any) => {
        const decoded = this.decodePolyline(step.polyline.points);
        points.push(
          ...decoded.map((point) => ({
            latitude: point.lat,
            longitude: point.lng,
          })),
        );
      });
    });

    return points;
  }

  /**
   * Polylineをデコード
   */
  private decodePolyline(encoded: string): { lat: number; lng: number }[] {
    const points: { lat: number; lng: number }[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let b,
        shift = 0,
        result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      shift = 0;
      result = 0;

      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({ lat: lat / 1e5, lng: lng / 1e5 });
    }

    return points;
  }

  /**
   * ルートセグメントを分析
   */
  private analyzeRouteSegments(
    routePoints: RoutePoint[],
    dangerZones: DangerZone[],
    options: SafeRouteOptions,
  ): RouteSegment[] {
    const segments: RouteSegment[] = [];
    const segmentSize = Math.max(1, Math.floor(routePoints.length / 20)); // ルートを約20セグメントに分割

    for (let i = 0; i < routePoints.length; i += segmentSize) {
      const segmentPoints = routePoints.slice(i, i + segmentSize);
      const segment = this.createRouteSegment(
        segmentPoints,
        dangerZones,
        options,
      );
      segments.push(segment);
    }

    return segments;
  }

  /**
   * ルートセグメントを作成
   */
  private createRouteSegment(
    points: RoutePoint[],
    dangerZones: DangerZone[],
    options: SafeRouteOptions,
  ): RouteSegment {
    const distance = this.calculateSegmentDistance(points);
    const { isDangerous, dangerLevel } = this.checkDangerousSegment(
      points,
      dangerZones,
      options,
    );
    const isBikePath = this.checkBikePath(points); // TODO: 実装必要
    const safetyScore = this.calculateSegmentSafetyScore(
      isDangerous,
      isBikePath,
      dangerLevel,
    );

    return {
      points,
      isBikePath,
      isDangerous,
      dangerLevel,
      distance,
      safetyScore,
    };
  }

  /**
   * セグメントの距離を計算
   */
  private calculateSegmentDistance(points: RoutePoint[]): number {
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      totalDistance += this.calculateDistance(points[i - 1], points[i]);
    }
    return totalDistance;
  }

  /**
   * 2点間の距離を計算（ハヴァサイン公式）
   */
  private calculateDistance(point1: RoutePoint, point2: RoutePoint): number {
    const R = 6371000; // 地球の半径（メートル）
    const lat1Rad = (point1.latitude * Math.PI) / 180;
    const lat2Rad = (point2.latitude * Math.PI) / 180;
    const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
    const deltaLngRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLngRad / 2) *
        Math.sin(deltaLngRad / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  /**
   * 危険区域との重複をチェック
   */
  private checkDangerousSegment(
    points: RoutePoint[],
    dangerZones: DangerZone[],
    options: SafeRouteOptions,
  ): { isDangerous: boolean; dangerLevel?: "low" | "medium" | "high" } {
    let maxDangerLevel: "low" | "medium" | "high" | undefined;
    let isDangerous = false;

    for (const point of points) {
      for (const zone of dangerZones) {
        const distance = this.calculateDistance(point, {
          latitude: zone.latitude,
          longitude: zone.longitude,
        });

        if (distance <= zone.radius + options.dangerZoneBuffer) {
          isDangerous = true;
          if (
            !maxDangerLevel ||
            this.getDangerLevelValue(zone.severity || "medium") >
              this.getDangerLevelValue(maxDangerLevel)
          ) {
            maxDangerLevel = zone.severity || "medium";
          }
        }
      }
    }

    return { isDangerous, dangerLevel: maxDangerLevel };
  }

  /**
   * 危険レベルの数値を取得
   */
  private getDangerLevelValue(level: "low" | "medium" | "high"): number {
    switch (level) {
      case "low":
        return 1;
      case "medium":
        return 2;
      case "high":
        return 3;
      default:
        return 2;
    }
  }

  /**
   * 自転車道かどうかをチェック（TODO: 実装）
   */
  private checkBikePath(points: RoutePoint[]): boolean {
    // TODO: 自転車道データベースとの照合を実装
    // 現在はランダムで仮実装
    return Math.random() > 0.7;
  }

  /**
   * セグメントの安全スコアを計算
   */
  private calculateSegmentSafetyScore(
    isDangerous: boolean,
    isBikePath: boolean,
    dangerLevel?: "low" | "medium" | "high",
  ): number {
    let score = 100;

    if (isDangerous) {
      switch (dangerLevel) {
        case "low":
          score -= 20;
          break;
        case "medium":
          score -= 40;
          break;
        case "high":
          score -= 60;
          break;
      }
    }

    if (isBikePath) {
      score += 20; // 自転車道ボーナス
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * 全体の安全スコアを計算
   */
  private calculateSafetyScore(
    segments: RouteSegment[],
    options: SafeRouteOptions,
  ): number {
    const totalDistance = segments.reduce(
      (sum, segment) => sum + segment.distance,
      0,
    );

    const weightedScore = segments.reduce((sum, segment) => {
      const weight = segment.distance / totalDistance;
      return sum + segment.safetyScore * weight;
    }, 0);

    return Math.round(weightedScore);
  }

  /**
   * 警告を生成
   */
  private generateWarnings(
    segments: RouteSegment[],
    dangerZones: DangerZone[],
  ): string[] {
    const warnings: string[] = [];

    const dangerousSegments = segments.filter((s) => s.isDangerous);
    if (dangerousSegments.length > 0) {
      warnings.push(
        `ルート上に${dangerousSegments.length}箇所の危険区域があります`,
      );

      const highDangerSegments = dangerousSegments.filter(
        (s) => s.dangerLevel === "high",
      );
      if (highDangerSegments.length > 0) {
        warnings.push(
          `特に注意が必要な高危険区域が${highDangerSegments.length}箇所含まれます`,
        );
      }
    }

    const bikePathSegments = segments.filter((s) => s.isBikePath);
    const bikePathPercentage =
      (bikePathSegments.length / segments.length) * 100;

    if (bikePathPercentage < 30) {
      warnings.push("自転車道の利用率が低いルートです。交通量にご注意ください");
    }

    return warnings;
  }

  /**
   * 最も安全なルートを選択
   */
  private selectSafestRoute(
    routes: SafeRouteResult[],
    options: SafeRouteOptions,
  ): SafeRouteResult {
    if (routes.length === 0) {
      throw new Error("選択可能なルートがありません");
    }

    // 1. 危険区域を通らないルートを優先的に選択
    const safestRoutes = routes.filter(
      (route) => !route.segments.some((segment) => segment.isDangerous),
    );

    let candidateRoutes = safestRoutes.length > 0 ? safestRoutes : routes;

    // 2. 危険区域を通る場合は、最も危険度が低いルートを選択
    if (safestRoutes.length === 0) {
      // 高危険区域を通らないルートを優先
      const lowToMediumDangerRoutes = routes.filter(
        (route) =>
          !route.segments.some((segment) => segment.dangerLevel === "high"),
      );

      if (lowToMediumDangerRoutes.length > 0) {
        candidateRoutes = lowToMediumDangerRoutes;
      }
    }

    // 3. 候補ルートの中から最適なルートを選択
    const scoredRoutes = candidateRoutes.map((route) => ({
      ...route,
      totalScore: this.calculateTotalScore(route, options),
      hasDangerousSegments: route.segments.some(
        (segment) => segment.isDangerous,
      ),
      dangerousSegmentCount: route.segments.filter(
        (segment) => segment.isDangerous,
      ).length,
    }));

    // 4. スコアリング: 安全性を最優先、次に距離を考慮
    const bestRoute = scoredRoutes.reduce((best, current) => {
      // 危険区域を通らないルートを最優先
      if (!current.hasDangerousSegments && best.hasDangerousSegments) {
        return current;
      }
      if (current.hasDangerousSegments && !best.hasDangerousSegments) {
        return best;
      }

      // 両方とも危険区域を通る場合、危険区域の数が少ない方を選択
      if (current.hasDangerousSegments && best.hasDangerousSegments) {
        if (current.dangerousSegmentCount < best.dangerousSegmentCount) {
          return current;
        }
        if (current.dangerousSegmentCount > best.dangerousSegmentCount) {
          return best;
        }
      }

      // 安全性とその他の要素で総合判断
      return current.totalScore > best.totalScore ? current : best;
    });

    // 5. 他のルートを代替案として設定
    const alternatives = scoredRoutes
      .filter((route) => route !== bestRoute)
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 2); // 最大2つの代替案

    return {
      ...bestRoute,
      alternativeRoutes: alternatives.map((alt) => ({
        route: alt.route,
        routeInfo: alt.routeInfo,
        segments: alt.segments,
        safetyScore: alt.safetyScore,
        warnings: alt.warnings,
      })),
    };
  }

  /**
   * 総合スコアを計算
   */
  private calculateTotalScore(
    route: SafeRouteResult,
    options: SafeRouteOptions,
  ): number {
    const safetyWeight = 0.7;
    const distanceWeight = 0.3;

    // 距離スコア（短いほど高得点）
    const distanceValue = parseFloat(
      route.routeInfo.distance.replace(/[^\d.]/g, ""),
    );
    const distanceScore = Math.max(0, 100 - distanceValue * 10); // 10km以上は0点

    return route.safetyScore * safetyWeight + distanceScore * distanceWeight;
  }

  /**
   * デフォルトオプション
   */
  private getDefaultOptions(): SafeRouteOptions {
    return {
      avoidDangerZones: true,
      preferBikeRoutes: true,
      dangerZoneBuffer: 10, // 10メートル
      maxDetourDistance: 2, // 2km
    };
  }
}

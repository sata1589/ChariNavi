import { SafeRouteOptions, SafeRouteResult } from "../domain/types";

interface ScoredRoute extends SafeRouteResult {
  totalScore: number;
  hasDangerousSegments: boolean;
  dangerousSegmentCount: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function parseDistanceTextToKm(distanceText: string): number {
  const normalizedText = distanceText.toLowerCase().replace(/\s/g, "");
  const distanceValue = Number.parseFloat(
    normalizedText.replace(/[^\d.]/g, ""),
  );

  if (!Number.isFinite(distanceValue)) {
    return 0;
  }

  if (normalizedText.includes("km")) {
    return distanceValue;
  }
  if (normalizedText.includes("m")) {
    return distanceValue / 1000;
  }

  return distanceValue;
}

function normalizeWeights(options: SafeRouteOptions): {
  safetyWeight: number;
  distanceWeight: number;
} {
  const safetyWeight = Math.max(0, options.safetyWeight);
  const distanceWeight = Math.max(0, options.distanceWeight);
  const totalWeight = safetyWeight + distanceWeight;

  if (totalWeight === 0) {
    return {
      safetyWeight: 0.7,
      distanceWeight: 0.3,
    };
  }

  return {
    safetyWeight: safetyWeight / totalWeight,
    distanceWeight: distanceWeight / totalWeight,
  };
}

function calculateDistanceScore(
  routeDistanceKm: number,
  baselineDistanceKm: number,
): number {
  if (routeDistanceKm <= 0 || baselineDistanceKm <= 0) {
    return 0;
  }

  return clamp((baselineDistanceKm / routeDistanceKm) * 100, 0, 100);
}

function calculateShortRouteDetourPenalty(
  routeDistanceKm: number,
  baselineDistanceKm: number,
  options: SafeRouteOptions,
): number {
  if (
    baselineDistanceKm <= 0 ||
    baselineDistanceKm > options.shortRouteThresholdKm
  ) {
    return 0;
  }

  const detourRatio = routeDistanceKm / baselineDistanceKm;
  if (detourRatio <= options.maxShortRouteDetourRatio) {
    return 0;
  }

  const overflowRatio = detourRatio - options.maxShortRouteDetourRatio;
  return overflowRatio * 200;
}

export function calculateTotalScore(
  route: SafeRouteResult,
  options: SafeRouteOptions,
  baselineDistanceKm: number,
): number {
  const { safetyWeight, distanceWeight } = normalizeWeights(options);

  const routeDistanceKm = parseDistanceTextToKm(route.routeInfo.distance);
  const distanceScore = calculateDistanceScore(
    routeDistanceKm,
    baselineDistanceKm,
  );
  const shortRouteDetourPenalty = calculateShortRouteDetourPenalty(
    routeDistanceKm,
    baselineDistanceKm,
    options,
  );

  return (
    route.safetyScore * safetyWeight +
    distanceScore * distanceWeight -
    shortRouteDetourPenalty
  );
}

export function selectSafestRoute(
  routes: SafeRouteResult[],
  options: SafeRouteOptions,
): SafeRouteResult {
  if (routes.length === 0) {
    throw new Error("選択可能なルートがありません");
  }

  const routeDistancesKm = routes.map((route) =>
    parseDistanceTextToKm(route.routeInfo.distance),
  );
  const positiveDistances = routeDistancesKm.filter((distance) => distance > 0);
  const baselineDistanceKm =
    positiveDistances.length > 0 ? Math.min(...positiveDistances) : 0;

  const safestRoutes = routes.filter(
    (route) => !route.segments.some((segment) => segment.isDangerous),
  );

  let candidateRoutes = safestRoutes.length > 0 ? safestRoutes : routes;

  if (safestRoutes.length === 0) {
    const lowToMediumDangerRoutes = routes.filter(
      (route) =>
        !route.segments.some((segment) => segment.dangerLevel === "high"),
    );

    if (lowToMediumDangerRoutes.length > 0) {
      candidateRoutes = lowToMediumDangerRoutes;
    }
  }

  const scoredRoutes: ScoredRoute[] = candidateRoutes.map((route) => ({
    ...route,
    totalScore: calculateTotalScore(route, options, baselineDistanceKm),
    hasDangerousSegments: route.segments.some((segment) => segment.isDangerous),
    dangerousSegmentCount: route.segments.filter(
      (segment) => segment.isDangerous,
    ).length,
  }));

  const bestRoute = scoredRoutes.reduce((best, current) => {
    if (!current.hasDangerousSegments && best.hasDangerousSegments) {
      return current;
    }
    if (current.hasDangerousSegments && !best.hasDangerousSegments) {
      return best;
    }

    if (current.hasDangerousSegments && best.hasDangerousSegments) {
      if (current.dangerousSegmentCount < best.dangerousSegmentCount) {
        return current;
      }
      if (current.dangerousSegmentCount > best.dangerousSegmentCount) {
        return best;
      }
    }

    return current.totalScore > best.totalScore ? current : best;
  });

  const alternatives = scoredRoutes
    .filter((route) => route !== bestRoute)
    .sort((left, right) => right.totalScore - left.totalScore)
    .slice(0, 2);

  return {
    ...bestRoute,
    alternativeRoutes: alternatives.map((alternative) => ({
      route: alternative.route,
      routeInfo: alternative.routeInfo,
      segments: alternative.segments,
      safetyScore: alternative.safetyScore,
      warnings: alternative.warnings,
    })),
  };
}

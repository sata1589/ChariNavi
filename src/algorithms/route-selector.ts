import { SafeRouteOptions, SafeRouteResult } from "../domain/types";

interface ScoredRoute extends SafeRouteResult {
  totalScore: number;
  hasDangerousSegments: boolean;
  dangerousSegmentCount: number;
}

export function calculateTotalScore(route: SafeRouteResult): number {
  const safetyWeight = 0.7;
  const distanceWeight = 0.3;

  const distanceValue = Number.parseFloat(
    route.routeInfo.distance.replace(/[^\d.]/g, ""),
  );
  const distanceScore = Math.max(0, 100 - distanceValue * 10);

  return route.safetyScore * safetyWeight + distanceScore * distanceWeight;
}

export function selectSafestRoute(
  routes: SafeRouteResult[],
  _options: SafeRouteOptions,
): SafeRouteResult {
  if (routes.length === 0) {
    throw new Error("選択可能なルートがありません");
  }

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
    totalScore: calculateTotalScore(route),
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

import {
  DangerZone,
  RouteSegment,
  RoutePoint,
  SafeRouteOptions,
  SafeRouteResult,
} from "../domain/types";
import {
  calculateSafetyScore,
  calculateSegmentSafetyScore,
  checkDangerousSegment,
} from "../domain/safety-rules";
import { checkBikePath } from "../domain/bike-path";
import { calculateSegmentDistance } from "./geometry";
import { extractRoutePoints } from "./polyline";
import { DirectionsRoute } from "../services/directions-types";

export function evaluateRouteSafety(
  route: DirectionsRoute,
  dangerZones: DangerZone[],
  options: SafeRouteOptions,
): SafeRouteResult {
  const routePoints = extractRoutePoints(route);
  const segments = analyzeRouteSegments(routePoints, dangerZones, options);
  const safetyScore = calculateSafetyScore(segments);
  const warnings = generateWarnings(segments);

  const primaryLeg = route.legs[0];
  const routeInfo = {
    distance: primaryLeg.distance.text,
    duration: primaryLeg.duration.text,
    steps: primaryLeg.steps.map((step) => ({
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

export function analyzeRouteSegments(
  routePoints: RoutePoint[],
  dangerZones: DangerZone[],
  options: SafeRouteOptions,
): RouteSegment[] {
  const segments: RouteSegment[] = [];
  const segmentSize = Math.max(1, Math.floor(routePoints.length / 20));

  for (let index = 0; index < routePoints.length; index += segmentSize) {
    const segmentPoints = routePoints.slice(index, index + segmentSize);
    segments.push(createRouteSegment(segmentPoints, dangerZones, options));
  }

  return segments;
}

export function createRouteSegment(
  points: RoutePoint[],
  dangerZones: DangerZone[],
  options: SafeRouteOptions,
): RouteSegment {
  const distance = calculateSegmentDistance(points);
  const { isDangerous, dangerLevel } = checkDangerousSegment(
    points,
    dangerZones,
    options,
  );
  const isBikePath = checkBikePath(points);
  const safetyScore = calculateSegmentSafetyScore(
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

export function generateWarnings(segments: RouteSegment[]): string[] {
  const warnings: string[] = [];
  const dangerousSegments = segments.filter((segment) => segment.isDangerous);

  if (dangerousSegments.length > 0) {
    warnings.push(
      `ルート上に${dangerousSegments.length}箇所の危険区域があります`,
    );

    const highDangerSegments = dangerousSegments.filter(
      (segment) => segment.dangerLevel === "high",
    );
    if (highDangerSegments.length > 0) {
      warnings.push(
        `特に注意が必要な高危険区域が${highDangerSegments.length}箇所含まれます`,
      );
    }
  }

  const bikePathSegments = segments.filter((segment) => segment.isBikePath);
  const bikePathPercentage =
    segments.length === 0
      ? 0
      : (bikePathSegments.length / segments.length) * 100;

  if (bikePathPercentage < 30) {
    warnings.push("自転車道の利用率が低いルートです。交通量にご注意ください");
  }

  return warnings;
}

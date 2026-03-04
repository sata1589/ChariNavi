import {
  DangerLevel,
  DangerZone,
  RoutePoint,
  RouteSegment,
  SafeRouteOptions,
} from "./types";
import { doesPathIntersectDangerZone } from "../algorithms/detour-generator";

export function getDangerLevelValue(level: DangerLevel): number {
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

export function checkDangerousSegment(
  points: RoutePoint[],
  dangerZones: DangerZone[],
  options: SafeRouteOptions,
): { isDangerous: boolean; dangerLevel?: DangerLevel } {
  let maxDangerLevel: DangerLevel | undefined;
  let isDangerous = false;

  for (const zone of dangerZones) {
    const intersects = doesPathIntersectDangerZone(
      points,
      zone,
      options.dangerZoneBuffer,
    );

    if (intersects) {
      isDangerous = true;
      const severity = zone.severity ?? "medium";
      if (
        !maxDangerLevel ||
        getDangerLevelValue(severity) > getDangerLevelValue(maxDangerLevel)
      ) {
        maxDangerLevel = severity;
      }
    }
  }

  return { isDangerous, dangerLevel: maxDangerLevel };
}

export function calculateSegmentSafetyScore(
  isDangerous: boolean,
  isBikePath: boolean,
  dangerLevel?: DangerLevel,
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
      default:
        score -= 40;
        break;
    }
  }

  if (isBikePath) {
    score += 20;
  }

  return Math.max(0, Math.min(100, score));
}

export function calculateSafetyScore(segments: RouteSegment[]): number {
  const totalDistance = segments.reduce(
    (sum, segment) => sum + segment.distance,
    0,
  );

  if (totalDistance === 0 || segments.length === 0) {
    return 0;
  }

  const weightedScore = segments.reduce((sum, segment) => {
    const weight = segment.distance / totalDistance;
    return sum + segment.safetyScore * weight;
  }, 0);

  return Math.round(weightedScore);
}

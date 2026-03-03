import { SafeRouteOptions } from "./types";

export function getDefaultSafeRouteOptions(): SafeRouteOptions {
  return {
    avoidDangerZones: true,
    preferBikeRoutes: true,
    dangerZoneBuffer: 10,
    maxDetourDistance: 2,
    safetyWeight: 0.7,
    distanceWeight: 0.3,
    shortRouteThresholdKm: 3,
    maxShortRouteDetourRatio: 1.35,
  };
}

export function resolveSafeRouteOptions(
  options?: Partial<SafeRouteOptions>,
): SafeRouteOptions {
  return {
    ...getDefaultSafeRouteOptions(),
    ...options,
  };
}

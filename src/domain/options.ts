import { SafeRouteOptions } from "./types";

export function getDefaultSafeRouteOptions(): SafeRouteOptions {
  return {
    avoidDangerZones: true,
    preferBikeRoutes: true,
    dangerZoneBuffer: 10,
    maxDetourDistance: 2,
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

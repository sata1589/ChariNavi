export {
  calculateSafeRoute,
  createSafeRouteCalculator,
  type CalculateSafeRouteInput,
} from "./core/calculate-safe-route";

export {
  getDefaultSafeRouteOptions,
  resolveSafeRouteOptions,
} from "./domain/options";

export type {
  DangerLevel,
  DangerZone,
  RouteInfo,
  RoutePoint,
  RouteSegment,
  SafeRouteOptions,
  SafeRouteResult,
} from "./domain/types";

export type DangerLevel = "low" | "medium" | "high";

export interface RoutePoint {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RouteInfo {
  distance: string;
  duration: string;
  steps: {
    instruction: string;
    distance: string;
    duration: string;
  }[];
}

export interface DangerZone {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
  title?: string;
  description?: string;
  severity?: DangerLevel;
}

export interface SafeRouteOptions {
  avoidDangerZones: boolean;
  preferBikeRoutes: boolean;
  dangerZoneBuffer: number;
  maxDetourDistance: number;
  safetyWeight: number;
  distanceWeight: number;
  shortRouteThresholdKm: number;
  maxShortRouteDetourRatio: number;
  dangerZones?: DangerZone[];
}

export interface RouteSegment {
  points: RoutePoint[];
  isBikePath: boolean;
  isDangerous: boolean;
  dangerLevel?: DangerLevel;
  distance: number;
  safetyScore: number;
}

export interface SafeRouteResult {
  route: RoutePoint[];
  routeInfo: RouteInfo;
  segments: RouteSegment[];
  safetyScore: number;
  alternativeRoutes?: SafeRouteResult[];
  warnings: string[];
}

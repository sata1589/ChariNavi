type DangerLevel = "low" | "medium" | "high";
interface RoutePoint {
    latitude: number;
    longitude: number;
    address?: string;
}
interface RouteInfo {
    distance: string;
    duration: string;
    steps: {
        instruction: string;
        distance: string;
        duration: string;
    }[];
}
interface DangerZone {
    id: string;
    latitude: number;
    longitude: number;
    radius: number;
    title?: string;
    description?: string;
    severity?: DangerLevel;
}
interface SafeRouteOptions {
    avoidDangerZones: boolean;
    preferBikeRoutes: boolean;
    dangerZoneBuffer: number;
    maxDetourDistance: number;
    dangerZones?: DangerZone[];
}
interface RouteSegment {
    points: RoutePoint[];
    isBikePath: boolean;
    isDangerous: boolean;
    dangerLevel?: DangerLevel;
    distance: number;
    safetyScore: number;
}
interface SafeRouteResult {
    route: RoutePoint[];
    routeInfo: RouteInfo;
    segments: RouteSegment[];
    safetyScore: number;
    alternativeRoutes?: SafeRouteResult[];
    warnings: string[];
}

interface DirectionsClientDeps {
    fetchImpl?: typeof fetch;
}

interface CalculateSafeRouteInput {
    apiKey: string;
    startPoint: RoutePoint;
    endPoint: RoutePoint;
    dangerZones: DangerZone[];
    options?: Partial<SafeRouteOptions>;
}
declare function calculateSafeRoute(input: CalculateSafeRouteInput, deps?: DirectionsClientDeps): Promise<SafeRouteResult>;
declare function createSafeRouteCalculator(apiKey: string, deps?: DirectionsClientDeps): (startPoint: RoutePoint, endPoint: RoutePoint, dangerZones: DangerZone[], options?: Partial<SafeRouteOptions>) => Promise<SafeRouteResult>;

declare function getDefaultSafeRouteOptions(): SafeRouteOptions;
declare function resolveSafeRouteOptions(options?: Partial<SafeRouteOptions>): SafeRouteOptions;

export { type CalculateSafeRouteInput, type DangerLevel, type DangerZone, type RouteInfo, type RoutePoint, type RouteSegment, type SafeRouteOptions, type SafeRouteResult, calculateSafeRoute, createSafeRouteCalculator, getDefaultSafeRouteOptions, resolveSafeRouteOptions };

import { DangerZone, RoutePoint, SafeRouteOptions } from "../domain/types";
import { DirectionsRoute } from "../services/directions-types";

export interface DirectionsBaseParams {
  origin: string;
  destination: string;
  key: string;
  mode: "bicycling";
  language: "ja";
}

export async function generateDetourRoutes(
  startPoint: RoutePoint,
  endPoint: RoutePoint,
  baseParams: DirectionsBaseParams,
  options: SafeRouteOptions,
  fetchRoutes: (params: Record<string, string>) => Promise<DirectionsRoute[]>,
): Promise<DirectionsRoute[]> {
  const detourRoutes: DirectionsRoute[] = [];
  const dangerZones = options.dangerZones ?? [];

  if (dangerZones.length === 0) {
    return detourRoutes;
  }

  for (const zone of dangerZones) {
    const detourPoints = generateDetourPoints(zone, startPoint, endPoint);

    for (const detourPoint of detourPoints) {
      const waypointParams: Record<string, string> = {
        ...baseParams,
        waypoints: `${detourPoint.latitude},${detourPoint.longitude}`,
        alternatives: "false",
      };
      try {
        const routeData = await fetchRoutes(waypointParams);
        detourRoutes.push(...routeData);
      } catch {}
    }
  }

  return detourRoutes;
}

export function generateDetourPoints(
  dangerZone: DangerZone,
  _startPoint: RoutePoint,
  _endPoint: RoutePoint,
): RoutePoint[] {
  const points: RoutePoint[] = [];
  const avoidanceRadius = dangerZone.radius + 200;

  const directions = [
    { lat: 1, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: -1, lng: 0 },
    { lat: 0, lng: -1 },
  ];

  for (const direction of directions) {
    const latOffset = (direction.lat * avoidanceRadius) / 111111;
    const lngOffset =
      (direction.lng * avoidanceRadius) /
      (111111 * Math.cos((dangerZone.latitude * Math.PI) / 180));

    points.push({
      latitude: dangerZone.latitude + latOffset,
      longitude: dangerZone.longitude + lngOffset,
    });
  }

  return points;
}

import {
  buildAvoidanceWaypoints,
  findIntersectedDangerZones,
  formatWaypointsForDirections,
} from "../algorithms/detour-generator";
import { extractRoutePoints } from "../algorithms/polyline";
import { RoutePoint, SafeRouteOptions } from "../domain/types";
import { removeDuplicateRoutes } from "../utils/route-signature";
import { DirectionsApiResponse, DirectionsRoute } from "./directions-types";

export interface DirectionsClientDeps {
  fetchImpl?: typeof fetch;
}

export interface DirectionsClientInput {
  apiKey: string;
  startPoint: RoutePoint;
  endPoint: RoutePoint;
  options: SafeRouteOptions;
}

export async function fetchRoutes(
  params: Record<string, string>,
  deps: DirectionsClientDeps = {},
): Promise<DirectionsRoute[]> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const queryString = new URLSearchParams(params).toString();
  const url = `https://maps.googleapis.com/maps/api/directions/json?${queryString}`;

  const response = await fetchImpl(url);
  const data = (await response.json()) as DirectionsApiResponse;

  if (data.status !== "OK") {
    throw new Error(`Directions API error: ${data.status}`);
  }

  return data.routes ?? [];
}

export async function getMultipleRoutes(
  input: DirectionsClientInput,
  deps: DirectionsClientDeps = {},
): Promise<DirectionsRoute[]> {
  const { apiKey, startPoint, endPoint, options } = input;

  const baseParams: Record<string, string> = {
    origin: `${startPoint.latitude},${startPoint.longitude}`,
    destination: `${endPoint.latitude},${endPoint.longitude}`,
    key: apiKey,
    mode: "bicycling",
    language: "ja",
  };

  const baselineRoutes = await fetchRoutes(
    { ...baseParams, alternatives: "true", avoid: "highways" },
    deps,
  );
  const uniqueBaselineRoutes = removeDuplicateRoutes(baselineRoutes);

  if (uniqueBaselineRoutes.length === 0) {
    throw new Error("ルートを取得できませんでした");
  }

  const baselineRoute = uniqueBaselineRoutes[0];
  if (!baselineRoute) {
    return uniqueBaselineRoutes;
  }

  try {
    const candidateDangerZones = options.dangerZones ?? [];
    const baselinePoints = extractRoutePoints(baselineRoute);
    const intersectedZones = findIntersectedDangerZones(
      baselinePoints,
      candidateDangerZones,
      options.dangerZoneBuffer,
    );

    if (intersectedZones.length === 0) {
      return uniqueBaselineRoutes;
    }

    const waypoints = buildAvoidanceWaypoints(
      startPoint,
      endPoint,
      intersectedZones,
      options.dangerZoneBuffer,
    );

    if (waypoints.length === 0) {
      return uniqueBaselineRoutes;
    }

    const detourRoutes = await fetchRoutes(
      {
        ...baseParams,
        alternatives: "false",
        waypoints: formatWaypointsForDirections(waypoints),
      },
      deps,
    );

    const mergedRoutes = removeDuplicateRoutes([
      ...uniqueBaselineRoutes,
      ...detourRoutes,
    ]);

    if (mergedRoutes.length === 0) {
      throw new Error("ルートを取得できませんでした");
    }

    return mergedRoutes;
  } catch {}

  return uniqueBaselineRoutes;
}

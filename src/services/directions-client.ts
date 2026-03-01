import { generateDetourRoutes } from "../algorithms/detour-generator";
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
  const routes: DirectionsRoute[] = [];

  const baseParams: Record<string, string> = {
    origin: `${startPoint.latitude},${startPoint.longitude}`,
    destination: `${endPoint.latitude},${endPoint.longitude}`,
    key: apiKey,
    mode: "bicycling",
    language: "ja",
  };

  try {
    const standardRoutes = await fetchRoutes(
      { ...baseParams, alternatives: "true" },
      deps,
    );
    routes.push(...standardRoutes);
  } catch {}

  if (options.preferBikeRoutes) {
    try {
      const bikeRoutes = await fetchRoutes(
        { ...baseParams, alternatives: "true", avoid: "highways" },
        deps,
      );
      routes.push(...bikeRoutes);
    } catch {}
  }

  if (options.avoidDangerZones) {
    try {
      const detourRoutes = await generateDetourRoutes(
        startPoint,
        endPoint,
        {
          origin: baseParams.origin,
          destination: baseParams.destination,
          key: baseParams.key,
          mode: "bicycling",
          language: "ja",
        },
        options,
        (params) => fetchRoutes(params, deps),
      );
      routes.push(...detourRoutes);
    } catch {}
  }

  const uniqueRoutes = removeDuplicateRoutes(routes);
  if (uniqueRoutes.length === 0) {
    throw new Error("ルートを取得できませんでした");
  }

  return uniqueRoutes;
}

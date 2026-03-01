import { evaluateRouteSafety } from "../algorithms/route-evaluator";
import { selectSafestRoute } from "../algorithms/route-selector";
import { resolveSafeRouteOptions } from "../domain/options";
import {
  DangerZone,
  RoutePoint,
  SafeRouteOptions,
  SafeRouteResult,
} from "../domain/types";
import {
  DirectionsClientDeps,
  getMultipleRoutes,
} from "../services/directions-client";

export interface CalculateSafeRouteInput {
  apiKey: string;
  startPoint: RoutePoint;
  endPoint: RoutePoint;
  dangerZones: DangerZone[];
  options?: Partial<SafeRouteOptions>;
}

export async function calculateSafeRoute(
  input: CalculateSafeRouteInput,
  deps: DirectionsClientDeps = {},
): Promise<SafeRouteResult> {
  const options = resolveSafeRouteOptions({
    ...input.options,
    dangerZones: input.dangerZones,
  });

  const routeCandidates = await getMultipleRoutes(
    {
      apiKey: input.apiKey,
      startPoint: input.startPoint,
      endPoint: input.endPoint,
      options,
    },
    deps,
  );

  const evaluatedRoutes = routeCandidates.map((route) =>
    evaluateRouteSafety(route, input.dangerZones, options),
  );

  return selectSafestRoute(evaluatedRoutes, options);
}

export function createSafeRouteCalculator(
  apiKey: string,
  deps: DirectionsClientDeps = {},
) {
  return async function runSafeRouteCalculation(
    startPoint: RoutePoint,
    endPoint: RoutePoint,
    dangerZones: DangerZone[],
    options?: Partial<SafeRouteOptions>,
  ): Promise<SafeRouteResult> {
    return calculateSafeRoute(
      {
        apiKey,
        startPoint,
        endPoint,
        dangerZones,
        options,
      },
      deps,
    );
  };
}

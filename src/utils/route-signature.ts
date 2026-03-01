import { DirectionsRoute } from "../services/directions-types";

export function generateRouteSignature(route: DirectionsRoute): string {
  const leg = route.legs?.[0];
  if (!leg) {
    return `${Math.random()}`;
  }

  const start = `${leg.start_location.lat.toFixed(4)},${leg.start_location.lng.toFixed(4)}`;
  const end = `${leg.end_location.lat.toFixed(4)},${leg.end_location.lng.toFixed(4)}`;
  const distance = leg.distance?.value ?? 0;
  const duration = leg.duration?.value ?? 0;

  return `${start}-${end}-${Math.round(distance / 100)}-${Math.round(duration / 60)}`;
}

export function removeDuplicateRoutes(
  routes: DirectionsRoute[],
): DirectionsRoute[] {
  const uniqueRoutes: DirectionsRoute[] = [];
  const seenRoutes = new Set<string>();

  for (const route of routes) {
    const signature = generateRouteSignature(route);
    if (!seenRoutes.has(signature)) {
      seenRoutes.add(signature);
      uniqueRoutes.push(route);
    }
  }

  return uniqueRoutes;
}

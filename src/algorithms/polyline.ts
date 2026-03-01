import { RoutePoint } from "../domain/types";
import { DirectionsRoute } from "../services/directions-types";

export function decodePolyline(
  encoded: string,
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let current: number;
    let shift = 0;
    let result = 0;

    do {
      current = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (current & 0x1f) << shift;
      shift += 5;
    } while (current >= 0x20);

    const dLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dLat;

    shift = 0;
    result = 0;

    do {
      current = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (current & 0x1f) << shift;
      shift += 5;
    } while (current >= 0x20);

    const dLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dLng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

export function extractRoutePoints(route: DirectionsRoute): RoutePoint[] {
  const points: RoutePoint[] = [];

  route.legs.forEach((leg) => {
    leg.steps.forEach((step) => {
      const decoded = decodePolyline(step.polyline.points);
      points.push(
        ...decoded.map((point) => ({
          latitude: point.lat,
          longitude: point.lng,
        })),
      );
    });
  });

  return points;
}

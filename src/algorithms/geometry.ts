import { RoutePoint } from "../domain/types";

export function calculateDistance(
  point1: RoutePoint,
  point2: RoutePoint,
): number {
  const earthRadius = 6371000;
  const lat1Rad = (point1.latitude * Math.PI) / 180;
  const lat2Rad = (point2.latitude * Math.PI) / 180;
  const deltaLatRad = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const deltaLngRad = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLngRad / 2) *
      Math.sin(deltaLngRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadius * c;
}

export function calculateSegmentDistance(points: RoutePoint[]): number {
  let totalDistance = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalDistance += calculateDistance(points[index - 1], points[index]);
  }
  return totalDistance;
}

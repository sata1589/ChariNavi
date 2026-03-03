import { RoutePoint } from "./types";

const BIKE_PATH_KEYWORDS = [
  "自転車道",
  "自転車専用",
  "自転車レーン",
  "自転車通行",
  "サイクリング",
  "cycle",
  "bike",
  "bicycle",
  "greenway",
  "cycleway",
];

export function checkBikePath(points: RoutePoint[]): boolean {
  return points.some((point) => {
    if (!point.address) {
      return false;
    }

    const normalized = point.address.toLowerCase();
    return BIKE_PATH_KEYWORDS.some((keyword) =>
      normalized.includes(keyword.toLowerCase()),
    );
  });
}

import { calculateDistance } from "./geometry";
import { DangerZone, RoutePoint } from "../domain/types";

const EARTH_METERS_PER_DEGREE = 111111;
const DEFAULT_AVOIDANCE_MARGIN_METERS = 20;
const MAX_WAYPOINT_COUNT = 4;

type LocalPoint = {
  x: number;
  y: number;
};

type PathInterference = {
  zone: DangerZone;
  segmentIndex: number;
  projection: LocalPoint;
  segmentDirection: LocalPoint;
};

type SegmentZoneDistance = {
  distance: number;
  projection: LocalPoint;
  segmentDirection: LocalPoint;
};

function toLocal(point: RoutePoint, referenceLatitude: number): LocalPoint {
  return {
    x:
      point.longitude *
      EARTH_METERS_PER_DEGREE *
      Math.cos((referenceLatitude * Math.PI) / 180),
    y: point.latitude * EARTH_METERS_PER_DEGREE,
  };
}

function toRoutePoint(
  local: LocalPoint,
  referenceLatitude: number,
): RoutePoint {
  return {
    latitude: local.y / EARTH_METERS_PER_DEGREE,
    longitude:
      local.x /
      (EARTH_METERS_PER_DEGREE * Math.cos((referenceLatitude * Math.PI) / 180)),
  };
}

function normalizeVector(vector: LocalPoint): LocalPoint {
  const length = Math.hypot(vector.x, vector.y);
  if (length === 0) {
    return { x: 0, y: 0 };
  }
  return {
    x: vector.x / length,
    y: vector.y / length,
  };
}

function distancePointToSegment(
  point: LocalPoint,
  segmentStart: LocalPoint,
  segmentEnd: LocalPoint,
): SegmentZoneDistance {
  const delta = {
    x: segmentEnd.x - segmentStart.x,
    y: segmentEnd.y - segmentStart.y,
  };
  const segmentLengthSquared = delta.x * delta.x + delta.y * delta.y;

  if (segmentLengthSquared === 0) {
    return {
      distance: Math.hypot(point.x - segmentStart.x, point.y - segmentStart.y),
      projection: segmentStart,
      segmentDirection: { x: 1, y: 0 },
    };
  }

  const t =
    ((point.x - segmentStart.x) * delta.x +
      (point.y - segmentStart.y) * delta.y) /
    segmentLengthSquared;
  const clampedT = Math.max(0, Math.min(1, t));

  const projection = {
    x: segmentStart.x + delta.x * clampedT,
    y: segmentStart.y + delta.y * clampedT,
  };

  return {
    distance: Math.hypot(point.x - projection.x, point.y - projection.y),
    projection,
    segmentDirection: normalizeVector(delta),
  };
}

function calculateSegmentZoneDistance(
  segmentStart: RoutePoint,
  segmentEnd: RoutePoint,
  zone: DangerZone,
): SegmentZoneDistance {
  const referenceLatitude = (segmentStart.latitude + segmentEnd.latitude) / 2;
  const startLocal = toLocal(segmentStart, referenceLatitude);
  const endLocal = toLocal(segmentEnd, referenceLatitude);
  const zoneCenter = toLocal(
    {
      latitude: zone.latitude,
      longitude: zone.longitude,
    },
    referenceLatitude,
  );

  return distancePointToSegment(zoneCenter, startLocal, endLocal);
}

export function doesPathIntersectDangerZone(
  pathPoints: RoutePoint[],
  zone: DangerZone,
  dangerZoneBuffer: number,
): boolean {
  const threshold = zone.radius + dangerZoneBuffer;

  if (pathPoints.length === 0) {
    return false;
  }

  if (pathPoints.length === 1) {
    return (
      calculateDistance(pathPoints[0], {
        latitude: zone.latitude,
        longitude: zone.longitude,
      }) <= threshold
    );
  }

  for (let index = 0; index < pathPoints.length - 1; index += 1) {
    const segmentStart = pathPoints[index];
    const segmentEnd = pathPoints[index + 1];
    const { distance } = calculateSegmentZoneDistance(segmentStart, segmentEnd, zone);

    if (distance <= threshold) {
      return true;
    }
  }

  return false;
}

function getFirstPathInterference(
  pathPoints: RoutePoint[],
  dangerZones: DangerZone[],
  dangerZoneBuffer: number,
): PathInterference | undefined {
  for (let index = 0; index < pathPoints.length - 1; index += 1) {
    const segmentStart = pathPoints[index];
    const segmentEnd = pathPoints[index + 1];

    for (const zone of dangerZones) {
      const { distance, projection, segmentDirection } =
        calculateSegmentZoneDistance(segmentStart, segmentEnd, zone);

      if (distance <= zone.radius + dangerZoneBuffer) {
        return {
          zone,
          segmentIndex: index,
          projection,
          segmentDirection,
        };
      }
    }
  }

  return undefined;
}

function countPathIntersections(
  pathPoints: RoutePoint[],
  dangerZones: DangerZone[],
  dangerZoneBuffer: number,
): number {
  let count = 0;

  for (const zone of dangerZones) {
    const intersects = doesPathIntersectDangerZone(
      pathPoints,
      zone,
      dangerZoneBuffer,
    );

    if (intersects) {
      count += 1;
    }
  }

  return count;
}

function estimatePathDistance(pathPoints: RoutePoint[]): number {
  let distance = 0;
  for (let index = 1; index < pathPoints.length; index += 1) {
    distance += calculateDistance(pathPoints[index - 1], pathPoints[index]);
  }
  return distance;
}

function createAvoidanceWaypoint(
  interference: PathInterference,
  side: 1 | -1,
  dangerZoneBuffer: number,
  extraMargin: number,
): RoutePoint {
  const referenceLatitude = interference.zone.latitude;
  const centerLocal = toLocal(
    {
      latitude: interference.zone.latitude,
      longitude: interference.zone.longitude,
    },
    referenceLatitude,
  );

  const radial = normalizeVector({
    x: interference.projection.x - centerLocal.x,
    y: interference.projection.y - centerLocal.y,
  });

  const fallbackRadial = normalizeVector({
    x: -interference.segmentDirection.y,
    y: interference.segmentDirection.x,
  });

  const radialBase =
    radial.x === 0 && radial.y === 0
      ? { x: fallbackRadial.x * side, y: fallbackRadial.y * side }
      : radial;

  const tangent = {
    x: -radialBase.y,
    y: radialBase.x,
  };

  const avoidanceDirection = normalizeVector({
    x: radialBase.x + tangent.x * side,
    y: radialBase.y + tangent.y * side,
  });

  const avoidanceRadius =
    interference.zone.radius +
    dangerZoneBuffer +
    DEFAULT_AVOIDANCE_MARGIN_METERS +
    extraMargin;

  return toRoutePoint(
    {
      x: centerLocal.x + avoidanceDirection.x * avoidanceRadius,
      y: centerLocal.y + avoidanceDirection.y * avoidanceRadius,
    },
    referenceLatitude,
  );
}

function buildWaypointPlan(
  startPoint: RoutePoint,
  endPoint: RoutePoint,
  dangerZones: DangerZone[],
  dangerZoneBuffer: number,
  side: 1 | -1,
): RoutePoint[] {
  const pathPoints: RoutePoint[] = [startPoint, endPoint];
  const zoneRetryCounts = new Map<string, number>();

  for (let iteration = 0; iteration < MAX_WAYPOINT_COUNT; iteration += 1) {
    const interference = getFirstPathInterference(
      pathPoints,
      dangerZones,
      dangerZoneBuffer,
    );

    if (!interference) {
      break;
    }

    const retryCount = zoneRetryCounts.get(interference.zone.id) ?? 0;
    zoneRetryCounts.set(interference.zone.id, retryCount + 1);

    const waypoint = createAvoidanceWaypoint(
      interference,
      side,
      dangerZoneBuffer,
      retryCount * 25,
    );

    pathPoints.splice(interference.segmentIndex + 1, 0, waypoint);
  }

  return pathPoints.slice(1, -1);
}

export function findIntersectedDangerZones(
  routePoints: RoutePoint[],
  dangerZones: DangerZone[],
  dangerZoneBuffer: number,
): DangerZone[] {
  return dangerZones.filter((zone) => {
    return doesPathIntersectDangerZone(routePoints, zone, dangerZoneBuffer);
  });
}

export function buildAvoidanceWaypoints(
  startPoint: RoutePoint,
  endPoint: RoutePoint,
  dangerZones: DangerZone[],
  dangerZoneBuffer: number,
): RoutePoint[] {
  if (dangerZones.length === 0) {
    return [];
  }

  const leftPlan = buildWaypointPlan(
    startPoint,
    endPoint,
    dangerZones,
    dangerZoneBuffer,
    -1,
  );
  const rightPlan = buildWaypointPlan(
    startPoint,
    endPoint,
    dangerZones,
    dangerZoneBuffer,
    1,
  );

  const leftPath = [startPoint, ...leftPlan, endPoint];
  const rightPath = [startPoint, ...rightPlan, endPoint];

  const leftIntersections = countPathIntersections(
    leftPath,
    dangerZones,
    dangerZoneBuffer,
  );
  const rightIntersections = countPathIntersections(
    rightPath,
    dangerZones,
    dangerZoneBuffer,
  );

  if (leftIntersections < rightIntersections) {
    return leftPlan;
  }
  if (rightIntersections < leftIntersections) {
    return rightPlan;
  }

  return estimatePathDistance(leftPath) <= estimatePathDistance(rightPath)
    ? leftPlan
    : rightPlan;
}

export function formatWaypointsForDirections(waypoints: RoutePoint[]): string {
  return waypoints
    .map(
      (point) =>
        `via:${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}`,
    )
    .join("|");
}

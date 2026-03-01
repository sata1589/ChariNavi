// src/algorithms/geometry.ts
function calculateDistance(point1, point2) {
  const earthRadius = 6371e3;
  const lat1Rad = point1.latitude * Math.PI / 180;
  const lat2Rad = point2.latitude * Math.PI / 180;
  const deltaLatRad = (point2.latitude - point1.latitude) * Math.PI / 180;
  const deltaLngRad = (point2.longitude - point1.longitude) * Math.PI / 180;
  const a = Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) + Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLngRad / 2) * Math.sin(deltaLngRad / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
}
function calculateSegmentDistance(points) {
  let totalDistance = 0;
  for (let index = 1; index < points.length; index += 1) {
    totalDistance += calculateDistance(points[index - 1], points[index]);
  }
  return totalDistance;
}

// src/domain/safety-rules.ts
function getDangerLevelValue(level) {
  switch (level) {
    case "low":
      return 1;
    case "medium":
      return 2;
    case "high":
      return 3;
    default:
      return 2;
  }
}
function checkDangerousSegment(points, dangerZones, options) {
  let maxDangerLevel;
  let isDangerous = false;
  for (const point of points) {
    for (const zone of dangerZones) {
      const distance = calculateDistance(point, {
        latitude: zone.latitude,
        longitude: zone.longitude
      });
      if (distance <= zone.radius + options.dangerZoneBuffer) {
        isDangerous = true;
        const severity = zone.severity ?? "medium";
        if (!maxDangerLevel || getDangerLevelValue(severity) > getDangerLevelValue(maxDangerLevel)) {
          maxDangerLevel = severity;
        }
      }
    }
  }
  return { isDangerous, dangerLevel: maxDangerLevel };
}
function calculateSegmentSafetyScore(isDangerous, isBikePath, dangerLevel) {
  let score = 100;
  if (isDangerous) {
    switch (dangerLevel) {
      case "low":
        score -= 20;
        break;
      case "medium":
        score -= 40;
        break;
      case "high":
        score -= 60;
        break;
      default:
        score -= 40;
        break;
    }
  }
  if (isBikePath) {
    score += 20;
  }
  return Math.max(0, Math.min(100, score));
}
function calculateSafetyScore(segments) {
  const totalDistance = segments.reduce(
    (sum, segment) => sum + segment.distance,
    0
  );
  if (totalDistance === 0 || segments.length === 0) {
    return 0;
  }
  const weightedScore = segments.reduce((sum, segment) => {
    const weight = segment.distance / totalDistance;
    return sum + segment.safetyScore * weight;
  }, 0);
  return Math.round(weightedScore);
}

// src/domain/bike-path.ts
function checkBikePath(_points) {
  return false;
}

// src/algorithms/polyline.ts
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let current;
    let shift = 0;
    let result = 0;
    do {
      current = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (current & 31) << shift;
      shift += 5;
    } while (current >= 32);
    const dLat = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lat += dLat;
    shift = 0;
    result = 0;
    do {
      current = encoded.charCodeAt(index) - 63;
      index += 1;
      result |= (current & 31) << shift;
      shift += 5;
    } while (current >= 32);
    const dLng = (result & 1) !== 0 ? ~(result >> 1) : result >> 1;
    lng += dLng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
function extractRoutePoints(route) {
  const points = [];
  route.legs.forEach((leg) => {
    leg.steps.forEach((step) => {
      const decoded = decodePolyline(step.polyline.points);
      points.push(
        ...decoded.map((point) => ({
          latitude: point.lat,
          longitude: point.lng
        }))
      );
    });
  });
  return points;
}

// src/algorithms/route-evaluator.ts
function evaluateRouteSafety(route, dangerZones, options) {
  const routePoints = extractRoutePoints(route);
  const segments = analyzeRouteSegments(routePoints, dangerZones, options);
  const safetyScore = calculateSafetyScore(segments);
  const warnings = generateWarnings(segments);
  const primaryLeg = route.legs[0];
  const routeInfo = {
    distance: primaryLeg.distance.text,
    duration: primaryLeg.duration.text,
    steps: primaryLeg.steps.map((step) => ({
      instruction: step.html_instructions.replace(/<[^>]*>/g, ""),
      distance: step.distance.text,
      duration: step.duration.text
    }))
  };
  return {
    route: routePoints,
    routeInfo,
    segments,
    safetyScore,
    warnings
  };
}
function analyzeRouteSegments(routePoints, dangerZones, options) {
  const segments = [];
  const segmentSize = Math.max(1, Math.floor(routePoints.length / 20));
  for (let index = 0; index < routePoints.length; index += segmentSize) {
    const segmentPoints = routePoints.slice(index, index + segmentSize);
    segments.push(createRouteSegment(segmentPoints, dangerZones, options));
  }
  return segments;
}
function createRouteSegment(points, dangerZones, options) {
  const distance = calculateSegmentDistance(points);
  const { isDangerous, dangerLevel } = checkDangerousSegment(
    points,
    dangerZones,
    options
  );
  const isBikePath = checkBikePath(points);
  const safetyScore = calculateSegmentSafetyScore(
    isDangerous,
    isBikePath,
    dangerLevel
  );
  return {
    points,
    isBikePath,
    isDangerous,
    dangerLevel,
    distance,
    safetyScore
  };
}
function generateWarnings(segments) {
  const warnings = [];
  const dangerousSegments = segments.filter((segment) => segment.isDangerous);
  if (dangerousSegments.length > 0) {
    warnings.push(
      `\u30EB\u30FC\u30C8\u4E0A\u306B${dangerousSegments.length}\u7B87\u6240\u306E\u5371\u967A\u533A\u57DF\u304C\u3042\u308A\u307E\u3059`
    );
    const highDangerSegments = dangerousSegments.filter(
      (segment) => segment.dangerLevel === "high"
    );
    if (highDangerSegments.length > 0) {
      warnings.push(
        `\u7279\u306B\u6CE8\u610F\u304C\u5FC5\u8981\u306A\u9AD8\u5371\u967A\u533A\u57DF\u304C${highDangerSegments.length}\u7B87\u6240\u542B\u307E\u308C\u307E\u3059`
      );
    }
  }
  const bikePathSegments = segments.filter((segment) => segment.isBikePath);
  const bikePathPercentage = segments.length === 0 ? 0 : bikePathSegments.length / segments.length * 100;
  if (bikePathPercentage < 30) {
    warnings.push("\u81EA\u8EE2\u8ECA\u9053\u306E\u5229\u7528\u7387\u304C\u4F4E\u3044\u30EB\u30FC\u30C8\u3067\u3059\u3002\u4EA4\u901A\u91CF\u306B\u3054\u6CE8\u610F\u304F\u3060\u3055\u3044");
  }
  return warnings;
}

// src/algorithms/route-selector.ts
function calculateTotalScore(route) {
  const safetyWeight = 0.7;
  const distanceWeight = 0.3;
  const distanceValue = Number.parseFloat(
    route.routeInfo.distance.replace(/[^\d.]/g, "")
  );
  const distanceScore = Math.max(0, 100 - distanceValue * 10);
  return route.safetyScore * safetyWeight + distanceScore * distanceWeight;
}
function selectSafestRoute(routes, _options) {
  if (routes.length === 0) {
    throw new Error("\u9078\u629E\u53EF\u80FD\u306A\u30EB\u30FC\u30C8\u304C\u3042\u308A\u307E\u305B\u3093");
  }
  const safestRoutes = routes.filter(
    (route) => !route.segments.some((segment) => segment.isDangerous)
  );
  let candidateRoutes = safestRoutes.length > 0 ? safestRoutes : routes;
  if (safestRoutes.length === 0) {
    const lowToMediumDangerRoutes = routes.filter(
      (route) => !route.segments.some((segment) => segment.dangerLevel === "high")
    );
    if (lowToMediumDangerRoutes.length > 0) {
      candidateRoutes = lowToMediumDangerRoutes;
    }
  }
  const scoredRoutes = candidateRoutes.map((route) => ({
    ...route,
    totalScore: calculateTotalScore(route),
    hasDangerousSegments: route.segments.some((segment) => segment.isDangerous),
    dangerousSegmentCount: route.segments.filter(
      (segment) => segment.isDangerous
    ).length
  }));
  const bestRoute = scoredRoutes.reduce((best, current) => {
    if (!current.hasDangerousSegments && best.hasDangerousSegments) {
      return current;
    }
    if (current.hasDangerousSegments && !best.hasDangerousSegments) {
      return best;
    }
    if (current.hasDangerousSegments && best.hasDangerousSegments) {
      if (current.dangerousSegmentCount < best.dangerousSegmentCount) {
        return current;
      }
      if (current.dangerousSegmentCount > best.dangerousSegmentCount) {
        return best;
      }
    }
    return current.totalScore > best.totalScore ? current : best;
  });
  const alternatives = scoredRoutes.filter((route) => route !== bestRoute).sort((left, right) => right.totalScore - left.totalScore).slice(0, 2);
  return {
    ...bestRoute,
    alternativeRoutes: alternatives.map((alternative) => ({
      route: alternative.route,
      routeInfo: alternative.routeInfo,
      segments: alternative.segments,
      safetyScore: alternative.safetyScore,
      warnings: alternative.warnings
    }))
  };
}

// src/domain/options.ts
function getDefaultSafeRouteOptions() {
  return {
    avoidDangerZones: true,
    preferBikeRoutes: true,
    dangerZoneBuffer: 10,
    maxDetourDistance: 2
  };
}
function resolveSafeRouteOptions(options) {
  return {
    ...getDefaultSafeRouteOptions(),
    ...options
  };
}

// src/algorithms/detour-generator.ts
async function generateDetourRoutes(startPoint, endPoint, baseParams, options, fetchRoutes2) {
  const detourRoutes = [];
  const dangerZones = options.dangerZones ?? [];
  if (dangerZones.length === 0) {
    return detourRoutes;
  }
  for (const zone of dangerZones) {
    const detourPoints = generateDetourPoints(zone, startPoint, endPoint);
    for (const detourPoint of detourPoints) {
      const waypointParams = {
        ...baseParams,
        waypoints: `${detourPoint.latitude},${detourPoint.longitude}`,
        alternatives: "false"
      };
      try {
        const routeData = await fetchRoutes2(waypointParams);
        detourRoutes.push(...routeData);
      } catch {
      }
    }
  }
  return detourRoutes;
}
function generateDetourPoints(dangerZone, _startPoint, _endPoint) {
  const points = [];
  const avoidanceRadius = dangerZone.radius + 200;
  const directions = [
    { lat: 1, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: -1, lng: 0 },
    { lat: 0, lng: -1 }
  ];
  for (const direction of directions) {
    const latOffset = direction.lat * avoidanceRadius / 111111;
    const lngOffset = direction.lng * avoidanceRadius / (111111 * Math.cos(dangerZone.latitude * Math.PI / 180));
    points.push({
      latitude: dangerZone.latitude + latOffset,
      longitude: dangerZone.longitude + lngOffset
    });
  }
  return points;
}

// src/utils/route-signature.ts
function generateRouteSignature(route) {
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
function removeDuplicateRoutes(routes) {
  const uniqueRoutes = [];
  const seenRoutes = /* @__PURE__ */ new Set();
  for (const route of routes) {
    const signature = generateRouteSignature(route);
    if (!seenRoutes.has(signature)) {
      seenRoutes.add(signature);
      uniqueRoutes.push(route);
    }
  }
  return uniqueRoutes;
}

// src/services/directions-client.ts
async function fetchRoutes(params, deps = {}) {
  const fetchImpl = deps.fetchImpl ?? fetch;
  const queryString = new URLSearchParams(params).toString();
  const url = `https://maps.googleapis.com/maps/api/directions/json?${queryString}`;
  const response = await fetchImpl(url);
  const data = await response.json();
  if (data.status !== "OK") {
    throw new Error(`Directions API error: ${data.status}`);
  }
  return data.routes ?? [];
}
async function getMultipleRoutes(input, deps = {}) {
  const { apiKey, startPoint, endPoint, options } = input;
  const routes = [];
  const baseParams = {
    origin: `${startPoint.latitude},${startPoint.longitude}`,
    destination: `${endPoint.latitude},${endPoint.longitude}`,
    key: apiKey,
    mode: "bicycling",
    language: "ja"
  };
  try {
    const standardRoutes = await fetchRoutes(
      { ...baseParams, alternatives: "true" },
      deps
    );
    routes.push(...standardRoutes);
  } catch {
  }
  if (options.preferBikeRoutes) {
    try {
      const bikeRoutes = await fetchRoutes(
        { ...baseParams, alternatives: "true", avoid: "highways" },
        deps
      );
      routes.push(...bikeRoutes);
    } catch {
    }
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
          language: "ja"
        },
        options,
        (params) => fetchRoutes(params, deps)
      );
      routes.push(...detourRoutes);
    } catch {
    }
  }
  const uniqueRoutes = removeDuplicateRoutes(routes);
  if (uniqueRoutes.length === 0) {
    throw new Error("\u30EB\u30FC\u30C8\u3092\u53D6\u5F97\u3067\u304D\u307E\u305B\u3093\u3067\u3057\u305F");
  }
  return uniqueRoutes;
}

// src/core/calculate-safe-route.ts
async function calculateSafeRoute(input, deps = {}) {
  const options = resolveSafeRouteOptions({
    ...input.options,
    dangerZones: input.dangerZones
  });
  const routeCandidates = await getMultipleRoutes(
    {
      apiKey: input.apiKey,
      startPoint: input.startPoint,
      endPoint: input.endPoint,
      options
    },
    deps
  );
  const evaluatedRoutes = routeCandidates.map(
    (route) => evaluateRouteSafety(route, input.dangerZones, options)
  );
  return selectSafestRoute(evaluatedRoutes, options);
}
function createSafeRouteCalculator(apiKey, deps = {}) {
  return async function runSafeRouteCalculation(startPoint, endPoint, dangerZones, options) {
    return calculateSafeRoute(
      {
        apiKey,
        startPoint,
        endPoint,
        dangerZones,
        options
      },
      deps
    );
  };
}
export {
  calculateSafeRoute,
  createSafeRouteCalculator,
  getDefaultSafeRouteOptions,
  resolveSafeRouteOptions
};

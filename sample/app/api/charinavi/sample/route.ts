import { calculateSafeRoute } from "charinavi";
import type { DangerZone, RoutePoint } from "charinavi";
import { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { DEFAULT_DANGER_ZONES } from "../../../../config/danger-zones";

type SampleRouteRequest = {
  startPoint?: RoutePoint;
  endPoint?: RoutePoint;
};

function isValidPoint(value: RoutePoint | undefined): value is RoutePoint {
  return (
    !!value &&
    Number.isFinite(value.latitude) &&
    Number.isFinite(value.longitude)
  );
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "APIキーが未設定です。.env の GOOGLE_MAPS_API_KEY を設定してください。",
      },
      { status: 400 },
    );
  }

  let body: SampleRouteRequest;
  try {
    body = (await request.json()) as SampleRouteRequest;
  } catch {
    return NextResponse.json(
      {
        ok: false,
        message: "入力形式が不正です。",
      },
      { status: 400 },
    );
  }

  if (!isValidPoint(body.startPoint) || !isValidPoint(body.endPoint)) {
    return NextResponse.json(
      {
        ok: false,
        message: "現在地・目的地の緯度経度を正しく入力してください。",
      },
      { status: 400 },
    );
  }

  try {
    const result = await calculateSafeRoute({
      apiKey,
      startPoint: body.startPoint,
      endPoint: body.endPoint,
      dangerZones: DEFAULT_DANGER_ZONES,
      options: {
        avoidDangerZones: true,
        preferBikeRoutes: true,
        dangerZoneBuffer: 20,
        maxDetourDistance: 2,
      },
    });

    return NextResponse.json({
      ok: true,
      safetyScore: result.safetyScore,
      routeInfo: result.routeInfo,
      route: result.route,
      startPoint: body.startPoint,
      endPoint: body.endPoint,
      dangerZones: DEFAULT_DANGER_ZONES,
      warningCount: result.warnings.length,
      alternativeCount: result.alternativeRoutes?.length ?? 0,
      routePointCount: result.route.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        message: error instanceof Error ? error.message : "unknown error",
      },
      { status: 500 },
    );
  }
}

import { getDefaultSafeRouteOptions } from "charinavi";
import { NextResponse } from "next/server";

export async function GET() {
  const options = getDefaultSafeRouteOptions();

  return NextResponse.json({
    ok: true,
    message: "charinavi import success",
    defaultOptions: options,
    now: new Date().toISOString(),
  });
}

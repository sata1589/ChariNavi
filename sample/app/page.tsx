"use client";

import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";

type RoutePoint = {
  latitude: number;
  longitude: number;
};

type DangerZone = {
  id: string;
  latitude: number;
  longitude: number;
  radius: number;
};

type SampleResult = {
  ok: boolean;
  message?: string;
  route?: RoutePoint[];
  startPoint?: RoutePoint;
  endPoint?: RoutePoint;
  dangerZones?: DangerZone[];
};

let googleMapsConfigured = false;

async function loadGoogleMaps(apiKey: string): Promise<any> {
  if (!googleMapsConfigured) {
    setOptions({ key: apiKey });
    googleMapsConfigured = true;
  }

  await importLibrary("maps");
  return (window as any).google.maps;
}

export default function Home() {
  const [startLat, setStartLat] = useState("");
  const [startLng, setStartLng] = useState("");
  const [endLat, setEndLat] = useState("35.658034");
  const [endLng, setEndLng] = useState("139.701636");
  const [message, setMessage] = useState(
    "現在地と目的地を入力して検索してください。",
  );
  const [loading, setLoading] = useState(false);
  const [nextPickTarget, setNextPickTarget] = useState<"start" | "end">(
    "start",
  );

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const routePolylineRef = useRef<any>(null);
  const startMarkerRef = useRef<any>(null);
  const endMarkerRef = useRef<any>(null);
  const dangerCircleRefs = useRef<any[]>([]);
  const nextPickTargetRef = useRef<"start" | "end">("start");

  useEffect(() => {
    nextPickTargetRef.current = nextPickTarget;
  }, [nextPickTarget]);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !mapContainerRef.current) {
      return;
    }

    let disposed = false;

    const initializeMap = async () => {
      try {
        const googleMaps = await loadGoogleMaps(apiKey);
        if (disposed || !mapContainerRef.current || mapRef.current) {
          return;
        }

        mapRef.current = new googleMaps.Map(mapContainerRef.current, {
          center: { lat: 35.681236, lng: 139.767125 },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
        });

        mapRef.current.addListener("click", (event: any) => {
          const lat = event?.latLng?.lat?.();
          const lng = event?.latLng?.lng?.();
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
            return;
          }

          if (nextPickTargetRef.current === "start") {
            setStartLat(String(lat));
            setStartLng(String(lng));

            if (startMarkerRef.current) {
              startMarkerRef.current.setMap(null);
            }
            startMarkerRef.current = new googleMaps.Marker({
              position: { lat, lng },
              map: mapRef.current,
              title: "現在地",
            });

            setNextPickTarget("end");
            setMessage(
              "現在地をセットしました。次に目的地をクリックしてください。",
            );
            return;
          }

          setEndLat(String(lat));
          setEndLng(String(lng));

          if (endMarkerRef.current) {
            endMarkerRef.current.setMap(null);
          }
          endMarkerRef.current = new googleMaps.Marker({
            position: { lat, lng },
            map: mapRef.current,
            title: "目的地",
          });

          setNextPickTarget("start");
          setMessage("目的地をセットしました。ルート検索を実行してください。");
        });
      } catch {
        setMessage("地図の初期化に失敗しました。");
      }
    };

    void initializeMap();

    return () => {
      disposed = true;
    };
  }, []);

  const clearMapObjects = () => {
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null);
    }
    if (startMarkerRef.current) {
      startMarkerRef.current.setMap(null);
    }
    if (endMarkerRef.current) {
      endMarkerRef.current.setMap(null);
    }
    dangerCircleRefs.current.forEach((circle) => circle.setMap(null));
    dangerCircleRefs.current = [];
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      setMessage("このブラウザでは現在地取得が利用できません。");
      return;
    }

    setMessage("現在地を取得しています...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStartLat(String(position.coords.latitude));
        setStartLng(String(position.coords.longitude));
        setMessage("現在地をセットしました。");
      },
      () => {
        setMessage("現在地を取得できませんでした。");
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
      },
    );
  };

  const searchRoute = async () => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      setMessage(
        ".env の NEXT_PUBLIC_GOOGLE_MAPS_API_KEY を設定してください。",
      );
      return;
    }

    const startPoint = {
      latitude: Number(startLat),
      longitude: Number(startLng),
    };
    const endPoint = {
      latitude: Number(endLat),
      longitude: Number(endLng),
    };

    if (
      !Number.isFinite(startPoint.latitude) ||
      !Number.isFinite(startPoint.longitude) ||
      !Number.isFinite(endPoint.latitude) ||
      !Number.isFinite(endPoint.longitude)
    ) {
      setMessage("緯度経度を正しく入力してください。");
      return;
    }

    setLoading(true);
    setMessage("ルートを検索しています...");

    try {
      const response = await fetch("/api/charinavi/sample", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ startPoint, endPoint }),
      });
      const data = (await response.json()) as SampleResult;

      if (!data.ok) {
        setMessage(data.message ?? "ルート取得に失敗しました。");
        return;
      }

      const route = data.route ?? [];
      if (
        !data.startPoint ||
        !data.endPoint ||
        route.length < 2 ||
        !mapContainerRef.current
      ) {
        setMessage("ルートデータが不足しています。");
        return;
      }

      const googleMaps = await loadGoogleMaps(apiKey);
      const toLatLng = (point: RoutePoint) => ({
        lat: point.latitude,
        lng: point.longitude,
      });

      if (!mapRef.current) {
        mapRef.current = new googleMaps.Map(mapContainerRef.current, {
          center: toLatLng(data.startPoint),
          zoom: 13,
          mapTypeControl: false,
          streetViewControl: false,
        });
      }

      clearMapObjects();

      routePolylineRef.current = new googleMaps.Polyline({
        path: route.map(toLatLng),
        geodesic: true,
        strokeColor: "#2563EB",
        strokeOpacity: 0.95,
        strokeWeight: 6,
      });
      routePolylineRef.current.setMap(mapRef.current);

      startMarkerRef.current = new googleMaps.Marker({
        position: toLatLng(data.startPoint),
        map: mapRef.current,
        title: "現在地",
      });

      endMarkerRef.current = new googleMaps.Marker({
        position: toLatLng(data.endPoint),
        map: mapRef.current,
        title: "目的地",
      });

      dangerCircleRefs.current = (data.dangerZones ?? []).map((zone) => {
        const circle = new googleMaps.Circle({
          center: { lat: zone.latitude, lng: zone.longitude },
          radius: zone.radius,
          strokeColor: "#DC2626",
          strokeOpacity: 0.85,
          strokeWeight: 2,
          fillColor: "#F87171",
          fillOpacity: 0.2,
        });
        circle.setMap(mapRef.current);
        return circle;
      });

      const bounds = new googleMaps.LatLngBounds();
      route.forEach((point) => bounds.extend(toLatLng(point)));
      mapRef.current.fitBounds(bounds);

      setMessage("ルートを表示しました。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "ルート検索に失敗しました。",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-4 px-6 py-6">
      <div className="grid gap-3 rounded-md border p-4 md:grid-cols-2">
        <p className="text-sm md:col-span-2">
          地図をクリックして現在地・目的地を選択できます（現在:{" "}
          {nextPickTarget === "start" ? "現在地" : "目的地"}）。
        </p>
        <label className="text-sm">
          現在地 緯度
          <input
            value={startLat}
            onChange={(event) => setStartLat(event.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="35.681236"
          />
        </label>
        <label className="text-sm">
          現在地 経度
          <input
            value={startLng}
            onChange={(event) => setStartLng(event.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="139.767125"
          />
        </label>
        <label className="text-sm">
          目的地 緯度
          <input
            value={endLat}
            onChange={(event) => setEndLat(event.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="35.658034"
          />
        </label>
        <label className="text-sm">
          目的地 経度
          <input
            value={endLng}
            onChange={(event) => setEndLng(event.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="139.701636"
          />
        </label>
        <div className="flex gap-2 md:col-span-2">
          <button
            type="button"
            onClick={getCurrentLocation}
            className="rounded border px-3 py-2 text-sm"
          >
            現在地を取得
          </button>
          <button
            type="button"
            onClick={searchRoute}
            disabled={loading}
            className="rounded border px-3 py-2 text-sm disabled:opacity-60"
          >
            {loading ? "検索中..." : "ルート検索"}
          </button>
        </div>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p>
      <div
        ref={mapContainerRef}
        className="h-[75vh] w-full rounded-md border"
      />
    </main>
  );
}

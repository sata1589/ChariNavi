import type { DangerZone } from "charinavi";

export const DEFAULT_DANGER_ZONES: DangerZone[] = [
  {
    id: "zone-1",
    latitude: 35.692437381899744,
    longitude: 139.7649125659299,
    radius: 20,
    severity: "high",
    title: "渋谷駅前スクランブル交差点周辺",
  },
  {
    id: "zone-2",
    latitude: 35.6938,
    longitude: 139.6993,
    radius: 10,
    severity: "high",
    title: "新宿大ガード交差点周辺",
  },
  {
    id: "zone-3",
    latitude: 35.6917,
    longitude: 139.765,
    radius: 10,
    severity: "high",
    title: "神田橋交差点周辺",
  },
  {
    id: "zone-4",
    latitude: 35.6804,
    longitude: 139.769,
    radius: 10,
    severity: "medium",
    title: "大手町交差点周辺",
  },
  {
    id: "zone-5",
    latitude: 35.6655,
    longitude: 139.7519,
    radius: 10,
    severity: "high",
    title: "虎ノ門交差点周辺",
  },
  {
    id: "zone-6",
    latitude: 35.6854,
    longitude: 139.7528,
    radius: 10,
    severity: "medium",
    title: "半蔵門交差点周辺",
  },
];

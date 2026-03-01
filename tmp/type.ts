export interface RoutePoint {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface RouteInfo {
  distance: string;
  duration: string;
  steps: {
    instruction: string;
    distance: string;
    duration: string;
  }[];
}

export interface DangerZone {
  id: string;
  latitude: number;
  longitude: number;
  radius: number; // メートル単位
  title?: string;
  description?: string;
  severity?: "low" | "medium" | "high";
}

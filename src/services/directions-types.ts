export interface DirectionsLocation {
  lat: number;
  lng: number;
}

export interface DirectionsValueText {
  text: string;
  value: number;
}

export interface DirectionsStep {
  html_instructions: string;
  distance: DirectionsValueText;
  duration: DirectionsValueText;
  polyline: {
    points: string;
  };
}

export interface DirectionsLeg {
  start_location: DirectionsLocation;
  end_location: DirectionsLocation;
  distance: DirectionsValueText;
  duration: DirectionsValueText;
  steps: DirectionsStep[];
}

export interface DirectionsRoute {
  legs: DirectionsLeg[];
}

export interface DirectionsApiResponse {
  status: string;
  routes?: DirectionsRoute[];
}

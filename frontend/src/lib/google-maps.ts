import { useJsApiLoader, type Libraries } from "@react-google-maps/api";

const GOOGLE_MAPS_LIBRARIES: Libraries = ["visualization", "places"];
const GOOGLE_MAPS_LOADER_ID = "nexus-google-maps";

export const useNexusGoogleMapsLoader = () => {
  const apiKey = import.meta.env.VITE_GMAPS_KEY || "";
  return useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: apiKey,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });
};

export { GOOGLE_MAPS_LIBRARIES, GOOGLE_MAPS_LOADER_ID };

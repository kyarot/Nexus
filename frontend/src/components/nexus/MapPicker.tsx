import React, { useState, useCallback, useEffect, useRef } from "react";
import { Circle, GoogleMap, Marker } from "@react-google-maps/api";
import { MapPin, Navigation, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNexusGoogleMapsLoader } from "@/lib/google-maps";

const containerStyle = {
  width: "100%",
  height: "100%"
};

const defaultCenter = {
  lat: 12.9716,
  lng: 77.5946
};

interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
  pincode?: string;
  areaName?: string;
  city?: string;
}

interface MapPickerProps {
  onLocationSelect: (location: MapLocation) => void;
  initialLocation?: { lat: number, lng: number };
  radiusMeters?: number;
}

export const MapPicker = ({ onLocationSelect, initialLocation, radiusMeters }: MapPickerProps) => {
  const { isLoaded } = useNexusGoogleMapsLoader();

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [markerPosition, setMarkerPosition] = useState(initialLocation || defaultCenter);
  const [isLocating, setIsLocating] = useState(false);
  const hasAutoLocated = useRef(false);

  const reverseGeocode = useCallback((lat: number, lng: number) => {
    const geocoder = new google.maps.Geocoder();
    const latlng = { lat, lng };

    geocoder.geocode({ location: latlng }, (results, status) => {
      if (status === "OK" && results?.[0]) {
        const address = results[0].formatted_address;
        let pincode = "";
        let areaName = "";
        let city = "";
        
        // Extract pincode from address components
        for (const component of results[0].address_components) {
          if (component.types.includes("postal_code")) {
            pincode = component.long_name;
          }

          if (!areaName && (
            component.types.includes("sublocality_level_1") ||
            component.types.includes("sublocality") ||
            component.types.includes("neighborhood")
          )) {
            areaName = component.long_name;
          }

          if (!city && component.types.includes("locality")) {
            city = component.long_name;
          }

          if (!city && component.types.includes("administrative_area_level_2")) {
            city = component.long_name;
          }
        }

        if (!areaName) {
          const fallback = results[0].address_components.find((component) =>
            component.types.includes("administrative_area_level_2") ||
            component.types.includes("administrative_area_level_3")
          );
          areaName = fallback?.long_name || "";
        }

        if (!city) {
          const fallback = results[0].address_components.find((component) =>
            component.types.includes("administrative_area_level_1")
          );
          city = fallback?.long_name || "";
        }

        onLocationSelect({ lat, lng, address, pincode, areaName, city });
      } else {
        onLocationSelect({ lat, lng });
      }
    });
  }, [onLocationSelect]);

  const onLoad = useCallback(function callback(m: google.maps.Map) {
    setMap(m);
  }, []);

  const onUnmount = useCallback(function callback(m: google.maps.Map) {
    setMap(null);
  }, []);

  const handleMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      reverseGeocode(lat, lng);
    }
  }, [reverseGeocode]);

  const handleMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (e.latLng) {
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPosition({ lat, lng });
      reverseGeocode(lat, lng);
    }
  }, [reverseGeocode]);

  const getCurrentLocation = () => {
    setIsLocating(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMarkerPosition({ lat, lng });
          reverseGeocode(lat, lng);
          map?.panTo({ lat, lng });
          setIsLocating(false);
        },
        (error) => {
          console.error("Error fetching location", error);
          alert("Could not fetch current location. Please allow location permissions.");
          setIsLocating(false);
        }
      );
    } else {
        alert("Geolocation is not supported by your browser.");
        setIsLocating(false);
    }
  };

  useEffect(() => {
    if (!isLoaded || hasAutoLocated.current || !navigator.geolocation) return;

    hasAutoLocated.current = true;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setMarkerPosition({ lat, lng });
        reverseGeocode(lat, lng);
        map?.panTo({ lat, lng });
      },
      () => {
        // Keep the initial marker if permission is denied or unavailable.
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [isLoaded, map, reverseGeocode]);

  if (!isLoaded) {
    return (
      <div className="w-full h-full bg-slate-100 flex items-center justify-center animate-pulse rounded-2xl">
         <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-200">
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={markerPosition}
        zoom={15}
        onLoad={onLoad}
        onUnmount={onUnmount}
        onClick={handleMapClick}
        options={{
          disableDefaultUI: true,
          zoomControl: true,
          styles: [
            {
              featureType: "poi",
              elementType: "labels",
              stylers: [{ visibility: "off" }]
            }
          ]
        }}
      >
        <Marker
          position={markerPosition}
          draggable={true}
          onDragEnd={handleMarkerDragEnd}
          animation={google.maps.Animation.DROP}
        />
        {typeof radiusMeters === "number" && radiusMeters > 0 ? (
          <Circle
            center={markerPosition}
            radius={radiusMeters}
            options={{
              fillColor: "#4F46E5",
              fillOpacity: 0.12,
              strokeColor: "#4F46E5",
              strokeOpacity: 0.5,
              strokeWeight: 2,
            }}
          />
        ) : null}
      </GoogleMap>

      <div className="absolute bottom-4 left-4 right-4 flex gap-2">
        <Button 
          onClick={getCurrentLocation}
          disabled={isLocating}
          className="flex-1 h-10 bg-white hover:bg-slate-50 text-[#1A1A3D] font-bold shadow-lg border-none rounded-xl"
        >
          {isLocating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Navigation className="w-4 h-4 mr-2 text-[#5A57FF]" />}
          Current Location
        </Button>
      </div>

      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-sm border border-slate-100">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
          <MapPin className="w-3 h-3 text-red-500" /> Click or drag pin to select
        </p>
      </div>
    </div>
  );
};

import { Loader } from "@googlemaps/js-api-loader";
import { predefinedAreas } from '../constants/predefinedAreas';
import { API_KEY } from '../constants/google';
import type { Location, GoogleLatLng } from '../types';

declare const google: any;

const MAX_RETRIES = 20;

class GoogleMapsService {
    private svService: any;
    private isLoaded = false;

    async load() {
 	     if (this.isLoaded) return true;
 	     if (!API_KEY) return false;
 	     try {
 	         // FIX: Use importLibrary instead of load() to fix TS error and use modern API
 	         const loader = new Loader({ apiKey: API_KEY, version: "weekly" });
 	         
 	         // Fix: Cast loader to any to access importLibrary which might be missing in current type definitions
 	         await Promise.all([
 	             (loader as any).importLibrary("maps"),
 	             (loader as any).importLibrary("geometry"),
 	             (loader as any).importLibrary("marker"),
 	             (loader as any).importLibrary("streetView")
 	         ]);

 	         this.svService = new google.maps.StreetViewService();
 	         this.isLoaded = true;
 	         return true;
 	     } catch (error) {
 	         console.error("Failed to load Google Maps:", error);
 	         return false;
 	     }
 	 }

    async getRandomLocation(): Promise<Location> {
        if (!this.svService) {
            throw new Error("Street View Service not initialized.");
        }
        for (let i = 0; i < MAX_RETRIES; i++) {
            const area = predefinedAreas[Math.floor(Math.random() * predefinedAreas.length)];
            const lat = area.latRange[0] + Math.random() * (area.latRange[1] - area.latRange[0]);
            const lng = area.lngRange[0] + Math.random() * (area.lngRange[1] - area.lngRange[0]);
            const location = { lat, lng };

            const { data, status } = await new Promise<{ data: any; status: string }>((resolve) => {
                this.svService.getPanorama({ location, radius: 50000, source: 'outdoor' }, (data: any, status: string) => {
                    resolve({ data, status });
                });
            });
            
            if (status === "OK" && data.location?.latLng && data.copyright) {
                const latLng = data.location.latLng;
                return { lat: latLng.lat(), lng: latLng.lng() };
            }
        }
        throw new Error("Could not find a valid Street View location after multiple attempts.");
    }

    calculateDistance(pos1: GoogleLatLng, pos2: GoogleLatLng): number {
        if (!this.isLoaded) {
            throw new Error("Google Maps Geometry library not loaded.");
        }
        return google.maps.geometry.spherical.computeDistanceBetween(pos1, pos2) / 1000;
    }
}

export const googleMapsService = new GoogleMapsService();
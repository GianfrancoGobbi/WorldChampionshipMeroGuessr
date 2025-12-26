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
            const loader = new Loader({
                apiKey: API_KEY,
                version: "weekly",
                libraries: ["geometry", "places"]
            });

            await Promise.all([
                (loader as any).importLibrary("maps"),
                (loader as any).importLibrary("marker"),
                (loader as any).importLibrary("streetView"),
                (loader as any).importLibrary("visualization")
            ]);

            this.svService = new google.maps.StreetViewService();
            this.isLoaded = true;
            return true;
        } catch (error) {
            console.error("Failed to load Google Maps:", error);
            return false;
        }
    }

    async getRandomLocationInRegions(regions: { lat: number; lng: number; radius: number }[]): Promise<Location> {
        if (!this.svService) {
            throw new Error("Street View Service not initialized.");
        }
        for (let i = 0; i < MAX_RETRIES * 2; i++) {
            const region = regions[Math.floor(Math.random() * regions.length)];

            const r = region.radius / 111320; // 111.32km per degree
            const y0 = region.lat;
            const x0 = region.lng;
            const u = Math.random();
            const v = Math.random();
            const w = r * Math.sqrt(u);
            const t = 2 * Math.PI * v;
            const x = w * Math.cos(t);
            const y = w * Math.sin(t);

            const xp = x / Math.cos(y0 * Math.PI / 180);

            const location = { lat: y + y0, lng: xp + x0 };

            const { data, status } = await new Promise<{ data: any; status: string }>((resolve) => {
                this.svService.getPanorama({ location, radius: region.radius, source: 'outdoor' }, (data: any, status: string) => {
                    resolve({ data, status });
                });
            });

            if (status === "OK" && data.location?.latLng) {
                const latLng = data.location.latLng;
                return { lat: latLng.lat(), lng: latLng.lng() };
            }
        }
        throw new Error("Could not find a valid Street View location in the specified regions.");
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

    calculateMaxDistanceInRegions(regions: { lat: number; lng: number; radius: number }[]): number {
        if (regions.length === 0) return 0;
        let maxDist = 0;

        // Compare all pairs of regions
        for (let i = 0; i < regions.length; i++) {
            for (let j = i; j < regions.length; j++) {
                const p1 = { lat: regions[i].lat, lng: regions[i].lng };
                const p2 = { lat: regions[j].lat, lng: regions[j].lng };

                const centerDist = i === j ? 0 : this.calculateDistance(p1 as any, p2 as any);
                // Max distance between two points in these two circles is dist(centers) + r1 + r2
                const totalDist = centerDist + (regions[i].radius / 1000) + (regions[j].radius / 1000);

                if (totalDist > maxDist) {
                    maxDist = totalDist;
                }
            }
        }
        return maxDist;
    }

    calculateDistance(pos1: GoogleLatLng, pos2: GoogleLatLng): number {
        if (!this.isLoaded) {
            throw new Error("Google Maps Geometry library not loaded.");
        }
        return google.maps.geometry.spherical.computeDistanceBetween(pos1, pos2) / 1000;
    }
}

export const googleMapsService = new GoogleMapsService();
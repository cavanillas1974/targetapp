import { SiteRecord } from '../types';

const API_KEY = (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY || '';

// Cache simple en memoria para evitar llamadas redundantes
const geocodeCache: Record<string, { lat: number, lng: number }> = {};
const matrixCache: Record<string, { distance: number, duration: number }> = {};

export const googleMapsService = {
    /**
     * Obtiene coordenadas desde una dirección
     */
    async geocode(address: string): Promise<{ lat: number, lng: number, place_id?: string, formatted_address?: string, partial_match?: boolean } | null> {
        if (!API_KEY) {
            console.warn("Google Maps API Key no encontrada. Usando modo simulado.");
            return null;
        }

        if (geocodeCache[address]) return geocodeCache[address] as any;

        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                const location = {
                    lat: result.geometry.location.lat,
                    lng: result.geometry.location.lng,
                    place_id: result.place_id,
                    formatted_address: result.formatted_address,
                    partial_match: result.partial_match === true
                };
                geocodeCache[address] = location;
                return location;
            }
            return null;
        } catch (error) {
            console.error("Geocoding error:", error);
            return null;
        }
    },

    /**
     * Valida que las coordenadas correspondan a la ciudad/estado (Geocodificación Inversa)
     */
    async reverseGeocode(lat: number, lng: number): Promise<{ city?: string, state?: string } | null> {
        if (!API_KEY) return null;
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                let city, state;

                for (const component of result.address_components) {
                    if (component.types.includes('locality')) city = component.long_name;
                    if (component.types.includes('administrative_area_level_1')) state = component.long_name;
                }

                return { city, state };
            }
            return null;
        } catch (error) {
            console.error("Reverse Geocoding error:", error);
            return null;
        }
    },

    /**
     * Optimiza el orden de paradas de una ruta (TSP)
     * Usa Directions API con optimize:true
     */
    async optimizeWaypointOrder(
        origin: { lat: number, lng: number },
        sites: SiteRecord[]
    ): Promise<SiteRecord[]> {
        if (!API_KEY || sites.length === 0) {
            console.warn("API Key no disponible o sin sitios. Regresando orden original.");
            return sites;
        }

        // Directions API tiene un límite de 23 waypoints para el plan estándar
        // Si hay más, deberíamos usar Route Optimization API o partir la ruta.
        const MAX_WAYPOINTS = 23;
        const processSites = sites.slice(0, MAX_WAYPOINTS);

        try {
            const waypoints = processSites.map(s => `${s.lat},${s.lng}`).join('|');
            const originStr = `${origin.lat},${origin.lng}`;

            const response = await fetch(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${originStr}&waypoints=optimize:true|${waypoints}&key=${API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.routes.length > 0) {
                const order = data.routes[0].waypoint_order; // Array de índices
                const optimizedSites = order.map((idx: number) => processSites[idx]);

                // Si teníamos más de 23, agregamos los sobrantes al final (aunque no estén optimizados por Google)
                return [...optimizedSites, ...sites.slice(MAX_WAYPOINTS)];
            }
            return sites;
        } catch (error) {
            console.error("Route optimization error:", error);
            return sites;
        }
    },

    /**
     * Obtiene distancia y tiempo real por carretera entre dos puntos
     */
    async getDistanceMatrix(origin: { lat: number, lng: number }, destination: { lat: number, lng: number }) {
        const key = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`;
        if (matrixCache[key]) return matrixCache[key];

        if (!API_KEY) {
            return { distance: 10, duration: 20 }; // Simulado
        }

        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
                const result = {
                    distance: data.rows[0].elements[0].distance.value / 1000, // Km
                    duration: data.rows[0].elements[0].duration.value / 60, // Minutos
                };
                matrixCache[key] = result;
                return result;
            }
            return null;
        } catch (error) {
            console.error("Distance Matrix error:", error);
            return null;
        }
    },

    /**
     * Obtiene distancia y duración real de una ruta completa
     */
    async getRouteDistance(origin: { lat: number, lng: number }, stops: SiteRecord[], returnToOrigin: boolean = true): Promise<{ distance: number, duration: number } | null> {
        if (!API_KEY || stops.length === 0) return null;

        try {
            const waypoints = stops.map(s => `${s.lat},${s.lng}`).join('|');
            const originStr = `${origin.lat},${origin.lng}`;
            const destStr = returnToOrigin ? originStr : `${stops[stops.length - 1].lat},${stops[stops.length - 1].lng}`;

            const response = await fetch(
                `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&waypoints=${waypoints}&key=${API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.routes.length > 0) {
                const route = data.routes[0];
                let totalDistance = 0;
                let totalDuration = 0;

                route.legs.forEach((leg: any) => {
                    totalDistance += leg.distance.value;
                    totalDuration += leg.duration.value;
                });

                return {
                    distance: totalDistance / 1000, // Km
                    duration: totalDuration / 60 // Minutos
                };
            }
            return null;
        } catch (error) {
            console.error("Route distance calculation error:", error);
            return null;
        }
    }
};

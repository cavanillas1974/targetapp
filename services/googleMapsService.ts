import { SiteRecord, AddressStatus } from '../types';
import { LogicEngine } from '../LogicEngine';

const getApiKey = () => {
    return (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '';
};

// Cache simple en memoria para evitar llamadas redundantes
const geocodeCache: Record<string, { lat: number, lng: number }> = {};
const matrixCache: Record<string, { distance: number, duration: number }> = {};

export const googleMapsService = {
    /**
     * Obtiene coordenadas desde una dirección CON INFORMACIÓN DE PRECISIÓN
     */
    async geocode(address: string): Promise<{
        lat: number,
        lng: number,
        place_id?: string,
        formatted_address?: string,
        partial_match?: boolean,
        location_type?: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE',
        precision_meters?: number
    } | null> {
        const key = getApiKey();
        if (!key) {
            console.warn("Google Maps API Key no encontrada. USANDO MODO SIMULADO (AntiGravity Fallback).");
            // Generamos coordenadas aleatorias en un radio de la CDMX para que la lógica de ruteo funcione
            return {
                lat: 19.4326 + (Math.random() - 0.5) * 2.0, // Radio amplio en México
                lng: -99.1332 + (Math.random() - 0.5) * 2.0,
                formatted_address: address + " (UBICACIÓN ESTIMADA / SIMULADA)",
                partial_match: true,
                location_type: 'APPROXIMATE',
                precision_meters: 1000
            };
        }

        if (geocodeCache[address]) return geocodeCache[address] as any;

        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${getApiKey()}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                const geometry = result.geometry;

                // Calcular precisión estimada basada en location_type
                let precision_meters = 100;
                switch (geometry.location_type) {
                    case 'ROOFTOP':
                        precision_meters = 5;
                        break;
                    case 'RANGE_INTERPOLATED':
                        precision_meters = 10;
                        break;
                    case 'GEOMETRIC_CENTER':
                        precision_meters = 50;
                        break;
                    case 'APPROXIMATE':
                    default:
                        precision_meters = 100;
                        break;
                }

                const location = {
                    lat: result.geometry.location.lat,
                    lng: result.geometry.location.lng,
                    place_id: result.place_id,
                    formatted_address: result.formatted_address,
                    partial_match: result.partial_match === true,
                    location_type: geometry.location_type,
                    precision_meters
                };

                // Log de precisión para debugging
                if (precision_meters > 50) {
                    console.warn(`⚠️ Baja precisión (±${precision_meters}m) para: ${address.substring(0, 50)}...`);
                } else if (precision_meters <= 10) {
                    console.log(`✅ Alta precisión (±${precision_meters}m): ${address.substring(0, 50)}...`);
                }

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
        if (!getApiKey()) return null;
        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${getApiKey()}`
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
        if (!getApiKey() || sites.length === 0) {
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
                `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${originStr}&waypoints=optimize:true|${waypoints}&key=${getApiKey()}`
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
        const key_cache = `${origin.lat},${origin.lng}-${destination.lat},${destination.lng}`;
        if (matrixCache[key_cache]) return matrixCache[key_cache];

        if (!getApiKey()) {
            // Factor de corrección: 1 grado ~ 111km
            const latDiff = Math.abs(origin.lat - destination.lat);
            const lngDiff = Math.abs(origin.lng - destination.lng);
            const dist = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff) * 111;
            return { distance: dist, duration: dist * 1.5 + 10 };
        }

        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin.lat},${origin.lng}&destinations=${destination.lat},${destination.lng}&key=${getApiKey()}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
                const result = {
                    distance: data.rows[0].elements[0].distance.value / 1000, // Km
                    duration: data.rows[0].elements[0].duration.value / 60, // Minutos
                };
                matrixCache[key_cache] = result;
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
    /**
     * Obtiene distancia y duración real de una ruta completa
     * Maneja automáticamente la paginación para rutas con >25 waypoints
     */
    async getRouteDistance(origin: { lat: number, lng: number }, stops: SiteRecord[], returnToOrigin: boolean = true): Promise<{ distance: number, duration: number } | null> {
        if (!getApiKey() || stops.length === 0) {
            // Fallback: usar calculo haversine simple de LogicEngine
            if (stops.length > 0) {
                const distance = LogicEngine.estimateRouteDistance(origin, stops, returnToOrigin);
                return { distance, duration: distance * 1.5 + (stops.length * 60) };
            }
            return null;
        }

        try {
            // Google Directions API soporta max 25 waypoints (1 origin + 1 dest + 23 waypoints)
            // Dividimos el viaje en "legs" de max 23 waypoints intermedios
            const CHUNK_SIZE = 23;
            let totalDistance = 0;
            let totalDuration = 0;
            let currentOrigin = origin;

            // Procesar en lotes
            for (let i = 0; i < stops.length; i += CHUNK_SIZE) {
                const chunk = stops.slice(i, i + CHUNK_SIZE);
                const isLastChunk = i + CHUNK_SIZE >= stops.length;

                // El destino de este chunk es el último punto del chunk
                // Si es el último chunk y returnToOrigin es true, el destino final es el origen
                // PERO Directions API calcula A -> B -> C.
                // Para chaining: 
                // Chunk 1: Origin -> [w1...w22] -> w23 (Destino del chunk)
                // Chunk 2: w23 (Nuevo Origin) -> [w24...w46] -> w47

                const destination = chunk[chunk.length - 1];
                const waypoints = chunk.slice(0, chunk.length - 1).map(s => `${s.lat},${s.lng}`).join('|');

                const originStr = `${currentOrigin.lat},${currentOrigin.lng}`;
                const destStr = `${destination.lat},${destination.lng}`;

                const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}${waypoints ? `&waypoints=${waypoints}` : ''}&key=${getApiKey()}`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK' && data.routes.length > 0) {
                    const route = data.routes[0];
                    route.legs.forEach((leg: any) => {
                        totalDistance += leg.distance.value;
                        totalDuration += leg.duration.value;
                    });
                } else {
                    console.warn(`Partial route chunk failed: ${data.status}`);
                }

                // Actualizar origen para el siguiente loop
                currentOrigin = { lat: destination.lat!, lng: destination.lng! };
            }

            // Si hay retorno a base, calcular la última pierna: Último Store -> Origen Inicial
            if (returnToOrigin) {
                const lastStore = stops[stops.length - 1];
                const originStr = `${lastStore.lat},${lastStore.lng}`;
                const destStr = `${origin.lat},${origin.lng}`;
                const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&key=${getApiKey()}`;
                const response = await fetch(url);
                const data = await response.json();
                if (data.status === 'OK' && data.routes.length > 0) {
                    totalDistance += data.routes[0].legs[0].distance.value;
                    totalDuration += data.routes[0].legs[0].duration.value;
                }
            }

            return {
                distance: totalDistance / 1000, // Km
                duration: totalDuration / 60 // Minutos
            };

        } catch (error) {
            console.error("Route distance calculation error:", error);
            // Fallback en error
            const distance = LogicEngine.estimateRouteDistance(origin, stops, returnToOrigin);
            return { distance, duration: distance * 1.5 };
        }
    }
};

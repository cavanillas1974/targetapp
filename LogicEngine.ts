import { SiteRecord, AddressStatus, ProjectCapacity, CapacityStatus, Depot, PlannerConfig, ProgressionMode } from './types';

export const LogicEngine = {
    /**
     * Normaliza una dirección eliminando caracteres especiales y abreviaturas comunes.
     */
    normalizeAddress(raw: string): string {
        if (!raw) return '';
        let clean = raw.trim()
            .replace(/\s+/g, ' ')
            .replace(/[#]/g, '')
            .replace(/S\/N/gi, 'SIN NUMERO');

        // Paso 2: Limpieza y FULL_ADDRESS
        // trim, dobles espacios ya están arriba
        return clean;
    },

    /**
     * Construye la dirección completa para geocodificación.
     * FULL_ADDRESS = DIRECCION_COMPLETA + ", " + Colonia + ", " + Alcaldia_Municipio + ", " + Estado + ", " + CP + ", México"
     */
    deriveFullAddress(site: Partial<SiteRecord>): string {
        return `${site.direccion_completa || ''}, ${site.colonia || ''}, ${site.municipio || site.city || ''}, ${site.state || ''}, ${site.cp || ''}, México`.replace(/, ,/g, ',').trim();
    },

    /**
     * Calcula la distancia haversine entre dos puntos.
     */
    calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const R = 6371;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    },

    /**
     * Calcula distancia total estimada de una ruta (Haversine)
     */
    estimateRouteDistance(origin: { lat: number, lng: number }, stops: SiteRecord[], returnToOrigin: boolean): number {
        if (stops.length === 0) return 0;
        let total = 0;
        let currentPos = origin;

        for (const stop of stops) {
            total += this.calculateDistance(currentPos.lat, currentPos.lng, stop.lat!, stop.lng!);
            currentPos = { lat: stop.lat!, lng: stop.lng! };
        }

        if (returnToOrigin) {
            total += this.calculateDistance(currentPos.lat, currentPos.lng, origin.lat, origin.lng);
        }

        return total * 1.3; // Factor de corrección vial simple (30%)
    },

    /**
     * Calcula el rumbo (bearing) entre dos puntos en grados (0-360).
     */
    calculateBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δλ = (lng2 - lng1) * Math.PI / 180;

        const y = Math.sin(Δλ) * Math.cos(φ2);
        const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
        const θ = Math.atan2(y, x);
        return (θ * 180 / Math.PI + 360) % 360;
    },

    /**
     * Calcula la capacidad del proyecto.
     */
    calculateProjectCapacity(sitesCount: number, config: PlannerConfig, routesTotal: number): ProjectCapacity {
        const start = new Date(config.startDate + 'T00:00:00');
        const end = new Date(config.endDate + 'T23:59:59');


        let workingDaysCount = 0;
        let cur = new Date(start);
        while (cur <= end) {
            // Hard rule: Domingos nunca se trabajan
            if (cur.getDay() !== 0) workingDaysCount++;
            cur.setDate(cur.getDate() + 1);
        }
        workingDaysCount = Math.max(workingDaysCount, 1);

        const totalCapacity = routesTotal * workingDaysCount * config.stopsPerDayPerRoute;
        const unassignedStores = Math.max(0, sitesCount - totalCapacity);
        const extraRoutesNeeded = Math.ceil((sitesCount - totalCapacity) / (workingDaysCount * config.stopsPerDayPerRoute));

        return {
            status: totalCapacity >= sitesCount ? CapacityStatus.SUFFICIENT : CapacityStatus.INSUFFICIENT,
            workingDaysCount,
            totalRoutes: routesTotal,
            totalCapacity,
            totalStores: sitesCount,
            unassignedStores,
            extraRoutesNeeded: Math.max(0, extraRoutesNeeded)
        };
    },

    /**
     * Paso 7 — Asignar tiendas a cuadrillas (automático, sin locks)
     * Ordenar por bearing asc, dist asc y repartir en N bloques.
     */
    assignToRoutes(sites: SiteRecord[], routes_total: number, origin: { lat: number, lng: number }): SiteRecord[][] {
        if (sites.length === 0 || routes_total <= 0) return [];

        const sorted = [...sites].map(s => {
            return {
                ...s,
                _bearing: this.calculateBearing(origin.lat, origin.lng, s.lat!, s.lng!),
                _dist: this.calculateDistance(origin.lat, origin.lng, s.lat!, s.lng!)
            };
        }).sort((a, b) => {
            if (a._bearing !== b._bearing) return a._bearing - b._bearing;
            return a._dist - b._dist;
        });

        const result: SiteRecord[][] = Array.from({ length: routes_total }, () => []);

        // Repartir en bloques balanceados
        const blockSize = Math.ceil(sorted.length / routes_total);
        for (let i = 0; i < routes_total; i++) {
            result[i] = sorted.slice(i * blockSize, (i + 1) * blockSize);
        }

        return result;
    },

    /**
     * Paso 8 — Secuencia dentro de cada cuadrilla (tienda más cercana sucesiva)
     */
    sequenceRoute(sites: SiteRecord[], origin: { lat: number, lng: number }): SiteRecord[] {
        if (sites.length === 0) return [];
        const unvisited = [...sites];
        const ordered: SiteRecord[] = [];
        let currentPos = origin;

        while (unvisited.length > 0) {
            unvisited.sort((a, b) => {
                const dA = this.calculateDistance(currentPos.lat, currentPos.lng, a.lat!, a.lng!);
                const dB = this.calculateDistance(currentPos.lat, currentPos.lng, b.lat!, b.lng!);
                return dA - dB;
            });

            const next = unvisited.shift()!;
            ordered.push(next);
            currentPos = { lat: next.lat!, lng: next.lng! };
        }

        return ordered.map((s, idx) => ({ ...s, sequence: idx + 1 }));
    }
};

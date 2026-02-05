/**
 * ===============================================
 * ANTIGRAVITY CORRIDOR ROUTE ENGINE
 * ===============================================
 * Motor de generación de rutas por corredores geográficos.
 * 
 * REGLAS CORE:
 * 1. Rutas ilimitadas en paralelo por continuidad geográfica (corredores/rumbos)
 * 2. Hub configurable por ruta (default CDMX)
 * 3. Todas las rutas inician el mismo día
 * 4. Avance continuo sin regreso al hub
 * 5. Pernocta cerca de la siguiente tienda (no regresar a ciudades grandes)
 * 6. Sin mezcla de regiones opuestas, sin zig-zag
 */

import { SiteRecord, AddressStatus } from '../types';
import { LogicEngine } from '../LogicEngine';
import { googleMapsService } from './googleMapsService';

// ============ INTERFACES ============

export interface Hub {
    id: string;
    name: string;
    lat: number;
    lng: number;
    city: string;
}

export interface GeographicCorridor {
    id: string;
    name: string;
    region: string;
    direction: 'NORTH' | 'SOUTH' | 'EAST' | 'WEST' | 'CENTER' | 'NORTHEAST' | 'NORTHWEST' | 'SOUTHEAST' | 'SOUTHWEST';
    bearingMin: number; // Grados mínimo del corredor
    bearingMax: number; // Grados máximo del corredor
    centerLat: number;
    centerLng: number;
    majorCities: string[]; // Ciudades principales en este corredor
}

export interface CorridorRoute {
    id: string;
    corridorId: string;
    corridorName: string;
    hub: Hub;
    direction: string;
    stores: SiteRecord[];
    scheduledDays: ScheduledDay[];
    totalKm: number;
    totalDays: number;
    startDate: string;
    endDate: string;
    color: string;
}

export interface ScheduledDay {
    dayNumber: number;
    date: string;
    stores: ScheduledStore[];
    overnightLocation: OvernightLocation | null;
    kmTotal: number;
    minutesTravel: number;
    minutesService: number;
    minutesTotal: number;
    startPoint: { lat: number; lng: number; name: string };
    endPoint: { lat: number; lng: number; name: string };
}

export interface ScheduledStore extends SiteRecord {
    store_job_id: string;
    stopInDay: number;
    dayInProject: number;
    sequenceInRoute: number;
    estimatedArrivalTime?: string;
    kmFromPrevious?: number;
    minutesFromPrevious?: number;
}

export interface OvernightLocation {
    name: string;
    lat: number;
    lng: number;
    nearestCity: string;
    distanceToNextStore: number; // km
    reason: string;
}

// ============ REGIONES Y CORREDORES DE MÉXICO ============

export const MEXICAN_CORRIDORS: GeographicCorridor[] = [
    // NORTE
    {
        id: 'MTY',
        name: 'Corredor Monterrey',
        region: 'NORTE',
        direction: 'NORTH',
        bearingMin: 350,
        bearingMax: 30,
        centerLat: 25.6866,
        centerLng: -100.3161,
        majorCities: ['Monterrey', 'Saltillo', 'San Luis Potosí', 'Querétaro', 'Aguascalientes']
    },
    {
        id: 'TIJ',
        name: 'Corredor Tijuana/Baja',
        region: 'NOROESTE',
        direction: 'NORTHWEST',
        bearingMin: 290,
        bearingMax: 340,
        centerLat: 32.5149,
        centerLng: -117.0382,
        majorCities: ['Tijuana', 'Mexicali', 'Ensenada', 'Hermosillo', 'Los Cabos']
    },
    {
        id: 'CUL',
        name: 'Corredor Sinaloa/Pacifico Norte',
        region: 'NOROESTE',
        direction: 'NORTHWEST',
        bearingMin: 300,
        bearingMax: 350,
        centerLat: 24.8091,
        centerLng: -107.3940,
        majorCities: ['Culiacán', 'Mazatlán', 'Los Mochis', 'Durango', 'Chihuahua']
    },
    // BAJÍO / CENTRO-OCCIDENTE
    {
        id: 'GDL',
        name: 'Corredor Guadalajara/Bajío',
        region: 'OCCIDENTE',
        direction: 'WEST',
        bearingMin: 260,
        bearingMax: 300,
        centerLat: 20.6597,
        centerLng: -103.3496,
        majorCities: ['Guadalajara', 'León', 'Zapopan', 'Morelia', 'Aguascalientes', 'Irapuato', 'Celaya']
    },
    // SUR
    {
        id: 'OAX',
        name: 'Corredor Oaxaca/Sur',
        region: 'SUR',
        direction: 'SOUTH',
        bearingMin: 150,
        bearingMax: 200,
        centerLat: 17.0732,
        centerLng: -96.7266,
        majorCities: ['Oaxaca', 'Tuxtla Gutiérrez', 'Huatulco', 'Salina Cruz']
    },
    {
        id: 'ACA',
        name: 'Corredor Acapulco/Costa Pacífico Sur',
        region: 'SUR',
        direction: 'SOUTHWEST',
        bearingMin: 200,
        bearingMax: 250,
        centerLat: 16.8531,
        centerLng: -99.8237,
        majorCities: ['Acapulco', 'Chilpancingo', 'Zihuatanejo', 'Lázaro Cárdenas']
    },
    // SURESTE / CARIBE
    {
        id: 'MER',
        name: 'Corredor Mérida/Península',
        region: 'SURESTE',
        direction: 'SOUTHEAST',
        bearingMin: 70,
        bearingMax: 120,
        centerLat: 20.9674,
        centerLng: -89.5926,
        majorCities: ['Mérida', 'Campeche', 'Ciudad del Carmen', 'Chetumal']
    },
    {
        id: 'CUN',
        name: 'Corredor Cancún/Riviera Maya',
        region: 'CARIBE',
        direction: 'EAST',
        bearingMin: 60,
        bearingMax: 100,
        centerLat: 21.1619,
        centerLng: -86.8515,
        majorCities: ['Cancún', 'Playa del Carmen', 'Tulum', 'Cozumel', 'Isla Mujeres']
    },
    {
        id: 'VER',
        name: 'Corredor Veracruz/Golfo',
        region: 'GOLFO',
        direction: 'EAST',
        bearingMin: 80,
        bearingMax: 130,
        centerLat: 19.1738,
        centerLng: -96.1342,
        majorCities: ['Veracruz', 'Xalapa', 'Coatzacoalcos', 'Poza Rica', 'Villahermosa']
    },
    // CENTRO
    {
        id: 'CDMX',
        name: 'Zona Metropolitana CDMX',
        region: 'CENTRO',
        direction: 'CENTER',
        bearingMin: 0,
        bearingMax: 360,
        centerLat: 19.4326,
        centerLng: -99.1332,
        majorCities: ['Ciudad de México', 'Toluca', 'Cuernavaca', 'Puebla', 'Pachuca', 'Tlaxcala']
    },
    {
        id: 'PUE',
        name: 'Corredor Puebla/Centro-Este',
        region: 'CENTRO',
        direction: 'EAST',
        bearingMin: 90,
        bearingMax: 140,
        centerLat: 19.0414,
        centerLng: -98.2063,
        majorCities: ['Puebla', 'Tlaxcala', 'Tehuacán', 'Atlixco']
    }
];

// HUBS POR DEFECTO (bases de operación)
export const DEFAULT_HUBS: Hub[] = [
    { id: 'HUB_CDMX', name: 'Ciudad de México', lat: 19.4326, lng: -99.1332, city: 'CDMX' },
    { id: 'HUB_MTY', name: 'Monterrey', lat: 25.6866, lng: -100.3161, city: 'Monterrey' },
    { id: 'HUB_GDL', name: 'Guadalajara', lat: 20.6597, lng: -103.3496, city: 'Guadalajara' },
    { id: 'HUB_TIJ', name: 'Tijuana', lat: 32.5149, lng: -117.0382, city: 'Tijuana' },
    { id: 'HUB_MER', name: 'Mérida', lat: 20.9674, lng: -89.5926, city: 'Mérida' },
    { id: 'HUB_CUN', name: 'Cancún', lat: 21.1619, lng: -86.8515, city: 'Cancún' },
    { id: 'HUB_VER', name: 'Veracruz', lat: 19.1738, lng: -96.1342, city: 'Veracruz' },
    { id: 'HUB_CUL', name: 'Culiacán', lat: 24.8091, lng: -107.3940, city: 'Culiacán' }
];

// CIUDADES PRINCIPALES PARA PERNOCTA
export const OVERNIGHT_CITIES = [
    { name: 'Querétaro', lat: 20.5888, lng: -100.3899 },
    { name: 'San Luis Potosí', lat: 22.1565, lng: -100.9855 },
    { name: 'Aguascalientes', lat: 21.8818, lng: -102.2916 },
    { name: 'León', lat: 21.1250, lng: -101.6859 },
    { name: 'Morelia', lat: 19.7060, lng: -101.1950 },
    { name: 'Toluca', lat: 19.2826, lng: -99.6557 },
    { name: 'Puebla', lat: 19.0414, lng: -98.2063 },
    { name: 'Cuernavaca', lat: 18.9242, lng: -99.2216 },
    { name: 'Pachuca', lat: 20.1011, lng: -98.7591 },
    { name: 'Xalapa', lat: 19.5438, lng: -96.9102 },
    { name: 'Oaxaca', lat: 17.0732, lng: -96.7266 },
    { name: 'Villahermosa', lat: 17.9890, lng: -92.9475 },
    { name: 'Tuxtla Gutiérrez', lat: 16.7569, lng: -93.1292 },
    { name: 'Saltillo', lat: 25.4267, lng: -100.9792 },
    { name: 'Torreón', lat: 25.5428, lng: -103.4068 },
    { name: 'Chihuahua', lat: 28.6353, lng: -106.0889 },
    { name: 'Hermosillo', lat: 29.0729, lng: -110.9559 },
    { name: 'Durango', lat: 24.0277, lng: -104.6532 },
    { name: 'Mazatlán', lat: 23.2494, lng: -106.4111 },
    { name: 'Tepic', lat: 21.5085, lng: -104.8945 },
    { name: 'Colima', lat: 19.2433, lng: -103.7250 },
    { name: 'Campeche', lat: 19.8301, lng: -90.5349 },
    { name: 'Chetumal', lat: 18.5001, lng: -88.2961 }
];

// ============ MOTOR PRINCIPAL ============

export const CorridorRouteEngine = {

    /**
     * PASO PRINCIPAL: Genera rutas por corredores geográficos
     */
    async generateCorridorRoutes(
        stores: SiteRecord[],
        config: {
            startDate: string;
            stopsPerDay: number;
            avgServiceMinutes: number;
            bufferMinutes: number;
            defaultHub?: Hub;
            workDays?: number[]; // 0=Domingo, 1=Lunes, etc. Default: [1,2,3,4,5,6] (L-S)
        }
    ): Promise<CorridorRoute[]> {
        console.log('🚀 ANTIGRAVITY: Iniciando motor de corredores geográficos...');
        console.log(`📦 Tiendas totales: ${stores.length}`);

        // 1. Filtrar tiendas programables (con coordenadas válidas)
        const validStores = stores.filter(s =>
            s.lat && s.lng &&
            (s.status === AddressStatus.OK || s.status === AddressStatus.WARNING)
        );
        console.log(`✅ Tiendas válidas para ruteo: ${validStores.length}`);

        // 2. Asignar cada tienda a su corredor geográfico
        const storesByCorrdor = this.assignStoresToCorridors(validStores, config.defaultHub || DEFAULT_HUBS[0]);

        // 3. Generar ruta por cada corredor que tenga tiendas
        const routes: CorridorRoute[] = [];
        const routeColors = [
            '#2298E0', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899',
            '#06b6d4', '#f97316', '#14b8a6', '#6366f1', '#a855f7', '#d946ef',
            '#84cc16', '#22d3ee', '#fb7185', '#a78bfa', '#fbbf24', '#34d399'
        ];

        let routeIndex = 0;
        const corridorEntries = Object.entries(storesByCorrdor) as [string, SiteRecord[]][];
        for (const [corridorId, corridorStores] of corridorEntries) {
            if (corridorStores.length === 0) continue;

            const corridor = MEXICAN_CORRIDORS.find(c => c.id === corridorId);
            if (!corridor) continue;

            console.log(`\n📍 Procesando corredor: ${corridor.name} (${corridorStores.length} tiendas)`);

            // Determinar hub para esta ruta
            const routeHub = this.selectHubForCorridor(corridor, config.defaultHub);

            // Secuenciar tiendas (avance continuo sin zig-zag)
            const sequencedStores = this.sequenceStoresForCorridor(corridorStores, routeHub, corridor);

            // Generar cronograma por días
            const scheduledDays = await this.generateDaySchedule(
                sequencedStores,
                routeHub,
                config.startDate,
                config.stopsPerDay,
                config.avgServiceMinutes,
                config.bufferMinutes,
                config.workDays || [1, 2, 3, 4, 5, 6] // L-S por defecto
            );

            const totalKm = scheduledDays.reduce((acc, d) => acc + d.kmTotal, 0);
            const lastDay = scheduledDays[scheduledDays.length - 1];
            const firstStore = sequencedStores[0];
            const lastStore = sequencedStores[sequencedStores.length - 1];

            // Calcular retorno a base (CDMX/Hub) para completar el ciclo logístico
            const distReturn = LogicEngine.calculateDistance(
                lastStore.lat!, lastStore.lng!,
                routeHub.lat, routeHub.lng
            ) * 1.3;

            // Debug: Verificar primer tramo
            if (scheduledDays.length > 0 && scheduledDays[0].stores.length > 0) {
                const firstS = scheduledDays[0].stores[0];
                const startDist = LogicEngine.calculateDistance(routeHub.lat, routeHub.lng, firstS.lat!, firstS.lng!);
                console.log(`🛣️ RUTA ${corridor.name}:`);
                console.log(`   - Inicio (Hub): ${routeHub.name} (${routeHub.lat}, ${routeHub.lng})`);
                console.log(`   - Primera Tienda: ${firstS.name_sitio} (${firstS.lat}, ${firstS.lng})`);
                console.log(`   - Distancia Inicial: ${startDist.toFixed(1)} km`);
                console.log(`   - Distancia Retorno: ${distReturn.toFixed(1)} km`);
                console.log(`   - KM Acumulados Rutas: ${totalKm.toFixed(1)} km`);
            }

            routes.push({
                id: (routeIndex + 1).toString().padStart(2, '0'),
                corridorId,
                corridorName: corridor.name,
                hub: routeHub,
                direction: corridor.direction,
                stores: sequencedStores,
                scheduledDays,
                totalKm: Math.round(totalKm + distReturn), // Incluir retorno a base
                totalDays: scheduledDays.length,
                startDate: config.startDate,
                endDate: lastDay?.date || config.startDate,
                color: routeColors[routeIndex % routeColors.length]
            });

            routeIndex++;
        }

        console.log(`\n🎯 RESULTADO: ${routes.length} rutas generadas por corredor`);
        return routes;
    },

    /**
     * Asigna cada tienda al corredor geográfico más apropiado
     */
    assignStoresToCorridors(
        stores: SiteRecord[],
        defaultHub: Hub
    ): Record<string, SiteRecord[]> {
        const result: Record<string, SiteRecord[]> = {};

        // Inicializar todos los corredores
        MEXICAN_CORRIDORS.forEach(c => result[c.id] = []);

        for (const store of stores) {
            const bearing = LogicEngine.calculateBearing(
                defaultHub.lat, defaultHub.lng,
                store.lat!, store.lng!
            );
            const distance = LogicEngine.calculateDistance(
                defaultHub.lat, defaultHub.lng,
                store.lat!, store.lng!
            );

            // Para tiendas cercanas al hub (<50km), asignar a CDMX/Centro
            if (distance < 50) {
                result['CDMX'].push(store);
                continue;
            }

            // Buscar el corredor que mejor coincide con el bearing
            let bestCorridor = MEXICAN_CORRIDORS[0];
            let bestScore = -Infinity;

            for (const corridor of MEXICAN_CORRIDORS) {
                if (corridor.id === 'CDMX') continue; // CDMX es para tiendas cercanas

                let score = 0;

                // Verificar si el bearing cae dentro del rango del corredor
                if (corridor.bearingMax >= corridor.bearingMin) {
                    if (bearing >= corridor.bearingMin && bearing <= corridor.bearingMax) {
                        score += 100;
                    }
                } else {
                    // Rango que cruza 0° (ej: 350-30)
                    if (bearing >= corridor.bearingMin || bearing <= corridor.bearingMax) {
                        score += 100;
                    }
                }

                // Bonus por proximidad al centro del corredor
                const distToCorridor = LogicEngine.calculateDistance(
                    store.lat!, store.lng!,
                    corridor.centerLat, corridor.centerLng
                );
                score += Math.max(0, 500 - distToCorridor) / 10;

                // Bonus por coincidencia de estado/ciudad con el corredor
                const storeState = (store.state || '').toUpperCase();
                const storeCity = (store.city || '').toUpperCase();
                for (const city of corridor.majorCities) {
                    if (storeState.includes(city.toUpperCase()) || storeCity.includes(city.toUpperCase())) {
                        score += 50;
                    }
                }

                if (score > bestScore) {
                    bestScore = score;
                    bestCorridor = corridor;
                }
            }

            result[bestCorridor.id].push(store);
        }

        // Log de distribución
        for (const [id, stores] of Object.entries(result)) {
            if (stores.length > 0) {
                const corridor = MEXICAN_CORRIDORS.find(c => c.id === id);
                console.log(`  📦 ${corridor?.name || id}: ${stores.length} tiendas`);
            }
        }

        return result;
    },

    /**
     * Selecciona el hub óptimo para un corredor
     */
    selectHubForCorridor(corridor: GeographicCorridor, defaultHub?: Hub): Hub {
        // Por defecto, usar CDMX
        if (!defaultHub) return DEFAULT_HUBS[0];

        // Para corredores muy lejanos, considerar usar un hub más cercano
        // Por ahora, usamos el hub default pero esta lógica puede expandirse
        return defaultHub;
    },

    /**
     * Secuencia tiendas para avance continuo sin zig-zag
     */
    sequenceStoresForCorridor(
        stores: SiteRecord[],
        hub: Hub,
        corridor: GeographicCorridor
    ): SiteRecord[] {
        if (stores.length === 0) return [];
        if (stores.length === 1) return stores;

        // Ordenar por distancia desde el hub (más cercanas primero)
        // pero respetando la dirección del corredor
        const sortedStores = [...stores].map(s => ({
            ...s,
            _distFromHub: LogicEngine.calculateDistance(hub.lat, hub.lng, s.lat!, s.lng!),
            _bearing: LogicEngine.calculateBearing(hub.lat, hub.lng, s.lat!, s.lng!)
        }));

        // Para corredores que van "hacia afuera" del hub, ordenar por distancia ascendente
        // Esto asegura avance continuo
        sortedStores.sort((a, b) => {
            // Primero agrupar por "zona" de bearing similar (cada 20 grados)
            const aBearingZone = Math.floor(a._bearing / 20);
            const bBearingZone = Math.floor(b._bearing / 20);

            if (aBearingZone !== bBearingZone) {
                return aBearingZone - bBearingZone;
            }

            // Dentro de la misma zona, ordenar por distancia
            return a._distFromHub - b._distFromHub;
        });

        // Aplicar algoritmo del vecino más cercano para suavizar la ruta
        return LogicEngine.sequenceRoute(sortedStores, { lat: hub.lat, lng: hub.lng });
    },

    /**
     * Genera el cronograma día por día con pernoctas
     * @param workDays - Array de días laborables (0=Domingo, 1=Lunes, etc.)
     */
    async generateDaySchedule(
        stores: SiteRecord[],
        hub: Hub,
        startDate: string,
        stopsPerDay: number,
        avgServiceMinutes: number,
        bufferMinutes: number,
        workDays: number[] = [1, 2, 3, 4, 5, 6] // L-S por defecto
    ): Promise<ScheduledDay[]> {
        const days: ScheduledDay[] = [];
        let storeIndex = 0;
        let currentDate = new Date(startDate + 'T00:00:00');
        let dayNumber = 0;

        // Validar workDays - si está vacío usar L-S por defecto
        const validWorkDays = workDays.length > 0 ? workDays : [1, 2, 3, 4, 5, 6];

        console.log(`📅 Días de trabajo configurados: ${validWorkDays.map(d => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d]).join(', ')}`);

        while (storeIndex < stores.length) {
            const dayOfWeek = currentDate.getDay(); // 0=Domingo, 1=Lunes, etc.

            // Saltar días NO laborables
            if (!validWorkDays.includes(dayOfWeek)) {
                console.log(`⏭️ Saltando ${currentDate.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' })} (No laborable)`);
                currentDate.setDate(currentDate.getDate() + 1);
                continue;
            }

            dayNumber++;
            const dateStr = currentDate.toISOString().split('T')[0];

            // Punto de inicio del día
            let startPoint: { lat: number; lng: number; name: string };
            if (dayNumber === 1) {
                // Día 1: salir del hub
                startPoint = { lat: hub.lat, lng: hub.lng, name: hub.name };
            } else {
                // Días siguientes: desde la pernocta anterior
                const prevDay = days[days.length - 1];
                if (prevDay.overnightLocation) {
                    startPoint = {
                        lat: prevDay.overnightLocation.lat,
                        lng: prevDay.overnightLocation.lng,
                        name: prevDay.overnightLocation.name
                    };
                } else {
                    const lastStore = prevDay.stores[prevDay.stores.length - 1];
                    startPoint = {
                        lat: lastStore.lat!,
                        lng: lastStore.lng!,
                        name: lastStore.name_sitio
                    };
                }
            }

            // Tiendas para hoy
            const todayStores = stores.slice(storeIndex, storeIndex + stopsPerDay);

            // Calcular métricas del día
            let kmTotal = 0;
            let minutesTravel = 0;
            let prevPoint = startPoint;

            const scheduledStores: ScheduledStore[] = [];

            for (let i = 0; i < todayStores.length; i++) {
                const store = todayStores[i];
                const kmFromPrev = LogicEngine.calculateDistance(
                    prevPoint.lat, prevPoint.lng,
                    store.lat!, store.lng!
                ) * 1.3; // Factor carretera

                const minutesFromPrev = Math.round(kmFromPrev * 1.2); // ~50km/h promedio

                kmTotal += kmFromPrev;
                minutesTravel += minutesFromPrev;

                scheduledStores.push({
                    ...store,
                    store_job_id: `${dayNumber.toString().padStart(2, '0')}_${store.site_id}_${dateStr}`,
                    stopInDay: i + 1,
                    dayInProject: dayNumber,
                    sequenceInRoute: storeIndex + i + 1,
                    kmFromPrevious: Math.round(kmFromPrev * 10) / 10,
                    minutesFromPrevious: minutesFromPrev
                });

                prevPoint = { lat: store.lat!, lng: store.lng!, name: store.name_sitio };
            }

            const minutesService = todayStores.length * avgServiceMinutes;
            const minutesTotal = minutesTravel + minutesService + bufferMinutes;

            // Determinar punto final del día
            const lastStore = scheduledStores[scheduledStores.length - 1];
            const endPoint = {
                lat: lastStore.lat!,
                lng: lastStore.lng!,
                name: lastStore.name_sitio
            };

            // Calcular pernocta óptima
            let overnightLocation: OvernightLocation | null = null;
            const nextStoreIndex = storeIndex + stopsPerDay;

            if (nextStoreIndex < stores.length) {
                const nextStore = stores[nextStoreIndex];
                overnightLocation = this.findBestOvernightLocation(
                    endPoint,
                    { lat: nextStore.lat!, lng: nextStore.lng!, name: nextStore.name_sitio }
                );
            }

            days.push({
                dayNumber,
                date: dateStr,
                stores: scheduledStores,
                overnightLocation,
                kmTotal: Math.round(kmTotal),
                minutesTravel: Math.round(minutesTravel),
                minutesService,
                minutesTotal: Math.round(minutesTotal),
                startPoint,
                endPoint
            });

            storeIndex += stopsPerDay;
            currentDate.setDate(currentDate.getDate() + 1);
        }

        return days;
    },

    /**
     * Encuentra la mejor ubicación para pernoctar
     * REGLA: Lo más cerca posible de la SIGUIENTE tienda para llegar temprano
     */
    findBestOvernightLocation(
        currentPosition: { lat: number; lng: number; name: string },
        nextStore: { lat: number; lng: number; name: string }
    ): OvernightLocation {
        // Calcular punto medio entre posición actual y siguiente tienda
        const midLat = (currentPosition.lat + nextStore.lat) / 2;
        const midLng = (currentPosition.lng + nextStore.lng) / 2;

        // Buscar ciudad más cercana al siguiente punto (no al punto medio)
        let bestCity = OVERNIGHT_CITIES[0];
        let bestDistance = Infinity;

        for (const city of OVERNIGHT_CITIES) {
            const distToNext = LogicEngine.calculateDistance(
                city.lat, city.lng,
                nextStore.lat, nextStore.lng
            );

            // Preferir ciudades que estén más cerca de la siguiente tienda
            if (distToNext < bestDistance) {
                bestDistance = distToNext;
                bestCity = city;
            }
        }

        // Si la siguiente tienda está muy cerca (< 100km), mejor quedarse cerca de ella
        const directDistance = LogicEngine.calculateDistance(
            currentPosition.lat, currentPosition.lng,
            nextStore.lat, nextStore.lng
        );

        if (directDistance < 100 || bestDistance > 150) {
            // Usar la misma ciudad de la siguiente tienda o punto cercano
            return {
                name: `Zona ${nextStore.name}`,
                lat: nextStore.lat - 0.02, // Ligeramente antes
                lng: nextStore.lng,
                nearestCity: nextStore.name,
                distanceToNextStore: 5,
                reason: 'Pernocta cercana a siguiente tienda para inicio temprano'
            };
        }

        return {
            name: bestCity.name,
            lat: bestCity.lat,
            lng: bestCity.lng,
            nearestCity: bestCity.name,
            distanceToNextStore: Math.round(bestDistance),
            reason: `Ciudad estratégica a ${Math.round(bestDistance)}km de siguiente tienda`
        };
    },

    /**
     * Convierte rutas de corredor al formato legacy para compatibilidad con UI existente
     */
    convertToLegacyFormat(corridorRoutes: CorridorRoute[], defaultDepotId: string): any[] {
        return corridorRoutes.map(route => {
            // Aplanar todas las tiendas programadas
            const allStops: SiteRecord[] = [];

            for (const day of route.scheduledDays) {
                for (const store of day.stores) {
                    allStops.push({
                        ...store,
                        date: day.date,
                        routeId: route.id,
                        scheduled_date: day.date,
                        stop_in_day: store.stopInDay,
                        day_in_project: store.dayInProject,
                        sequence_in_route: store.sequenceInRoute,
                        km_day_total: day.kmTotal,
                        minutes_travel_day_total: day.minutesTravel,
                        minutes_service_day_total: day.minutesService,
                        minutes_day_total: day.minutesTotal,
                        day_status: day.minutesTotal > 720 ? 'OVERTIME' : 'OK',
                        // MAPPING CRÍTICO PARA UI:
                        distance_km: store.kmFromPrevious || 0,
                        travel_time_minutes: store.minutesFromPrevious || 0
                    } as any);
                }
            }

            const firstStore = allStops[0];
            const lastStore = allStops[allStops.length - 1];

            return {
                id: route.id,
                depotId: defaultDepotId,
                base: route.hub.name,
                corridorId: route.corridorId,
                corridorName: route.corridorName,
                direction: route.direction,
                driverName: `${route.corridorName}`,
                secondaryDriverName: `${firstStore?.name_sitio || 'INICIO'} → ${lastStore?.name_sitio || 'FIN'}`,
                stops: allStops,
                allAssignedStops: route.stores,
                scheduledDays: route.scheduledDays,
                totalKm: route.totalKm,
                estTimeMinutes: route.scheduledDays.reduce((acc, d) => acc + d.minutesTotal, 0),
                color: route.color,
                startDate: route.startDate,
                endDate: route.endDate,
                date: route.startDate,
                hub: route.hub
            };
        });
    }
};

export default CorridorRouteEngine;

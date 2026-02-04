/**
 * ================================================
 * COORDINATE PRECISION ENHANCER
 * ================================================
 * Mejora la precisión de coordenadas para mapas
 * utilizando las mejores prácticas de Google Maps.
 * 
 * PRECISIÓN POR TIPO DE UBICACIÓN:
 * - ROOFTOP: ±5 metros (más preciso)
 * - RANGE_INTERPOLATED: ±10 metros
 * - GEOMETRIC_CENTER: ±50 metros  
 * - APPROXIMATE: ±100+ metros (menos preciso)
 */

export interface PreciseLocation {
    lat: number;
    lng: number;
    place_id: string;
    formatted_address: string;
    location_type: 'ROOFTOP' | 'RANGE_INTERPOLATED' | 'GEOMETRIC_CENTER' | 'APPROXIMATE';
    precision_meters: number; // Estimado de precisión
    viewport?: {
        northeast: { lat: number; lng: number };
        southwest: { lat: number; lng: number };
    };
}

export interface PrecisionQualityReport {
    total: number;
    rooftop: number;        // ±5m - Excelente
    interpolated: number;   // ±10m - Bueno
    geometric: number;      // ±50m - Regular
    approximate: number;    // ±100m+ - Pobre
    averagePrecision: number;
    quality: 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';
}

export class CoordinatePrecisionEnhancer {

    private static API_KEY: string | null = null;

    /**
     * Configura la API key
     */
    static setApiKey(key: string): void {
        this.API_KEY = key;
    }

    /**
     * Geocodifica una dirección con información de precisión
     */
    static async geocodeWithPrecision(address: string): Promise<PreciseLocation | null> {
        if (!this.API_KEY) {
            console.warn('⚠️ API Key no configurada para geocodificación de alta precisión');
            return null;
        }

        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.API_KEY}`
            );
            const data = await response.json();

            if (data.status !== 'OK' || data.results.length === 0) {
                console.warn(`❌ Geocoding failed for: ${address} (${data.status})`);
                return null;
            }

            const result = data.results[0];
            const geometry = result.geometry;

            // Determinar precisión según location_type
            let precision_meters = 100; // Default: aproximado
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
                    precision_meters = 100;
                    break;
            }

            const precise: PreciseLocation = {
                lat: geometry.location.lat,
                lng: geometry.location.lng,
                place_id: result.place_id,
                formatted_address: result.formatted_address,
                location_type: geometry.location_type,
                precision_meters,
                viewport: geometry.viewport
            };

            // Log de calidad
            if (precision_meters <= 10) {
                console.log(`✅ Alta precisión (±${precision_meters}m): ${address}`);
            } else if (precision_meters <= 50) {
                console.warn(`⚠️ Precisión media (±${precision_meters}m): ${address}`);
            } else {
                console.warn(`❌ Baja precisión (±${precision_meters}m): ${address} - Se recomienda mejorar la dirección`);
            }

            return precise;

        } catch (error) {
            console.error('Error en geocodificación de precisión:', error);
            return null;
        }
    }

    /**
     * Mejorar una coordenada existente usando Place ID
     * (Re-geocodificar con place_id es más preciso que con dirección de texto)
     */
    static async refineWithPlaceId(placeId: string): Promise<PreciseLocation | null> {
        if (!this.API_KEY) return null;

        try {
            const response = await fetch(
                `https://maps.googleapis.com/maps/api/geocode/json?place_id=${placeId}&key=${this.API_KEY}`
            );
            const data = await response.json();

            if (data.status === 'OK' && data.results.length > 0) {
                const result = data.results[0];
                const geometry = result.geometry;

                return {
                    lat: geometry.location.lat,
                    lng: geometry.location.lng,
                    place_id: result.place_id,
                    formatted_address: result.formatted_address,
                    location_type: geometry.location_type,
                    precision_meters: geometry.location_type === 'ROOFTOP' ? 5 : 10,
                    viewport: geometry.viewport
                };
            }

            return null;
        } catch (error) {
            console.error('Error refinando con Place ID:', error);
            return null;
        }
    }

    /**
     * Analiza la calidad de precisión de un conjunto de ubicaciones
     */
    static analyzePrecisionQuality(locations: PreciseLocation[]): PrecisionQualityReport {
        const report: PrecisionQualityReport = {
            total: locations.length,
            rooftop: 0,
            interpolated: 0,
            geometric: 0,
            approximate: 0,
            averagePrecision: 0,
            quality: 'POOR'
        };

        let totalPrecision = 0;

        locations.forEach(loc => {
            totalPrecision += loc.precision_meters;

            switch (loc.location_type) {
                case 'ROOFTOP':
                    report.rooftop++;
                    break;
                case 'RANGE_INTERPOLATED':
                    report.interpolated++;
                    break;
                case 'GEOMETRIC_CENTER':
                    report.geometric++;
                    break;
                case 'APPROXIMATE':
                    report.approximate++;
                    break;
            }
        });

        report.averagePrecision = totalPrecision / locations.length;

        // Determinar calidad general
        const excellentRatio = report.rooftop / report.total;
        const goodRatio = (report.rooftop + report.interpolated) / report.total;

        if (excellentRatio >= 0.8) {
            report.quality = 'EXCELLENT'; // 80%+ ROOFTOP
        } else if (goodRatio >= 0.7) {
            report.quality = 'GOOD'; // 70%+ alta precisión
        } else if (report.averagePrecision <= 50) {
            report.quality = 'FAIR';
        } else {
            report.quality = 'POOR';
        }

        return report;
    }

    /**
     * Imprime un reporte visual de calidad de precisión
     */
    static printPrecisionReport(report: PrecisionQualityReport): void {
        console.log('\n╔══════════════════════════════════════════════════════════╗');
        console.log('║      📍 REPORTE DE PRECISIÓN DE COORDENADAS            ║');
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║ Total de ubicaciones:        ${String(report.total).padStart(4)}                    ║`);
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║ ✅ ROOFTOP (±5m):            ${String(report.rooftop).padStart(4)} (${((report.rooftop / report.total) * 100).toFixed(0)}%)       ║`);
        console.log(`║ 🟢 INTERPOLATED (±10m):      ${String(report.interpolated).padStart(4)} (${((report.interpolated / report.total) * 100).toFixed(0)}%)       ║`);
        console.log(`║ 🟡 GEOMETRIC (±50m):         ${String(report.geometric).padStart(4)} (${((report.geometric / report.total) * 100).toFixed(0)}%)       ║`);
        console.log(`║ 🔴 APPROXIMATE (±100m+):     ${String(report.approximate).padStart(4)} (${((report.approximate / report.total) * 100).toFixed(0)}%)       ║`);
        console.log('╠══════════════════════════════════════════════════════════╣');
        console.log(`║ Precisión promedio:          ±${report.averagePrecision.toFixed(1)}m              ║`);

        const qualityColor = report.quality === 'EXCELLENT' ? '🟢' :
            report.quality === 'GOOD' ? '🟡' :
                report.quality === 'FAIR' ? '🟠' : '🔴';
        console.log(`║ Calidad general:             ${qualityColor} ${report.quality.padEnd(15)} ║`);
        console.log('╚══════════════════════════════════════════════════════════╝\n');

        // Recomendaciones
        if (report.quality === 'POOR' || report.quality === 'FAIR') {
            console.warn('⚠️ RECOMENDACIÓN: La precisión es baja. Considera:');
            console.warn('   1. Incluir números de calle completos');
            console.warn('   2. Agregar código postal');
            console.warn('   3. Usar direcciones formateadas (Calle #, Colonia, CP, Ciudad, Estado)');
        }
    }

    /**
     * Convierte coordenadas imprecisas a precisas usando Place ID
     */
    static async batchRefine(
        sites: Array<{ id: string, place_id?: string, lat?: number, lng?: number }>,
        onProgress?: (current: number, total: number) => void
    ): Promise<Map<string, PreciseLocation>> {
        const refined = new Map<string, PreciseLocation>();

        for (let i = 0; i < sites.length; i++) {
            const site = sites[i];

            if (site.place_id) {
                const precise = await this.refineWithPlaceId(site.place_id);
                if (precise) {
                    refined.set(site.id, precise);
                }
            }

            if (onProgress) {
                onProgress(i + 1, sites.length);
            }

            // Rate limiting: Google allows 50 QPS for Geocoding API
            await new Promise(resolve => setTimeout(resolve, 25)); // 40 QPS
        }

        return refined;
    }
}

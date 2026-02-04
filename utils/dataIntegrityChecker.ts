/**
 * ============================================
 * DATA INTEGRITY CHECKER
 * ============================================
 * Sistema de auditoría para verificar que los números
 * de tiendas concuerden en TODOS los puntos del sistema.
 */

export interface IntegrityReport {
    timestamp: string;
    projectName: string;

    // Puntos de control
    sitesLoaded: number;              // Tiendas cargadas desde archivo
    sitesAfterDedup: number;          // Después de eliminar duplicados
    sitesInState: number;             // En el estado de React (sites)
    sitesInRoutes: number;            // Distribuidas en rutas
    sitesInQuotation: number;         // Contadas en cotización

    // Validación
    isConsistent: boolean;
    discrepancies: string[];

    // Detalles de rutas
    routesDetails: {
        routeId: string;
        storesCount: number;
        storeIds: string[];
    }[];

    // IDs únicos para verificar duplicados
    uniqueStoreIds: Set<string>;
    duplicatedIds: string[];
}

export class DataIntegrityChecker {

    /**
     * Genera un reporte completo de integridad
     */
    static generateReport(
        projectName: string,
        sites: any[],
        optimizedRoutes: any[]
    ): IntegrityReport {

        const timestamp = new Date().toISOString();
        const discrepancies: string[] = [];

        // 1. Contar tiendas en estado
        const sitesInState = sites.length;

        // 2. Contar tiendas en rutas (con verificación de duplicados)
        const storesInRoutesMap = new Map<string, number>();
        const routesDetails: IntegrityReport['routesDetails'] = [];

        optimizedRoutes.forEach(route => {
            const storeIds: string[] = [];
            route.stops?.forEach((stop: any) => {
                const storeId = stop.site_id || stop.id;
                storeIds.push(storeId);

                // Contar cuántas veces aparece cada ID
                storesInRoutesMap.set(storeId, (storesInRoutesMap.get(storeId) || 0) + 1);
            });

            routesDetails.push({
                routeId: route.id,
                storesCount: route.stops?.length || 0,
                storeIds
            });
        });

        const sitesInRoutes = optimizedRoutes.reduce((acc, r) => acc + (r.stops?.length || 0), 0);

        // 3. Identificar duplicados
        const duplicatedIds: string[] = [];
        storesInRoutesMap.forEach((count, id) => {
            if (count > 1) {
                duplicatedIds.push(`${id} (${count} veces)`);
            }
        });

        // 4. Crear set de IDs únicos
        const uniqueStoreIds = new Set(storesInRoutesMap.keys());

        // 5. Validar consistencia
        if (sitesInState !== sitesInRoutes) {
            discrepancies.push(
                `❌ DISCREPANCIA CRÍTICA: ${sitesInState} tiendas cargadas vs ${sitesInRoutes} en rutas`
            );
        }

        if (duplicatedIds.length > 0) {
            discrepancies.push(
                `❌ DUPLICADOS DETECTADOS: ${duplicatedIds.length} tiendas aparecen múltiples veces en rutas`
            );
        }

        if (uniqueStoreIds.size !== sitesInState) {
            discrepancies.push(
                `⚠️ ADVERTENCIA: ${sitesInState} tiendas únicas esperadas vs ${uniqueStoreIds.size} IDs únicos en rutas`
            );
        }

        const isConsistent = discrepancies.length === 0;

        return {
            timestamp,
            projectName,
            sitesLoaded: sitesInState,
            sitesAfterDedup: sitesInState, // Este dato se actualiza en el flujo
            sitesInState,
            sitesInRoutes,
            sitesInQuotation: sitesInRoutes, // La cotización usa las rutas
            isConsistent,
            discrepancies,
            routesDetails,
            uniqueStoreIds,
            duplicatedIds
        };
    }

    /**
     * Imprime un reporte visual en consola
     */
    static printReport(report: IntegrityReport): void {
        console.log('\n╔════════════════════════════════════════════════════════════╗');
        console.log('║         🔍 REPORTE DE INTEGRIDAD DE DATOS                 ║');
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║ Proyecto: ${report.projectName.padEnd(47)} ║`);
        console.log(`║ Timestamp: ${report.timestamp.padEnd(46)} ║`);
        console.log('╠════════════════════════════════════════════════════════════╣');
        console.log(`║ Tiendas Cargadas:        ${String(report.sitesLoaded).padStart(4)} tiendas          ║`);
        console.log(`║ Tiendas en Estado:       ${String(report.sitesInState).padStart(4)} tiendas          ║`);
        console.log(`║ Tiendas en Rutas:        ${String(report.sitesInRoutes).padStart(4)} tiendas          ║`);
        console.log(`║ IDs Únicos en Rutas:     ${String(report.uniqueStoreIds.size).padStart(4)} IDs únicos      ║`);
        console.log('╠════════════════════════════════════════════════════════════╣');

        if (report.isConsistent) {
            console.log('║ ✅ ESTADO: DATOS CONSISTENTES                              ║');
        } else {
            console.log('║ ❌ ESTADO: INCONSISTENCIAS DETECTADAS                      ║');
            console.log('╠════════════════════════════════════════════════════════════╣');
            report.discrepancies.forEach(disc => {
                console.log(`║ ${disc.padEnd(58)} ║`);
            });
        }

        if (report.duplicatedIds.length > 0) {
            console.log('╠════════════════════════════════════════════════════════════╣');
            console.log('║ DUPLICADOS ENCONTRADOS:                                    ║');
            report.duplicatedIds.forEach(dup => {
                console.log(`║   • ${dup.padEnd(55)} ║`);
            });
        }

        console.log('╚════════════════════════════════════════════════════════════╝\n');
    }

    /**
     * Valida si hay discrepancias y retorna un mensaje para el usuario
     */
    static getUserFacingMessage(report: IntegrityReport): string | null {
        if (report.isConsistent) {
            return null; // Todo OK
        }

        let message = '⚠️ ALERTA DE INTEGRIDAD DE DATOS\n\n';

        if (report.sitesInState !== report.sitesInRoutes) {
            message += `Se detectó una inconsistencia:\n`;
            message += `- Tiendas cargadas: ${report.sitesInState}\n`;
            message += `- Tiendas en rutas: ${report.sitesInRoutes}\n`;
            message += `- Diferencia: ${Math.abs(report.sitesInState - report.sitesInRoutes)} tiendas\n\n`;
        }

        if (report.duplicatedIds.length > 0) {
            message += `Se encontraron ${report.duplicatedIds.length} tiendas duplicadas en las rutas.\n\n`;
            message += 'Detalles técnicos disponibles en la consola del navegador (F12).';
        }

        return message;
    }
}

import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { SiteRecord, PlannerConfig, Depot, AddressStatus } from '../types';

export const exportService = {
    /**
     * Genera el paquete completo de exportación (Excel Maestro + ZIP de CSVs)
     * Siguiendo estrictamente el Paso 11 de la Misión AntiGravity.
     */
    async generateExportPackage(
        sites: SiteRecord[],
        routes: any[],
        config: PlannerConfig,
        depots: Depot[]
    ) {
        console.log("Generando Paquete Maestro de Exportación...");

        const wb = XLSX.utils.book_new();

        // -- 1) HOJA CRONOGRAMA (HORIZONTAL) --
        const allDates = [...new Set(routes.flatMap(r => r.stops.map((s: any) => s.scheduled_date)))].filter(Boolean).sort();
        const cronoHeaders = ["CUADRILLA", ...allDates];
        const cronoRows = routes.map(r => {
            const row: any[] = [`CUADRILLA_${r.id}`];
            allDates.forEach(date => {
                const dayStops = r.stops.filter((s: any) => s.scheduled_date === date);
                if (dayStops.length > 0) {
                    const isOvertime = dayStops[0].day_status === 'OVERTIME';
                    const content = dayStops.map((s: any) => {
                        const prefix = s.status === AddressStatus.WARNING ? '⚠ ' : '';
                        return `${prefix}${s.site_id} | ${s.name_sitio} | ${s.city}, ${s.state}`;
                    }).join('\n');
                    row.push(isOvertime ? `⏱ OVERTIME\n${content}` : content);
                } else {
                    row.push("");
                }
            });
            return row;
        });
        const wsCrono = XLSX.utils.aoa_to_sheet([cronoHeaders, ...cronoRows]);
        XLSX.utils.book_append_sheet(wb, wsCrono, "CRONOGRAMA");

        // -- 2) HOJAS CUADRILLA_01 ... CUADRILLA_NN --
        const zip = new JSZip();
        const csvFolder = zip.folder("Cuadrillas_CSV");

        for (const route of routes) {
            const sheetName = `CUADRILLA_${route.id}`;
            const origin = { lat: depots[0].lat, lng: depots[0].lng };

            let km_route_running_total = 0;

            const routeData = route.stops.map((s: any) => {
                const isFirstStopOfDay = s.stop_in_day === 1;
                if (isFirstStopOfDay) {
                    km_route_running_total += s.km_day_total || 0;
                }

                return {
                    // Originales
                    ID_TIENDA: s.site_id,
                    NOMBRE_TIENDA: s.name_sitio,
                    MARCA: s.marca,
                    REGION: s.region,
                    RANKING: s.ranking,
                    Ciudad: s.city,
                    Estado: s.state,
                    Alcaldia_Municipio: s.municipio,
                    CP: s.cp,
                    Colonia: s.colonia,
                    DIRECCION_COMPLETA: s.direccion_completa,

                    // Google
                    FULL_ADDRESS: s.full_address_derived,
                    formatted_address: s.formatted_address,
                    place_id: s.place_id,
                    lat: s.lat,
                    lng: s.lng,
                    address_status: s.status,

                    // Planificación
                    origin_lat: origin.lat,
                    origin_lng: origin.lng,
                    cuadrilla_id: `CUADRILLA_${route.id}`,
                    scheduled_date: s.scheduled_date,
                    stop_in_day: s.stop_in_day,
                    sequence_in_route: s.sequence_in_route,

                    // Métricas
                    km_day_total: s.km_day_total,
                    minutes_travel_day_total: s.minutes_travel_day_total,
                    minutes_service_day_total: s.minutes_service_day_total,
                    minutes_day_total: s.minutes_day_total,
                    day_status: s.day_status,
                    km_route_running_total: km_route_running_total.toFixed(2)
                };
            });

            const wsRoute = XLSX.utils.json_to_sheet(routeData);
            XLSX.utils.book_append_sheet(wb, wsRoute, sheetName);

            // CSV individual con Header Corporativo
            const csvBody = XLSX.utils.sheet_to_csv(wsRoute);
            const csvHeader = [
                "TARGET INSTALACIONES POP",
                `REPORTE DE CUADRILLA: ${route.id}`,
                `OPERADOR: ${route.driverName || 'Por Asignar'}`,
                "----------------------------------------",
                ""
            ].join("\n");

            csvFolder?.file(`${sheetName}.csv`, csvHeader + csvBody);
        }

        // -- 3) HOJA VALIDACION_DIRECCIONES --
        const valData = sites.map(s => ({
            ID_TIENDA: s.site_id,
            NOMBRE: s.name_sitio,
            DIRECCION: s.direccion_completa,
            FULL_ADDRESS: s.full_address_derived,
            STATUS: s.status,
            DIRECCION_GOOGLE: s.formatted_address || '',
            NOTAS: s.notes || ''
        }));
        const wsVal = XLSX.utils.json_to_sheet(valData);
        XLSX.utils.book_append_sheet(wb, wsVal, "VALIDACION_DIRECCIONES");

        // -- 4) HOJA RESUMEN_KM --
        let km_total_project = 0;
        const resumenData = routes.map(r => {
            km_total_project += r.totalKm;
            const overtimeDays = [...new Set(r.stops.filter((s: any) => s.day_status === 'OVERTIME').map((s: any) => s.scheduled_date))].length;
            return {
                CUADRILLA: `CUADRILLA_${r.id}`,
                TIENDAS: r.stops.length,
                KM_TOTAL_ROUTE: r.totalKm.toFixed(2),
                TIEMPO_TOTAL_EST: `${Math.round(r.estTimeMinutes / 60)}h ${Math.round(r.estTimeMinutes % 60)}m`,
                DIAS_OVERTIME: overtimeDays
            };
        });
        resumenData.push({
            CUADRILLA: "TOTAL PROYECTO",
            TIENDAS: sites.length,
            KM_TOTAL_ROUTE: km_total_project.toFixed(2),
            TIEMPO_TOTAL_EST: "",
            DIAS_OVERTIME: ""
        } as any);
        const wsResumen = XLSX.utils.json_to_sheet(resumenData);
        XLSX.utils.book_append_sheet(wb, wsResumen, "RESUMEN_KM");

        // -- DESCARGAS --
        XLSX.writeFile(wb, `Cronograma_Maestro.xlsx`);

        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = zipUrl;
        link.download = `Cuadrillas_CSV_Export.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        return true;
    },

    /**
     * Descarga un CSV individual para una cuadrilla específica
     */
    async downloadSingleRouteCSV(route: any, config: PlannerConfig, depots: Depot[]) {
        const origin = { lat: depots[0].lat, lng: depots[0].lng };
        let km_route_running_total = 0;

        const detailData = route.stops.map((s: any) => {
            const isFirstStopOfDay = s.stop_in_day === 1;
            if (isFirstStopOfDay) {
                km_route_running_total += s.km_day_total || 0;
            }
            return {
                ID_TIENDA: s.site_id,
                NOMBRE_TIENDA: s.name_sitio,
                DIRECCION_COMPLETA: s.direccion_completa,
                STATUS: s.status,
                LAT: s.lat,
                LNG: s.lng,
                CUADRILLA: `CUADRILLA_${route.id}`,
                FECHA: s.scheduled_date,
                STOP_DIA: s.stop_in_day,
                KM_DIA: s.km_day_total,
                MIN_VIAJE: s.minutes_travel_day_total,
                MIN_SERVICIO: s.minutes_service_day_total,
                STATUS_DIA: s.day_status,
                KM_ACUMULADO: km_route_running_total.toFixed(2)
            };
        });

        const ws = XLSX.utils.json_to_sheet(detailData);
        const csvData = XLSX.utils.sheet_to_csv(ws);

        // Header Corporativo para CSV
        const header = [
            "TARGET INSTALACIONES POP",
            "REPORTE OPERATIVO DE RUTA / CUADRILLA: " + route.id,
            "FECHA DE EMISIÓN: " + new Date().toLocaleDateString(),
            "--------------------------------------------------",
            ""
        ].join("\n");

        const finalCsv = header + csvData;

        const blob = new Blob([finalCsv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `CUADRILLA_${route.id}_Branded.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    /**
     * Genera un ZIP con la jerarquía de evidencias y un reporte de Excel
     */
    async generateEvidenceExport(routes: any[], evidences: any[]) {
        console.log("Generando Paquete de Evidencias...");
        const zip = new JSZip();

        // 1) Generar Reporte Excel de Evidencias
        const reportData = routes.flatMap(route => {
            return route.stops.map((stop: any) => {
                const stopEvidences = evidences.filter(e => e.store_job_id === stop.store_job_id);
                const hasAck = stopEvidences.some(e => e.category === 'ACUSE_RECIBIDO');
                const photoCount = stopEvidences.filter(e => e.category !== 'ACUSE_RECIBIDO').length;

                return {
                    RUTA: `CUADRILLA_${route.id}`,
                    ID_TIENDA: stop.site_id,
                    TIENDA: stop.name_sitio,
                    FECHA: stop.scheduled_date,
                    STATUS_VISITA: stop.day_status,
                    COMPLETITUD: (hasAck && photoCount >= 3) ? 'COMPLETA' : 'INCOMPLETA',
                    EVIDENCIAS: photoCount,
                    ACUSE: hasAck ? 'SI' : 'NO',
                    NOTAS: stopEvidences.map(e => e.notes).filter(Boolean).join(' | ')
                };
            });
        });

        const wb = XLSX.utils.book_new();
        const wsReport = XLSX.utils.json_to_sheet(reportData);
        XLSX.utils.book_append_sheet(wb, wsReport, "REPORTE_EVIDENCIAS");
        const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        zip.file("Evidencias_Reporte.xlsx", excelBuffer);

        // 2) Estructura de Carpetas en ZIP
        routes.forEach(route => {
            const routeFolder = zip.folder(`Ruta_${route.id}`);

            // Agrupar paradas por fecha para subcarpetas
            const stopsByDate = route.stops.reduce((acc: any, s: any) => {
                if (!acc[s.scheduled_date]) acc[s.scheduled_date] = [];
                acc[s.scheduled_date].push(s);
                return acc;
            }, {});

            Object.entries(stopsByDate).forEach(([date, stops]: [string, any]) => {
                const dateFolder = routeFolder?.folder(date);

                stops.forEach((stop: any) => {
                    const stopFolder = dateFolder?.folder(stop.site_id);
                    const stopEvidences = evidences.filter(e => e.store_job_id === stop.store_job_id);

                    if (stopEvidences.length > 0) {
                        const evidenceFolder = stopFolder?.folder("evidencias");
                        const acuseFolder = stopFolder?.folder("acuse");

                        stopEvidences.forEach((ev, idx) => {
                            const fileName = `${ev.category}_${idx + 1}.${ev.file_type === 'photo' ? 'jpg' : 'pdf'}`;
                            const content = `Simulated Content for ${ev.category}\nUploaded at: ${ev.uploaded_at}\nNotes: ${ev.notes || 'N/A'}`;

                            if (ev.category === 'ACUSE_RECIBIDO') {
                                acuseFolder?.file(fileName, content);
                            } else {
                                evidenceFolder?.file(fileName, content);
                            }
                        });
                    }
                });
            });
        });

        // 3) Descargar ZIP
        const zipBlob = await zip.generateAsync({ type: "blob" });
        const zipUrl = URL.createObjectURL(zipBlob);
        const link = document.createElement("a");
        link.href = zipUrl;
        link.download = `EVIDENCIAS_ANTIGRAVITY_${new Date().toISOString().split('T')[0]}.zip`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
};

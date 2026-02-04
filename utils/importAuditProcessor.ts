// 🔍 PROCESADOR DE AUDITORÍA DE IMPORTACIÓN

import {
    AuditEntry,
    AuditStatus,
    FinalDecision,
    OriginalRowData,
    ProcessedRowData,
    AuditSummary,
    ImportAuditData
} from '../types/auditTypes';
import { DuplicateDetectionEngine } from './duplicateDetectionEngine';
import { SiteRecord } from '../types';

export class ImportAuditProcessor {

    /**
     * Genera un import ID único basado en timestamp
     */
    static generateImportId(): string {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const hour = String(now.getHours()).padStart(2, '0');
        const minute = String(now.getMinutes()).padStart(2, '0');

        return `IMPORT_${year}${month}${day}_${hour}${minute}`;
    }

    /**
     * Genera row_uid único para cada fila
     */
    static generateRowUid(importId: string, index: number): string {
        return `${importId}_${String(index).padStart(4, '0')}`;
    }

    /**
     * Normaliza texto: mayúsculas, sin dobles espacios
     */
    static normalizeText(text: string | undefined): string {
        if (!text) return '';
        return text
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Normaliza código postal: solo números
     */
    static normalizeCP(cp: string | undefined): string {
        if (!cp) return '';
        return cp.replace(/\D/g, '');
    }

    /**
     * Valida si un CP mexicano es válido (5 dígitos)
     */
    static isValidCP(cp: string): boolean {
        const normalized = this.normalizeCP(cp);
        return normalized.length === 5 && /^\d{5}$/.test(normalized);
    }

    /**
     * Convierte SiteRecord a OriginalRowData
     */
    static createOriginalRowData(
        site: SiteRecord,
        importId: string,
        index: number
    ): OriginalRowData {
        return {
            row_uid: this.generateRowUid(importId, index),
            rowIndex: index,
            nombre: site.name_sitio || '',
            direccion: site.direccion_completa || '',
            cp: site.cp || '',
            ciudad: site.city || site.municipio || '',
            estado: site.state || '',
            raw_data: { ...site }
        };
    }

    /**
     * Crea ProcessedRowData a partir de SiteRecord geocodificado
     */
    static createProcessedRowData(
        site: SiteRecord,
        row_uid: string
    ): ProcessedRowData {
        return {
            row_uid,
            nombre_normalizado: this.normalizeText(site.name_sitio),
            direccion_normalizada: this.normalizeText(site.direccion_completa),
            cp_normalizado: this.normalizeCP(site.cp),
            ciudad_normalizada: this.normalizeText(site.city || site.municipio),
            estado_normalizado: this.normalizeText(site.state),
            lat: site.lat,
            lng: site.lng,
            place_id: site.place_id,
            formatted_address: site.formatted_address,
            confidence_score: site.confidence_score || 0,
            location_type: (site as any).location_type,
            geocoding_error: site.notes?.includes('ERROR') ? site.notes : undefined
        };
    }

    /**
     * Determina el status de auditoría basado en los datos procesados
     */
    static determineAuditStatus(
        original: OriginalRowData,
        processed: ProcessedRowData
    ): AuditStatus {
        // Campos obligatorios faltantes
        if (!original.nombre || !original.direccion) {
            return AuditStatus.CAMPOS_OBLIGATORIOS_FALTANTES;
        }

        // CP inválido
        if (original.cp && !this.isValidCP(original.cp)) {
            return AuditStatus.CP_INVALIDO;
        }

        // Error de geocodificación
        if (processed.geocoding_error) {
            return AuditStatus.ERROR_API;
        }

        // No encontrado en Maps
        if (!processed.lat || !processed.lng) {
            if (!original.direccion || original.direccion.length < 10) {
                return AuditStatus.DIRECCION_INCOMPLETA;
            }
            return AuditStatus.NO_ENCONTRADO_EN_MAPS;
        }

        // Baja confianza
        if (processed.confidence_score < 0.6) {
            return AuditStatus.COINCIDENCIA_BAJA_CONFIANZA;
        }

        // Dirección ambigua
        if (processed.location_type && !['ROOFTOP', 'RANGE_INTERPOLATED'].includes(processed.location_type)) {
            return AuditStatus.DIRECCION_AMBIGUA;
        }

        // Normalizado (cambio de texto)
        if (
            original.nombre !== processed.nombre_normalizado ||
            original.direccion !== processed.direccion_normalizada ||
            original.cp !== processed.cp_normalizado
        ) {
            return AuditStatus.NORMALIZADO;
        }

        return AuditStatus.OK;
    }

    /**
     * Genera explicación humana según el status
     */
    static generateExplanation(status: AuditStatus, entry: AuditEntry): string {
        switch (status) {
            case AuditStatus.OK:
                return 'Dirección válida y geocodificada correctamente.';

            case AuditStatus.NORMALIZADO:
                return 'Se normalizó el formato del texto (mayúsculas, espacios).';

            case AuditStatus.DUPLICADO_MISMO_PLACE_ID:
                return `Duplicado confirmado: mismo place_id de Google Maps que ${entry.duplicateInfo?.suggestedMainRow}.`;

            case AuditStatus.DUPLICADO_COORDENADAS_IGUALES:
                return `Coordenadas exactamente iguales a ${entry.duplicateInfo?.suggestedMainRow}.`;

            case AuditStatus.DUPLICADO_POR_CERCANIA:
                return `A ${entry.duplicateInfo?.distanceMeters}m de ${entry.duplicateInfo?.suggestedMainRow}, con dirección similar.`;

            case AuditStatus.DUPLICADO_TEXTO_DIRECCION_CP:
                return `Dirección + CP idénticos a ${entry.duplicateInfo?.suggestedMainRow}.`;

            case AuditStatus.NO_ENCONTRADO_EN_MAPS:
                return 'Google Maps no pudo encontrar esta dirección.';

            case AuditStatus.DIRECCION_INCOMPLETA:
                return 'La dirección es demasiado corta o incompleta para geocodificar.';

            case AuditStatus.DIRECCION_AMBIGUA:
                return 'La dirección existe pero es ambigua (múltiples resultados).';

            case AuditStatus.COINCIDENCIA_BAJA_CONFIANZA:
                return `Google Maps encontró la dirección pero con baja confianza (${Math.round(entry.processed.confidence_score * 100)}%).`;

            case AuditStatus.CP_INVALIDO:
                return 'El código postal no tiene formato válido (debe ser 5 dígitos).';

            case AuditStatus.CAMPOS_OBLIGATORIOS_FALTANTES:
                return 'Faltan campos críticos: nombre o dirección vacíos.';

            case AuditStatus.ERROR_API:
                return 'Error al consultar Google Maps API.';

            case AuditStatus.EXCLUIDO_POR_USUARIO:
                return 'El usuario decidió excluir esta tienda del cronograma.';

            case AuditStatus.PENDIENTE_REVISION:
                return 'Requiere revisión manual del usuario.';

            default:
                return 'Status desconocido.';
        }
    }

    /**
     * Genera recomendación de corrección
     */
    static generateRecommendation(status: AuditStatus): string {
        switch (status) {
            case AuditStatus.DIRECCION_INCOMPLETA:
                return 'Completa la dirección con número, colonia y ciudad.';

            case AuditStatus.CP_INVALIDO:
                return 'Verifica que el CP tenga exactamente 5 dígitos.';

            case AuditStatus.CAMPOS_OBLIGATORIOS_FALTANTES:
                return 'Agrega nombre y dirección completa.';

            case AuditStatus.NO_ENCONTRADO_EN_MAPS:
                return 'Verifica la ortografía de la dirección o agrégala manualmente en Maps.';

            case AuditStatus.COINCIDENCIA_BAJA_CONFIANZA:
                return 'Revisa la dirección o agrégala manualmente con coordenadas exactas.';

            case AuditStatus.DUPLICADO_MISMO_PLACE_ID:
            case AuditStatus.DUPLICADO_COORDENADAS_IGUALES:
            case AuditStatus.DUPLICADO_POR_CERCANIA:
            case AuditStatus.DUPLICADO_TEXTO_DIRECCION_CP:
                return 'Fusiona con la fila principal o marca como ignorar si son ubicaciones diferentes.';

            default:
                return 'Ninguna acción requerida.';
        }
    }

    /**
     * Crea un AuditEntry completo
     */
    static createAuditEntry(
        original: OriginalRowData,
        processed: ProcessedRowData
    ): AuditEntry {
        const status = this.determineAuditStatus(original, processed);

        const entry: AuditEntry = {
            row_uid: original.row_uid,
            original,
            processed,
            status,
            status_final: FinalDecision.PENDIENTE,
            motivo_principal: status,
            motivos_secundarios: [],
            explicacion_humana: '', // Se completa después
            evidencia_tecnica: {
                place_id: processed.place_id,
                lat: processed.lat,
                lng: processed.lng,
                confidence_score: processed.confidence_score,
                error_code: processed.geocoding_error
            },
            recomendacion_correccion: this.generateRecommendation(status),
            userActions: [],
            isWhitelisted: false,
            timestamp: new Date().toISOString()
        };

        entry.explicacion_humana = this.generateExplanation(status, entry);

        return entry;
    }

    /**
     * Genera resumen ejecutivo
     */
    static generateSummary(entries: AuditEntry[]): AuditSummary {
        const totalOriginal = entries.length;
        const seQueda = entries.filter(e => e.status_final === FinalDecision.SE_QUEDA).length;
        const seFusiona = entries.filter(e => e.status_final === FinalDecision.SE_FUSIONA).length;
        const seExcluye = entries.filter(e => e.status_final === FinalDecision.SE_EXCLUYE).length;
        const pendiente = entries.filter(e => e.status_final === FinalDecision.PENDIENTE).length;

        const erroresCriticos = entries.filter(e =>
            [
                AuditStatus.NO_ENCONTRADO_EN_MAPS,
                AuditStatus.DIRECCION_INCOMPLETA,
                AuditStatus.CAMPOS_OBLIGATORIOS_FALTANTES,
                AuditStatus.CP_INVALIDO
            ].includes(e.status)
        ).length;

        // Ranking de motivos
        const motivoCounts = new Map<string, number>();
        entries.forEach(e => {
            motivoCounts.set(e.motivo_principal, (motivoCounts.get(e.motivo_principal) || 0) + 1);
        });

        const motivosRanking = Array.from(motivoCounts.entries())
            .map(([motivo, count]) => ({
                motivo,
                count,
                percentage: (count / totalOriginal) * 100
            }))
            .sort((a, b) => b.count - a.count);

        // Casos representativos (máximo 5 por motivo)
        const casosRepresentativos: Record<string, AuditEntry[]> = {};
        motivosRanking.forEach(({ motivo }) => {
            casosRepresentativos[motivo] = entries
                .filter(e => e.motivo_principal === motivo)
                .slice(0, 5);
        });

        return {
            totalOriginal,
            totalProcesado: seQueda + seFusiona,
            totalFusionadas: seFusiona,
            totalExcluidas: seExcluye,
            totalPendientes: pendiente,
            erroresCriticos,
            porcentajes: {
                seQueda: (seQueda / totalOriginal) * 100,
                seFusiona: (seFusiona / totalOriginal) * 100,
                seExcluye: (seExcluye / totalOriginal) * 100,
                pendiente: (pendiente / totalOriginal) * 100
            },
            motivosRanking,
            casosRepresentativos
        };
    }

    /**
     * Procesa importación completa y genera auditoría
     */
    static async processImport(
        sites: SiteRecord[],
        fileName: string
    ): Promise<ImportAuditData> {
        const importId = this.generateImportId();
        const entries: AuditEntry[] = [];

        // Crear entradas de auditoría
        sites.forEach((site, index) => {
            const original = this.createOriginalRowData(site, importId, index);
            const processedRowUid = original.row_uid;
            const processed = this.createProcessedRowData(site, processedRowUid);
            const entry = this.createAuditEntry(original, processed);
            entries.push(entry);
        });

        // Detectar duplicados
        const duplicateMap = DuplicateDetectionEngine.detectAllDuplicates(entries);

        // Actualizar entries con info de duplicados
        entries.forEach(entry => {
            const dupInfo = duplicateMap.get(entry.row_uid);
            if (dupInfo) {
                entry.duplicateInfo = dupInfo;

                // Actualizar status según tipo de duplicado
                switch (dupInfo.duplicateType) {
                    case 'PLACE_ID':
                        entry.status = AuditStatus.DUPLICADO_MISMO_PLACE_ID;
                        break;
                    case 'COORDINATES':
                        entry.status = AuditStatus.DUPLICADO_COORDENADAS_IGUALES;
                        break;
                    case 'PROXIMITY':
                        entry.status = AuditStatus.DUPLICADO_POR_CERCANIA;
                        break;
                    case 'TEXT':
                        entry.status = AuditStatus.DUPLICADO_TEXTO_DIRECCION_CP;
                        break;
                }

                entry.motivo_principal = entry.status;
                entry.explicacion_humana = this.generateExplanation(entry.status, entry);

                // Si es el main row sugerido, se queda
                if (dupInfo.suggestedMainRow === entry.row_uid) {
                    entry.status_final = FinalDecision.SE_QUEDA;
                } else {
                    entry.status_final = FinalDecision.SE_FUSIONA;
                }
            } else {
                // No duplicado
                if (entry.status === AuditStatus.OK || entry.status === AuditStatus.NORMALIZADO) {
                    entry.status_final = FinalDecision.SE_QUEDA;
                } else if (
                    [
                        AuditStatus.NO_ENCONTRADO_EN_MAPS,
                        AuditStatus.DIRECCION_INCOMPLETA,
                        AuditStatus.CAMPOS_OBLIGATORIOS_FALTANTES
                    ].includes(entry.status)
                ) {
                    entry.status_final = FinalDecision.PENDIENTE;
                }
            }
        });

        const summary = this.generateSummary(entries);

        return {
            importId,
            timestamp: new Date().toISOString(),
            fileName,
            entries,
            summary,
            isApproved: false
        };
    }
}

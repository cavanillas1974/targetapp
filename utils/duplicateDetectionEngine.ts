// 🔍 MOTOR DE DETECCIÓN DE DUPLICADOS MULTINIVEL

import { AuditEntry, DuplicateInfo, AuditStatus } from '../types/auditTypes';

export class DuplicateDetectionEngine {

    /**
     * Calcula la distancia en metros entre dos coordenadas usando la fórmula de Haversine
     */
    private static calculateDistance(
        lat1: number,
        lng1: number,
        lat2: number,
        lng2: number
    ): number {
        const R = 6371e3; // Radio de la Tierra en metros
        const φ1 = (lat1 * Math.PI) / 180;
        const φ2 = (lat2 * Math.PI) / 180;
        const Δφ = ((lat2 - lat1) * Math.PI) / 180;
        const Δλ = ((lng2 - lng1) * Math.PI) / 180;

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c; // Distancia en metros
    }

    /**
     * Calcula similitud de texto usando algoritmo de Levenshtein normalizado
     */
    private static calculateTextSimilarity(str1: string, str2: string): number {
        const s1 = str1.toLowerCase().trim();
        const s2 = str2.toLowerCase().trim();

        if (s1 === s2) return 1.0;
        if (!s1 || !s2) return 0.0;

        const matrix: number[][] = [];
        const len1 = s1.length;
        const len2 = s2.length;

        for (let i = 0; i <= len1; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= len2; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= len1; i++) {
            for (let j = 1; j <= len2; j++) {
                const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
                matrix[i][j] = Math.min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost
                );
            }
        }

        const distance = matrix[len1][len2];
        const maxLen = Math.max(len1, len2);
        return 1 - distance / maxLen;
    }

    /**
     * Nivel 1: Detecta duplicados por place_id idéntico
     */
    static detectDuplicatesByPlaceId(entries: AuditEntry[]): Map<string, string[]> {
        const placeIdMap = new Map<string, string[]>();

        entries.forEach(entry => {
            const placeId = entry.processed.place_id;
            if (!placeId) return;

            if (!placeIdMap.has(placeId)) {
                placeIdMap.set(placeId, []);
            }
            placeIdMap.get(placeId)!.push(entry.row_uid);
        });

        // Filtrar solo los que tienen duplicados
        const duplicates = new Map<string, string[]>();
        placeIdMap.forEach((uids, placeId) => {
            if (uids.length > 1) {
                duplicates.set(placeId, uids);
            }
        });

        return duplicates;
    }

    /**
     * Nivel 2: Detecta duplicados por coordenadas exactamente iguales
     */
    static detectDuplicatesByCoordinates(entries: AuditEntry[]): Map<string, string[]> {
        const coordMap = new Map<string, string[]>();

        entries.forEach(entry => {
            const { lat, lng } = entry.processed;
            if (lat === undefined || lng === undefined) return;

            const coordKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;

            if (!coordMap.has(coordKey)) {
                coordMap.set(coordKey, []);
            }
            coordMap.get(coordKey)!.push(entry.row_uid);
        });

        // Filtrar solo duplicados
        const duplicates = new Map<string, string[]>();
        coordMap.forEach((uids, coordKey) => {
            if (uids.length > 1) {
                duplicates.set(coordKey, uids);
            }
        });

        return duplicates;
    }

    /**
     * Nivel 3: Detecta duplicados por cercanía (<= 30 metros)
     */
    static detectDuplicatesByProximity(
        entries: AuditEntry[],
        thresholdMeters: number = 30
    ): Array<{ entries: AuditEntry[]; distance: number }> {
        const duplicateGroups: Array<{ entries: AuditEntry[]; distance: number }> = [];
        const processed = new Set<string>();

        for (let i = 0; i < entries.length; i++) {
            if (processed.has(entries[i].row_uid)) continue;

            const entry1 = entries[i];
            const lat1 = entry1.processed.lat;
            const lng1 = entry1.processed.lng;

            if (lat1 === undefined || lng1 === undefined) continue;

            const group: AuditEntry[] = [entry1];

            for (let j = i + 1; j < entries.length; j++) {
                if (processed.has(entries[j].row_uid)) continue;

                const entry2 = entries[j];
                const lat2 = entry2.processed.lat;
                const lng2 = entry2.processed.lng;

                if (lat2 === undefined || lng2 === undefined) continue;

                const distance = this.calculateDistance(lat1, lng1, lat2, lng2);

                if (distance <= thresholdMeters) {
                    // Verificar similitud de nombre o dirección
                    const nameSimilarity = this.calculateTextSimilarity(
                        entry1.processed.nombre_normalizado,
                        entry2.processed.nombre_normalizado
                    );
                    const addressSimilarity = this.calculateTextSimilarity(
                        entry1.processed.direccion_normalizada,
                        entry2.processed.direccion_normalizada
                    );

                    // Si están muy cerca Y hay similitud de texto, son duplicados probables
                    if (nameSimilarity > 0.7 || addressSimilarity > 0.6) {
                        group.push(entry2);
                        processed.add(entry2.row_uid);
                    }
                }
            }

            if (group.length > 1) {
                duplicateGroups.push({
                    entries: group,
                    distance: thresholdMeters
                });
                group.forEach(e => processed.add(e.row_uid));
            }
        }

        return duplicateGroups;
    }

    /**
     * Nivel 4: Detecta duplicados por texto (dirección normalizada + CP)
     */
    static detectDuplicatesByText(entries: AuditEntry[]): Map<string, string[]> {
        const textMap = new Map<string, string[]>();

        entries.forEach(entry => {
            const address = entry.processed.direccion_normalizada;
            const cp = entry.processed.cp_normalizado;

            if (!address || !cp) return;

            const textKey = `${address.toUpperCase()}_${cp}`;

            if (!textMap.has(textKey)) {
                textMap.set(textKey, []);
            }
            textMap.get(textKey)!.push(entry.row_uid);
        });

        // Filtrar duplicados
        const duplicates = new Map<string, string[]>();
        textMap.forEach((uids, textKey) => {
            if (uids.length > 1) {
                duplicates.set(textKey, uids);
            }
        });

        return duplicates;
    }

    /**
     * Sugiere cuál fila debe ser la "principal" en un grupo de duplicados
     */
    static suggestMainRow(entries: AuditEntry[]): string {
        // Criterios (en orden de prioridad):
        // 1. Mayor confidence_score
        // 2. Tiene place_id
        // 3. Dirección más completa
        // 4. Primero en índice

        let bestEntry = entries[0];
        let bestScore = 0;

        entries.forEach(entry => {
            let score = 0;

            // Confidence score (peso 40%)
            score += (entry.processed.confidence_score || 0) * 40;

            // Tiene place_id (peso 30%)
            if (entry.processed.place_id) score += 30;

            // Completitud de dirección (peso 20%)
            const addressLength = entry.processed.direccion_normalizada?.length || 0;
            score += Math.min(addressLength / 100, 1) * 20;

            // Tiene lat/lng (peso 10%)
            if (entry.processed.lat && entry.processed.lng) score += 10;

            if (score > bestScore) {
                bestScore = score;
                bestEntry = entry;
            }
        });

        return bestEntry.row_uid;
    }

    /**
     * Ejecuta todos los niveles de detección y combina resultados
     */
    static detectAllDuplicates(entries: AuditEntry[]): Map<string, DuplicateInfo> {
        const duplicateMap = new Map<string, DuplicateInfo>();

        // Nivel 1: Place ID
        const placeIdDuplicates = this.detectDuplicatesByPlaceId(entries);
        placeIdDuplicates.forEach(uids => {
            const entriesGroup = entries.filter(e => uids.includes(e.row_uid));
            const mainRow = this.suggestMainRow(entriesGroup);

            uids.forEach(uid => {
                duplicateMap.set(uid, {
                    duplicatedWith: uids.filter(u => u !== uid),
                    duplicateType: 'PLACE_ID',
                    suggestedMainRow: mainRow
                });
            });
        });

        // Nivel 2: Coordenadas exactas
        const coordDuplicates = this.detectDuplicatesByCoordinates(entries);
        coordDuplicates.forEach(uids => {
            const entriesGroup = entries.filter(e => uids.includes(e.row_uid));
            const mainRow = this.suggestMainRow(entriesGroup);

            uids.forEach(uid => {
                if (!duplicateMap.has(uid)) {
                    duplicateMap.set(uid, {
                        duplicatedWith: uids.filter(u => u !== uid),
                        duplicateType: 'COORDINATES',
                        suggestedMainRow: mainRow
                    });
                }
            });
        });

        // Nivel 3: Cercanía
        const proximityDuplicates = this.detectDuplicatesByProximity(entries);
        proximityDuplicates.forEach(group => {
            const uids = group.entries.map(e => e.row_uid);
            const mainRow = this.suggestMainRow(group.entries);

            uids.forEach(uid => {
                if (!duplicateMap.has(uid)) {
                    duplicateMap.set(uid, {
                        duplicatedWith: uids.filter(u => u !== uid),
                        duplicateType: 'PROXIMITY',
                        suggestedMainRow: mainRow,
                        distanceMeters: group.distance
                    });
                }
            });
        });

        // Nivel 4: Texto
        const textDuplicates = this.detectDuplicatesByText(entries);
        textDuplicates.forEach(uids => {
            const entriesGroup = entries.filter(e => uids.includes(e.row_uid));
            const mainRow = this.suggestMainRow(entriesGroup);

            uids.forEach(uid => {
                if (!duplicateMap.has(uid)) {
                    duplicateMap.set(uid, {
                        duplicatedWith: uids.filter(u => u !== uid),
                        duplicateType: 'TEXT',
                        suggestedMainRow: mainRow
                    });
                }
            });
        });

        return duplicateMap;
    }
}

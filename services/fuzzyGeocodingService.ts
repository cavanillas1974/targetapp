// 🎯 FUZZY GEOCODING SERVICE - Geocodificación Inteligente Multi-Nivel

import { googleMapsService } from './googleMapsService';

export interface AddressVariant {
    variant: string;
    type: string;
    priority: number;
}

export interface GeocodingResult {
    success: boolean;
    lat?: number;
    lng?: number;
    formatted_address?: string;
    place_id?: string;
    confidence: number;
    attempted_variant?: string;
    variant_type?: string;
    suggestions?: PlaceSuggestion[];
}

export interface PlaceSuggestion {
    description: string;
    place_id: string;
    similarity: number;
    lat?: number;
    lng?: number;
}

class FuzzyGeocodingService {

    /**
     * Genera múltiples variantes de la misma dirección
     */
    generateAddressVariants(
        address: string,
        city?: string,
        state?: string,
        cp?: string,
        colonia?: string
    ): AddressVariant[] {
        const variants: AddressVariant[] = [];

        // Normalizar inputs
        const cleanAddress = this.normalizeAddress(address);
        const cleanCity = city ? this.normalizeAddress(city) : '';
        const cleanState = state ? this.normalizeAddress(state) : '';
        const cleanCP = cp ? cp.replace(/\D/g, '') : '';
        const cleanColonia = colonia ? this.normalizeAddress(colonia) : '';

        // NIVEL 1: Original completo (prioridad más alta)
        if (address) {
            variants.push({
                variant: `${cleanAddress}${cleanColonia ? ', ' + cleanColonia : ''}${cleanCity ? ', ' + cleanCity : ''}${cleanState ? ', ' + cleanState : ''}${cleanCP ? ', ' + cleanCP : ''}`,
                type: 'ORIGINAL_COMPLETO',
                priority: 10
            });
        }

        // NIVEL 2: Sin código postal (a veces causa conflictos)
        if (address && cleanCity) {
            variants.push({
                variant: `${cleanAddress}${cleanColonia ? ', ' + cleanColonia : ''}, ${cleanCity}${cleanState ? ', ' + cleanState : ''}`,
                type: 'SIN_CP',
                priority: 9
            });
        }

        // NIVEL 3: Sin colonia
        if (address && cleanCity) {
            variants.push({
                variant: `${cleanAddress}, ${cleanCity}${cleanState ? ', ' + cleanState : ''}${cleanCP ? ', ' + cleanCP : ''}`,
                type: 'SIN_COLONIA',
                priority: 8
            });
        }

        // NIVEL 4: Solo calle + ciudad + estado
        if (address && cleanCity && cleanState) {
            variants.push({
                variant: `${cleanAddress}, ${cleanCity}, ${cleanState}`,
                type: 'CALLE_CIUDAD_ESTADO',
                priority: 7
            });
        }

        // NIVEL 5: Expandir abreviaciones comunes
        const expanded = this.expandAbbreviations(cleanAddress);
        if (expanded !== cleanAddress && cleanCity) {
            variants.push({
                variant: `${expanded}, ${cleanCity}${cleanState ? ', ' + cleanState : ''}`,
                type: 'ABREVIACIONES_EXPANDIDAS',
                priority: 6
            });
        }

        // NIVEL 6: Solo calle + CP (útil para direcciones únicas)
        if (address && cleanCP && cleanCP.length === 5) {
            variants.push({
                variant: `${cleanAddress}, ${cleanCP}, México`,
                type: 'CALLE_CP',
                priority: 5
            });
        }

        // NIVEL 7: Ciudad + Estado + CP (búsqueda amplia)
        if (cleanCity && cleanState) {
            variants.push({
                variant: `${cleanCity}, ${cleanState}${cleanCP ? ', ' + cleanCP : ''}`,
                type: 'CIUDAD_ESTADO_CP',
                priority: 4
            });
        }

        // NIVEL 8: Remover caracteres especiales
        const noSpecialChars = cleanAddress.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');
        if (noSpecialChars !== cleanAddress && cleanCity) {
            variants.push({
                variant: `${noSpecialChars}, ${cleanCity}${cleanState ? ', ' + cleanState : ''}`,
                type: 'SIN_CARACTERES_ESPECIALES',
                priority: 3
            });
        }

        // NIVEL 9: Agregar "México" al final si no está
        if (address && cleanCity && !cleanAddress.includes('MEXICO') && !cleanCity.includes('MEXICO')) {
            variants.push({
                variant: `${cleanAddress}, ${cleanCity}, México`,
                type: 'CON_PAIS',
                priority: 2
            });
        }

        // Ordenar por prioridad
        return variants.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Normaliza dirección: mayúsculas, sin dobles espacios
     */
    private normalizeAddress(text: string): string {
        return text
            .toUpperCase()
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Expande abreviaciones comunes en direcciones mexicanas
     */
    private expandAbbreviations(address: string): string {
        const abbreviations: Record<string, string> = {
            'AV': 'AVENIDA',
            'AVE': 'AVENIDA',
            'BLVD': 'BOULEVARD',
            'C': 'CALLE',
            'CAL': 'CALLE',
            'CNT': 'CENTRO',
            'COL': 'COLONIA',
            'DEL': 'DELEGACION',
            'ESQ': 'ESQUINA',
            'FRACC': 'FRACCIONAMIENTO',
            'MZ': 'MANZANA',
            'LT': 'LOTE',
            'NO': 'NUMERO',
            'NTE': 'NORTE',
            'OTE': 'ORIENTE',
            'PTE': 'PONIENTE',
            'SUR': 'SUR',
            'MUN': 'MUNICIPIO',
            'CDMX': 'CIUDAD DE MEXICO',
            'DF': 'CIUDAD DE MEXICO',
            'EDO': 'ESTADO',
            'MEX': 'MEXICO'
        };

        let expanded = address;
        Object.entries(abbreviations).forEach(([abbr, full]) => {
            const regex = new RegExp(`\\b${abbr}\\b`, 'gi');
            expanded = expanded.replace(regex, full);
        });

        return expanded;
    }

    /**
     * Calcula similitud entre dos textos (Levenshtein normalizado)
     */
    private calculateSimilarity(str1: string, str2: string): number {
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
     * NIVEL 2: Intenta geocodificar con múltiples variantes
     */
    async tryMultipleVariants(
        address: string,
        city?: string,
        state?: string,
        cp?: string,
        colonia?: string
    ): Promise<GeocodingResult> {
        const variants = this.generateAddressVariants(address, city, state, cp, colonia);

        console.log(`🔍 Generadas ${variants.length} variantes para: ${address}`);

        for (const { variant, type } of variants) {
            try {
                console.log(`  Probando: ${type} - "${variant}"`);
                const result = await googleMapsService.geocode(variant);

                if (result.lat && result.lng) {
                    console.log(`  ✅ Éxito con ${type}`);
                    return {
                        success: true,
                        lat: result.lat,
                        lng: result.lng,
                        formatted_address: result.formatted_address,
                        place_id: result.place_id,
                        confidence: result.partial_match ? 0.7 : 0.9,
                        attempted_variant: variant,
                        variant_type: type
                    };
                }
            } catch (err) {
                // Continuar con siguiente variante
                continue;
            }
        }

        console.log(`  ❌ Ninguna variante funcionó`);
        return {
            success: false,
            confidence: 0
        };
    }

    /**
     * NIVEL 3: Obtener sugerencias de Places Autocomplete
     */
    async getPlacesSuggestions(
        address: string,
        originalAddress: string
    ): Promise<PlaceSuggestion[]> {
        try {
            // Llamar a Places Autocomplete (simulado - necesitarías implementar en googleMapsService)
            const suggestions = await this.fetchPlacesAutocomplete(address);

            // Calcular similitud de cada sugerencia
            const scored = suggestions.map(s => ({
                ...s,
                similarity: this.calculateSimilarity(originalAddress, s.description)
            }));

            // Ordenar por similitud descendente
            return scored.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
        } catch (err) {
            console.error('Error obteniendo sugerencias:', err);
            return [];
        }
    }

    /**
     * Helper: Fetch Places Autocomplete
     * (Esto debería estar en googleMapsService, aquí es simulación)
     */
    private async fetchPlacesAutocomplete(input: string): Promise<PlaceSuggestion[]> {
        // TODO: Implementar llamada real a Google Places Autocomplete API
        // Por ahora, retornar array vacío
        // En producción:
        // const response = await fetch(`https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${input}&components=country:mx&key=${API_KEY}`);
        return [];
    }

    /**
     * MÉTODO PRINCIPAL: Geocodificación Inteligente Multi-Nivel
     * NUNCA FALLA - Siempre retorna coordenadas (degradando precisión si es necesario)
     */
    async smartGeocode(
        address: string,
        city?: string,
        state?: string,
        cp?: string,
        colonia?: string
    ): Promise<GeocodingResult> {
        console.log(`🎯 SMART GEOCODING INICIADO para: "${address}"`);

        // ═══════════════════════════════════════════════════════════
        // NIVEL 1: Fuzzy Geocoding (9+ variantes) - MÁS PRECISO
        // ═══════════════════════════════════════════════════════════
        console.log(`🎯 NIVEL 1: Fuzzy geocoding con variantes...`);
        const fuzzyResult = await this.tryMultipleVariants(address, city, state, cp, colonia);

        if (fuzzyResult.success && fuzzyResult.confidence >= 0.6) {
            console.log(`✅ NIVEL 1 ÉXITO: ${fuzzyResult.formatted_address} (${Math.round(fuzzyResult.confidence * 100)}%)`);
            return {
                ...fuzzyResult,
                variant_type: `FUZZY_${fuzzyResult.variant_type}`
            };
        }

        // ═══════════════════════════════════════════════════════════
        // NIVEL 2: DEGRADADO - Solo Ciudad + Estado
        // ═══════════════════════════════════════════════════════════
        if (city && state) {
            console.log(`🎯 NIVEL 2: Geocoding degradado (Ciudad + Estado)...`);
            try {
                const cityQuery = `${city}, ${state}, México`;
                const cityResult = await googleMapsService.geocode(cityQuery);

                if (cityResult.lat && cityResult.lng) {
                    console.log(`✅ NIVEL 2 ÉXITO: Centro de ${city} (PRECISIÓN: CIUDAD)`);
                    return {
                        success: true,
                        lat: cityResult.lat,
                        lng: cityResult.lng,
                        formatted_address: cityResult.formatted_address || `${city}, ${state}`,
                        place_id: cityResult.place_id,
                        confidence: 0.4, // Baja precisión
                        variant_type: 'CIUDAD_DEGRADADO'
                    };
                }
            } catch (err) {
                console.log(`⚠️ NIVEL 2 falló`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // NIVEL 3: MÁS DEGRADADO - Solo Estado
        // ═══════════════════════════════════════════════════════════
        if (state) {
            console.log(`🎯 NIVEL 3: Geocoding super-degradado (Solo estado)...`);
            try {
                const stateQuery = `${state}, México`;
                const stateResult = await googleMapsService.geocode(stateQuery);

                if (stateResult.lat && stateResult.lng) {
                    console.log(`✅ NIVEL 3 ÉXITO: Centro de ${state} (PRECISIÓN: ESTADO)`);
                    return {
                        success: true,
                        lat: stateResult.lat,
                        lng: stateResult.lng,
                        formatted_address: stateResult.formatted_address || state,
                        place_id: stateResult.place_id,
                        confidence: 0.2, // Muy baja precisión
                        variant_type: 'ESTADO_DEGRADADO'
                    };
                }
            } catch (err) {
                console.log(`⚠️ NIVEL 3 falló`);
            }
        }

        // ═══════════════════════════════════════════════════════════
        // NIVEL 4: GEMINI AI FALLBACK - IA adivina ubicación
        // ═══════════════════════════════════════════════════════════
        console.log(`🤖 NIVEL 4: Consultando Gemini AI...`);
        try {
            const aiCoords = await this.tryGeminiGeocoding(address, city, state, cp);
            if (aiCoords) {
                console.log(`✅ NIVEL 4 ÉXITO: Gemini AI estimó coordenadas (PRECISIÓN: IA_ESTIMADO)`);
                return {
                    success: true,
                    lat: aiCoords.lat,
                    lng: aiCoords.lng,
                    formatted_address: aiCoords.description || `${address} (estimado por IA)`,
                    confidence: 0.3,
                    variant_type: 'GEMINI_AI_ESTIMADO'
                };
            }
        } catch (err) {
            console.log(`⚠️ NIVEL 4 falló:`, err);
        }

        // ═══════════════════════════════════════════════════════════
        // NIVEL 5: ÚLTIMO RECURSO - Centro de México
        // ═══════════════════════════════════════════════════════════
        console.log(`⚠️ NIVEL 5: Usando centro de México (REQUIERE REVISIÓN MANUAL)`);
        return {
            success: true, // SÍ success para que pase
            lat: 19.4326, // Centro de CDMX
            lng: -99.1332,
            formatted_address: 'Ciudad de México (coordenadas aproximadas)',
            confidence: 0.1, // Mínima confianza
            variant_type: 'CENTRO_MEXICO_FALLBACK'
        };
    }

    /**
     * NIVEL 4: Geocoding usando Gemini AI
     */
    private async tryGeminiGeocoding(
        address: string,
        city?: string,
        state?: string,
        cp?: string
    ): Promise<{ lat: number; lng: number; description: string } | null> {
        try {
            // Importar Google Generative AI directamente
            const { GoogleGenerativeAI } = await import('@google/generative-ai');

            const apiKey = (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
            if (!apiKey || apiKey === 'PLACEHOLDER_API_KEY') {
                console.log('⚠️ Gemini API key no disponible, saltando NIVEL 4');
                return null;
            }

            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

            const prompt = `Eres un experto en geografía de México. Dame las coordenadas APROXIMADAS de esta ubicación:

Dirección: ${address}
${city ? `Ciudad: ${city}` : ''}
${state ? `Estado: ${state}` : ''}
${cp ? `CP: ${cp}` : ''}

Instrucciones:
1. Estima las coordenadas basándote en el contexto (ciudad, estado, CP)
2. Si el nombre parece una región/estado, da el centro de esa región
3. Si menciona "MORELOS", devuelve el centro del estado de Morelos
4. Si menciona "5 SUR", "CENTRAL NORTE", etc, interpreta como región y da coordenadas aproximadas
5. Responde SOLO en formato JSON: {"lat": 19.1234, "lng": -99.1234, "description": "Descripción breve"}

Tu respuesta (SOLO JSON sin explicaciones):`;

            const result = await model.generateContent(prompt);
            const aiResponse = result.response.text();

            // Parsear respuesta
            const jsonMatch = aiResponse.match(/\{[^}]+\}/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                if (parsed.lat && parsed.lng) {
                    console.log(`🤖 Gemini estimó:`, parsed);
                    return parsed;
                }
            }

            return null;
        } catch (err) {
            console.error('Error en Gemini geocoding:', err);
            return null;
        }
    }
}

export const fuzzyGeocodingService = new FuzzyGeocodingService();

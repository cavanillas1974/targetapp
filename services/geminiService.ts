
import { GoogleGenAI, Type } from "@google/genai";

// Helper to get the API Key from various possible Vite/Process locations
const getRawApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

let aiInstance: GoogleGenAI | null = null;

const getAI = () => {
  const key = getRawApiKey();

  if (!aiInstance) {
    if (!key || key === 'PLACEHOLDER_API_KEY') {
      console.error("CRITICAL: Gemini API Key is missing. Current key value:", key);
      throw new Error("GoogleGenAI no ha sido inicializado. Verifica tu API Key en .env.local");
    }

    try {
      // Usamos apiVersion 'v1beta' para soportar todas las características y modelos flash
      aiInstance = new GoogleGenAI({ apiKey: key, apiVersion: 'v1beta' });
      console.log("Gemini AI (v1beta) initialized successfully with key starting with:", key.substring(0, 4));
    } catch (e) {
      console.error("Error creating GoogleGenAI instance:", e);
      throw e;
    }
  }
  return aiInstance;
};

export const geminiService = {
  async cleanAddresses(rawText: string) {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Limpia y normaliza estas direcciones de tiendas y preserva los metadatos de negocio: ${rawText}`,
      config: {
        systemInstruction: `Eres un experto en GIS y logística para iamanos OptiFlot™ en México.
        OBJETIVO: Convertir desorden en tabla estándar conservando información crítica de negocio.
        REGLAS DE LIMPIEZA:
        1. Quitar dobles espacios, caracteres raros (#, S/N).
        2. Separar calle y número de colonia y CP.
        3. Normalizar abreviaturas (Av. -> Avenida, Col. -> Colonia).
        4. Detectar duplicados (misma dirección con distinto nombre).
        5. PRESERVAR: Marca, Región, Centro Comercial, Canal, Número de Proyecto y RANKING si están presentes.
        
        FORMATO DE SALIDA (JSON):
        { 
          sites: [{ 
            site_id, // ID original si existe o autogenerado "IAM-XXX"
            name_sitio, // Nombre original o comercial
            direccion_normalizada, // Calle + # + Col + CP + Ciudad + Estado
            cp, colonia, municipio, city, state, country, lat, lng, 
            status, // "OK" | "Falta CP" | "Falta número" | "Ambigua"
            marca, region, centro_comercial, banneres, canal, numero_proyecto, desarrollo, tienda_alias, ranking
          }] 
        }`,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sites: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  site_id: { type: Type.STRING },
                  name_sitio: { type: Type.STRING },
                  direccion_normalizada: { type: Type.STRING },
                  cp: { type: Type.STRING },
                  colonia: { type: Type.STRING },
                  municipio: { type: Type.STRING },
                  city: { type: Type.STRING },
                  state: { type: Type.STRING },
                  country: { type: Type.STRING },
                  lat: { type: Type.NUMBER },
                  lng: { type: Type.NUMBER },
                  status: { type: Type.STRING },
                  marca: { type: Type.STRING },
                  region: { type: Type.STRING },
                  centro_comercial: { type: Type.STRING },
                  banneres: { type: Type.STRING },
                  canal: { type: Type.STRING },
                  numero_proyecto: { type: Type.STRING },
                  desarrollo: { type: Type.STRING },
                  tienda_alias: { type: Type.STRING },
                  ranking: { type: Type.STRING }
                },
                required: ['name_sitio', 'direccion_normalizada', 'status']
              }
            }
          }
        }
      }
    });
    return JSON.parse(response.text || '{"sites":[]}');
  },

  async getChatResponse(history: { role: string, text: string }[], message: string) {
    const chat = getAI().chats.create({
      model: 'gemini-2.0-flash',
      config: {
        systemInstruction: `Eres el asistente oficial de iamanos OptiFlot™ (SISTEMA INTEGRAL DE RUTEO LOGÍSTICO). 
        Responde en español de forma profesional y clara.
        CONOCIMIENTO:
        - Servicios: Almacenamiento, distribución e implementación.
        - Diferenciador: La "Regla de Oro" - Rutas que avanzan en una sola dirección desde la base, sin cruces.
        - Cobertura: Nacional con bases en CDMX (Ecatepec), Monterrey, Guadalajara, Tijuana, León y Sinaloa.
        - Evidencia: Fotos obligatorias (antes/después), firma digital, GPS + timestamp.
        - Flota: Camionetas propias de diversos tipos.
        - Ubicación: Ecatepec de Morelos (Calle Olímpica MZ9 LT17, Col Olímpica 68).
        - No especules con precios; pide datos para que un coordinador contacte al cliente.`,
      },
      history: history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.text }]
      })),
    });

    const result = await chat.sendMessage({ message });
    return result.text;
  },

  async suggestOptimalRouteCount(stops: any[], base: any, config: any) {
    const response = await getAI().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: `Analiza ${stops.length} sitios de iamanos desde la base ${base.name}.
      CONFIGURACIÓN:
      - Fecha Inicio: ${config.startDate}
      - Fecha Término: ${config.endDate}
      - Capacidad: ${config.storesPerDay} paradas/vía al día.
      - Tiempo en sitio: ${config.timePerVisit} min.
      
      OBJETIVO: Sugerir el número MÍNIMO de rutas necesarias para cubrir todo en el rango de fechas.
      Devuelve JSON: { "suggestedRouteCount": number, "reasoning": "string" }`,
      config: { responseMimeType: 'application/json' }
    });
    return JSON.parse(response.text || '{"suggestedRouteCount": 5}');
  },

  async optimizeRoute(stops: any[], base: any, config: any) {
    const prompt = `BASE PRINCIPAL: ${base.name} (${base.lat}, ${base.lng}).
      RANGO FECHAS: ${config.startDate} a ${config.endDate}.
      PARADAS POR DÍA: ${config.storesPerDay}.
      TIEMPO POR VISITA: ${config.timePerVisit} min.
      TOTAL RUTAS PERMITIDAS: ${config.routes}.
      TIENDAS A PROCESAR: ${JSON.stringify(stops.map(s => ({ id: s.id, name: s.name_sitio, lat: s.lat, lng: s.lng })))}.
      
      TAREA: Distribuye las tiendas en rutas lógicas.
      REGLAS CRÍTICAS:
      1. REGLA DE ORO: Las rutas nacen en la Base y avanzan en secuencia radial (cercano -> lejano). SIN CRUCES NI ZIGZAGS.
      2. BALANCEO: Distribuye equitativamente el número de tiendas entre las rutas.
      3. CRONOGRAMA: Asigna una FECHA a cada ruta dentro del rango ${config.startDate} a ${config.endDate}.
      
      RETORNO (JSON):
      {
        "routes": [
          {
            "id": "R1",
            "date": "YYYY-MM-DD",
            "driverName": "Técnico Especializado",
            "base": "${base.name}",
            "color": "#2298E0",
            "stopIds": ["id1", "id2"],
            "totalKm": 120,
            "estTimeMinutes": 240
          }
        ]
      }`;

    const response = await getAI().models.generateContent({
      model: 'gemini-2.0-flash',
      contents: prompt,
      config: {
        systemInstruction: `Experto en ruteo logístico avanzado para México. Prioriza el ahorro de combustible y la secuencia lógica radial.`,
        responseMimeType: 'application/json'
      }
    });
    return JSON.parse(response.text || '{"routes":[]}');
  }
};

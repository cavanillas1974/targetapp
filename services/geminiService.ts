import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Helper to get the API Key from various possible Vite/Process locations
const getRawApiKey = () => {
  return (import.meta as any).env?.VITE_GEMINI_API_KEY || '';
};

let genAI: GoogleGenerativeAI | null = null;

const getAI = () => {
  const key = getRawApiKey();

  if (!genAI) {
    if (!key || key === 'PLACEHOLDER_API_KEY') {
      console.error("CRITICAL: Gemini API Key is missing.");
      throw new Error("GoogleGenAI no ha sido inicializado. Verifica tu API Key en .env.local");
    }

    try {
      genAI = new GoogleGenerativeAI(key);
      console.log("Gemini AI initialized successfully (Model: gemini-1.5-pro)");
    } catch (e) {
      console.error("Error creating GoogleGenAI instance:", e);
      throw e;
    }
  }
  return genAI;
};

// --- MOCK DATA GENERATORS (FALLBACK) ---
const getMockChatResponse = (msg: string) => {
  return `[MODO SIMULADO - SIN CONEXIÓN A GEMINI]
  
Entendido. Como el sistema de IA no está respondiendo (Error de API/Red), te daré una respuesta basada en protocolos estándar:

Sobre "${msg}": 
El sistema OptiFlot calcula esto basándose en la distancia geodésica y las restricciones de tráfico promedio. Para las rutas mostradas, se priorizó la cobertura radial desde el Centro de Distribución para minimizar el consumo de combustible (-15% est).

¿Necesitas ajustar algún parámetro manual?`;
};

const getMockCleanAddresses = (text: string) => {
  return {
    sites: [
      {
        site_id: "MOCK-001",
        name_sitio: "Tienda Ejemplo 1 (Simulada)",
        direccion_normalizada: "Av. Reforma 222, Juárez, 06600, CDMX",
        status: "OK",
        lat: 19.4294,
        lng: -99.1627
      },
      {
        site_id: "MOCK-002",
        name_sitio: "Tienda Ejemplo 2 (Simulada)",
        direccion_normalizada: "Insurgentes Sur 100, Roma, 06700, CDMX",
        status: "OK",
        lat: 19.4200,
        lng: -99.1630
      }
    ]
  };
};

const getMockOptimization = (stops: number) => {
  return {
    routes: [
      {
        id: "RUTA-SIM-1",
        date: new Date().toISOString().split('T')[0],
        driverName: "Operador Simulado A",
        base: "CDMX",
        color: "#3b82f6",
        stopIds: [],
        totalKm: 45.5,
        estTimeMinutes: 180
      }
    ]
  };
};

// --- HELPER FOR SAFE JSON PARSING ---
const safeJsonParse = (text: string, fallback: any) => {
  try {
    // Remove markdown code blocks if present
    const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
    // Validate if it looks like JSON starts (basic check)
    if (!clean.startsWith('{') && !clean.startsWith('[')) {
      throw new Error("Not JSON");
    }
    return JSON.parse(clean);
  } catch (e) {
    console.warn("JSON Parse Error in safeJsonParse:", e);
    return fallback;
  }
};

export const geminiService = {
  async cleanAddresses(rawText: string) {
    try {
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = `
          Eres un experto en GIS. Limpia y normaliza: "${rawText}".
          SALIDA JSON: { "sites": [{ "name_sitio", "direccion_normalizada", "status", "lat": 0, "lng": 0 }] }
        `;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return safeJsonParse(text, getMockCleanAddresses(rawText));
    } catch (e) {
      console.warn("Gemini API Error (CleanAddresses). Using Mock.", e);
      return getMockCleanAddresses(rawText);
    }
  },

  async getChatResponse(history: { role: string, text: string }[], message: string, projectContext?: any) {
    try {
      // Contexto manual
      let contextStr = "";
      if (projectContext) {
        contextStr = `[CONTEXTO: Proyecto "${projectContext.metadata?.name}"]`;
      }

      const model = getAI().getGenerativeModel({ model: "gemini-1.5-pro" });

      const chat = model.startChat({
        history: history
          .filter((_, index) => index > 0 || history[0].role === 'user')
          .map(h => ({
            role: h.role === 'user' ? 'user' : 'model',
            parts: [{ text: h.text }]
          }))
      });

      const fullMessage = `${contextStr}\n\nPREGUNTA: ${message}`;
      const result = await chat.sendMessage(fullMessage);
      return result.response.text();
    } catch (e) {
      console.error("Gemini Chat Error:", e);
      return getMockChatResponse(message);
    }
  },

  async suggestOptimalRouteCount(stops: any[], base: any, config: any) {
    const fallback = { suggestedRouteCount: Math.ceil(stops.length / 5), reasoning: "Cálculo simulado por fallo de API." };
    try {
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = `Analiza ${stops.length} sitios. Sugiere rutas JSON: { "suggestedRouteCount": number, "reasoning": "string" }`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return safeJsonParse(text, fallback);
    } catch (e) {
      console.warn("Gemini API Error (Suggest). Using Mock.", e);
      return fallback;
    }
  },

  async optimizeRoute(stops: any[], base: any, config: any) {
    const fallback = getMockOptimization(stops.length);
    try {
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-pro" });
      const prompt = `Optimiza rutas. JSON Output: { "routes": [...] }`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return safeJsonParse(text, fallback);
    } catch (e) {
      console.warn("Gemini API Error (Optimize). Using Mock.", e);
      return fallback;
    }
  }
};

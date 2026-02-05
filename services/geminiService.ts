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
// MOCK CHAT RESPONSE REMOVED


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
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `
          Eres un experto en GIS. Limpia y normaliza: "${rawText}".
          SALIDA JSON: { "sites": [{ "name_sitio", "direccion_normalizada", "status", "lat": 0, "lng": 0 }] }
        `;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return safeJsonParse(text, { sites: [] });
    } catch (e) {
      console.warn("Gemini API Error (CleanAddresses).", e);
      throw new Error("Error normalizando direcciones con IA.");
    }
  },

  async getChatResponse(history: { role: string, text: string }[], message: string, projectContext?: any) {
    try {
      // Contexto manual enriquecido
      let contextStr = "";
      if (projectContext) {
        if (projectContext.contextSummary) {
          contextStr = projectContext.contextSummary; // Usar el resumen pre-formateado si existe
        } else {
          // Fallback simple por si cambia la estructura
          contextStr = `[CONTEXTO PROYECTO: ${JSON.stringify(projectContext, null, 2)}]`;
        }
      }

      // Use gemini-1.5-flash as it is generally available and faster
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-flash" });

      // Transformar historial para API y limitar longitud para ahorrar tokens/evitar errores
      const formattedHistory = history
        .slice(-10) // Mantener solo los últimos 10 mensajes para contexto inmediato
        .filter((_, index) => index > 0 || history[0].role === 'user') // Filtrar saludos iniciales si son system messages
        .map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        }));

      const chat = model.startChat({
        history: formattedHistory
      });

      // Instrucción maestra para que actúe como experto logístico
      const systemInstruction = `
        ACTÚA COMO: Cerebro Logístico OptiFlot (Experto en logística, ruteo y análisis de datos).
        
        UTILIZA ESTE CONTEXTO EXCLUSIVO PARA RESPONDER (No inventes datos):
        ${contextStr}
        
        INSTRUCCIONES:
        1. Sé preciso con los números (tiendas, kilómetros, costos).
        2. Si no tienes el dato exacto en el contexto, dilo honestamente.
        3. Mantén un tono profesional, ejecutivo y estratégico.
      `;

      const fullMessage = `${systemInstruction}\n\nPREGUNTA USUARIO: ${message}`;
      const result = await chat.sendMessage(fullMessage);
      return result.response.text();
    } catch (e: any) {
      console.error("Gemini Chat Error:", e);
      // Return clear error message instead of mock
      if (e.message?.includes('404') || e.message?.includes('not found')) {
        return "ERROR DE CONEXIÓN: El servicio de IA no está disponible con la API Key actual. (Error 404 - Model Not Found). Por favor verifica tu configuración y permisos de API.";
      }
      return `ERROR DEL SISTEMA: ${e.message || 'Error desconocido al conectar con Gemini.'}`;
    }
  },

  async suggestOptimalRouteCount(stops: any[], base: any, config: any) {
    // No mock available.
    try {
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Analiza ${stops.length} sitios. Sugiere rutas JSON: { "suggestedRouteCount": number, "reasoning": "string" }`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return safeJsonParse(text, { suggestedRouteCount: 1, reasoning: "Fallback por error de parsing." });
    } catch (e: any) {
      console.warn("Gemini API Error (Suggest).", e);
      throw new Error(`Error en IA: ${e.message}`);
    }
  },

  async optimizeRoute(stops: any[], base: any, config: any) {
    // No mock available.
    try {
      const model = getAI().getGenerativeModel({ model: "gemini-1.5-flash" });
      const prompt = `Optimiza rutas. JSON Output: { "routes": [...] }`;
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      return safeJsonParse(text, { routes: [] });
    } catch (e: any) {
      console.warn("Gemini API Error (Optimize).", e);
      throw new Error(`Error en IA: ${e.message}`);
    }
  }
};

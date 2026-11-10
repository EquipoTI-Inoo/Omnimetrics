import { GoogleGenAI } from "@google/genai";
import { AIAnalysisResult } from "../types";

// Initialize Gemini
// Note: In a real production app, ensure API_KEY is secure.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

// --- SYSTEM INSTRUCTION FOR SUPPORT BOT ---
const SUPPORT_SYSTEM_INSTRUCTION = `
Eres "OmniBot", el asistente de soporte técnico especializado para la plataforma "OmniMetrics AI".
Tu objetivo es ayudar a los usuarios a configurar integraciones, entender sus dashboards y solucionar errores técnicos.

CONOCIMIENTO DE LA PLATAFORMA:
1. **Conexiones API**:
   - Meta Ads: Requiere un Token de Acceso (Access Token). Sugiere usar el "Graph API Explorer" si no tienen uno.
   - Google Ads: Requiere OAuth Token, Developer Token y Customer ID.
   - Kommo CRM: Requiere Subdominio, Integration ID, Secret Key y Bearer Token. Errores comunes: poner la URL completa en vez del subdominio.
   - Si un usuario tiene error 403 en Kommo, suele ser porque su cuenta es 'amocrm.com' en lugar de 'kommo.com' o el User-Agent falta.

2. **Dashboards y Reportes**:
   - Si el dashboard está vacío (0), es porque no han conectado la API en la sección "Conexiones".
   - Los datos se actualizan cada 5 minutos automáticamente.
   - Existe un "Constructor" para crear tablas personalizadas.

3. **Solución de Problemas**:
   - "Failed to fetch": Problema de red o bloqueo CORS (común en navegadores).
   - "Token Invalid": La credencial ha expirado.

TONO Y ESTILO:
- Sé amable, conciso y técnico pero accesible.
- Usa emojis ocasionalmente para ser amigable 🤖.
- Si no sabes la respuesta, sugiere contactar a soporte humano en admin@omnimetrics.ai.
- Responde siempre en Español.

FORMATO DE RESPUESTA:
- Usa Markdown para negritas y listas si es necesario.
`;

export const generateMarketingInsights = async (
  contextData: any,
  goal: string
): Promise<AIAnalysisResult> => {
  try {
    const prompt = `
      Actúa como un analista de datos de marketing digital senior.
      
      Objetivo del negocio actual: "${goal}".
      
      Aquí están los datos consolidados en formato JSON de Meta, Google, LinkedIn y CRM:
      ${JSON.stringify(contextData, null, 2)}
      
      Por favor, analiza estos datos y proporciona una respuesta en formato JSON estricto con la siguiente estructura:
      {
        "trends": ["Tendencia 1", "Tendencia 2"],
        "optimizations": ["Optimización sugerida 1", "Optimización sugerida 2", "Optimización sugerida 3"],
        "priority": "Alta" | "Media" | "Baja",
        "rawAnalysis": "Un resumen breve en texto plano de 2 o 3 oraciones sobre la salud general de la cuenta."
      }

      Enfócate en recomendaciones accionables para mejorar el ROI, reducir CPA o mejorar la tasa de cierre según el objetivo.
      Responde SOLO con el JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) {
        throw new Error("No response from AI");
    }

    const parsed = JSON.parse(text);
    return {
      trends: parsed.trends || [],
      optimizations: parsed.optimizations || [],
      priority: parsed.priority || 'Media',
      rawAnalysis: parsed.rawAnalysis || 'Análisis completado.'
    };

  } catch (error) {
    console.error("Error generating insights:", error);
    return {
      trends: ["No se pudieron detectar tendencias debido a un error."],
      optimizations: ["Verifica tu conexión a internet.", "Asegúrate de que la API Key sea válida."],
      priority: "Baja",
      rawAnalysis: "Error al conectar con Gemini."
    };
  }
};

// --- NEW CHAT FUNCTION ---
export const getSupportResponse = async (history: {role: 'user' | 'model', text: string}[], userMessage: string): Promise<string> => {
    try {
        const chat = ai.chats.create({
            model: 'gemini-2.5-flash',
            config: {
                systemInstruction: SUPPORT_SYSTEM_INSTRUCTION,
            },
            history: history.map(h => ({
                role: h.role,
                parts: [{ text: h.text }]
            }))
        });

        const result = await chat.sendMessage({ message: userMessage });
        return result.text || "Lo siento, no pude procesar tu solicitud en este momento.";
    } catch (error) {
        console.error("Chat Error:", error);
        return "⚠️ Error de conexión con el asistente. Por favor verifica tu API Key o conexión a internet.";
    }
};
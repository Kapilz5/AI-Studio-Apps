import { GoogleGenAI, Type } from "@google/genai";
import { Benefit, CardCategory } from "../types";
import { getAPIKey } from "../utils/storage";

const getAI = () => {
  // 1. Priority: Manual Key from Settings (Stored securely/obfuscated)
  let apiKey = getAPIKey();

  // 2. Fallback: Environment Variables (Vite/Next.js/React App)
  if (!apiKey) {
    if (typeof process !== 'undefined' && process.env) {
      apiKey = process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY || process.env.REACT_APP_API_KEY;
    }
    
    if (!apiKey) {
      try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env) {
          // @ts-ignore
          apiKey = import.meta.env.VITE_API_KEY || import.meta.env.NEXT_PUBLIC_API_KEY || import.meta.env.API_KEY;
        }
      } catch (e) {
        // Ignore
      }
    }
    
    if (!apiKey && typeof window !== 'undefined') {
       // @ts-ignore
       apiKey = window.ENV?.API_KEY || window.ENV?.NEXT_PUBLIC_API_KEY;
    }
  }
  
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    console.error("Gemini Error: API Key is missing.");
    throw new Error("API Key missing. Please add it in Settings.");
  }
  
  return new GoogleGenAI({ apiKey });
};

// Robust JSON extractor that finds the first '{' and last '}'
const extractJSON = (text: string) => {
  if (!text) return null;
  try {
    // 1. Try cleaning markdown code blocks first
    const clean = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    // 2. If that fails, try finding the JSON object boundaries
    try {
      const firstOpen = text.indexOf('{');
      const lastClose = text.lastIndexOf('}');
      if (firstOpen !== -1 && lastClose !== -1) {
        const jsonCandidate = text.substring(firstOpen, lastClose + 1);
        return JSON.parse(jsonCandidate);
      }
    } catch (e2) {
      console.warn("JSON Extraction failed for text:", text.substring(0, 50) + "...");
    }
    return null;
  }
};

export const fetchCardBenefits = async (cardName: string, category: CardCategory): Promise<{ benefits: Omit<Benefit, 'id'>[], error?: string }> => {
  try {
    const ai = getAI();
    const modelName = "gemini-3-flash-preview"; 
    
    const response = await ai.models.generateContent({
      model: modelName,
      contents: { 
        parts: [{ 
          text: `Extract official benefits for the Indian ${category} card: "${cardName}".
          Return ONLY a JSON array of benefits.
          Schema: { "category": string, "detail": string }.
          Available Categories: "Shopping", "Food", "Entertainment", "Fuel", "Forex", "Travel", "Other".` 
        }] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: { type: Type.STRING },
              detail: { type: Type.STRING },
            },
            required: ["category", "detail"],
          },
        },
      },
    });

    const parsed = extractJSON(response.text || "");
    if (Array.isArray(parsed)) {
      return { benefits: parsed };
    }
    return { benefits: [] };
  } catch (error: any) {
    console.error(`Gemini fetchCardBenefits Error:`, error);
    return { benefits: [], error: error.message || "Service unavailable" };
  }
};

export const getCardSuggestions = async (userInput: string, category: CardCategory): Promise<{ suggestions: string[], error?: string }> => {
  if (!userInput || userInput.trim().length < 2) return { suggestions: [] };
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [{
          text: `Suggest up to 5 popular Indian ${category} card names starting with or similar to: "${userInput}".
          Format as JSON: { "suggestions": ["Name 1", "Name 2"] }.`
        }]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["suggestions"]
        }
      }
    });
    
    const parsed = extractJSON(response.text || "");
    const suggestions = parsed?.suggestions;
    
    if (Array.isArray(suggestions)) {
      return { suggestions };
    }
    return { suggestions: [] };
  } catch (error: any) {
    console.error("Gemini getCardSuggestions Error:", error);
    return { suggestions: [], error: error.message || "AI Service Error" };
  }
};

export const analyzeCardImages = async (frontBase64: string, backBase64: string): Promise<any> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: frontBase64 } },
          { inlineData: { mimeType: "image/jpeg", data: backBase64 } },
          {
            text: `Identify the card from these images. Extract: name, category (Credit/Debit), network (Visa/Mastercard/Amex/RuPay), last 4 digits, expiry (MM/YYYY), CVV. Return as JSON.`,
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            cardCategory: { type: Type.STRING },
            cardType: { type: Type.STRING },
            fullNumber: { type: Type.STRING },
            cvv: { type: Type.STRING },
            last4: { type: Type.STRING },
            expiryMonth: { type: Type.INTEGER },
            expiryYear: { type: Type.INTEGER },
            suggestedAnnualFee: { type: Type.NUMBER },
          },
          required: ["name", "cardCategory", "last4", "expiryMonth", "expiryYear"],
        },
      },
    });

    return extractJSON(response.text || "") || {};
  } catch (error) {
    console.error("Gemini analyzeCardImages error:", error);
    return null;
  }
};
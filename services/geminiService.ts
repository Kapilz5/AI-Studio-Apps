import { GoogleGenAI, Type } from "@google/genai";
import { Benefit, CardCategory } from "../types";
import { UI_STRINGS } from "../locales/en";

const getAI = () => {
  // Prioritize NEXT_PUBLIC_API_KEY (Vercel/Client-side) then fall back to API_KEY
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || process.env.API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    console.error("Gemini Error: API Key is missing. Checked NEXT_PUBLIC_API_KEY and API_KEY.");
    throw new Error("API Key is missing. Please check your Vercel environment variables.");
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
    // Fallback logic could be implemented here if needed, but we stick to the requested model.
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
    // Return the actual error message so the UI can show it (e.g. "API Key Missing")
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
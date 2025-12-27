
import { GoogleGenAI, Type } from "@google/genai";
import { Benefit, CardCategory } from "../types";

// Helper to initialize AI safely with debug logs
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "") {
    console.error("CRITICAL: API_KEY is missing from environment variables.");
    throw new Error("API Key Missing. Please check your project settings.");
  }
  return new GoogleGenAI({ apiKey });
};

export const fetchCardBenefits = async (cardName: string, category: CardCategory): Promise<Omit<Benefit, 'id'>[]> => {
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { 
        parts: [{ 
          text: `You are a world-class financial card expert specializing in Indian credit and debit products. 
          Provide a structured list of official benefits for the following card:
          - Product Name: "${cardName}"
          - Category: ${category}
          - Region: India

          STRICT GUIDELINES:
          1. Return ONLY a valid JSON array of objects. No markdown, no commentary.
          2. Each object must strictly match this schema: { "category": string, "detail": string }.
          3. The "category" field MUST be exactly one of: "Shopping", "Food", "Entertainment", "Fuel", "Forex", "Travel", "Other".
          4. The "detail" field should be a concise, professional description of a specific perk (e.g., "5% cashback on Amazon", "Unlimited domestic lounge access").
          5. If "${cardName}" is NOT a real card, return [].` 
        }] 
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              category: {
                type: Type.STRING,
                description: 'Benefit category.',
              },
              detail: {
                type: Type.STRING,
                description: 'Concise description.',
              },
            },
            required: ["category", "detail"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) return [];
    
    let parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: any) {
    console.error(`Gemini fetchCardBenefits Error:`, error.message || error);
    throw new Error(error.message?.includes("API_KEY") ? "Invalid API Key" : "AI service unavailable. Please check your connection.");
  }
};

export const getCardSuggestions = async (userInput: string, category: CardCategory): Promise<{ suggestions: string[], message?: string }> => {
  if (!userInput || userInput.trim().length < 2) return { suggestions: [] };
  
  try {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for Indian ${category} cards matching: "${userInput}". 
      If it is a partial match, suggest the closest official full card names available in India (e.g. HDFC Millennia, ICICI Amazon Pay, Axis Ace).
      Return up to 5 specific product names.
      Format: { "suggestions": ["Name 1", "Name 2"], "message": "Feedback" }`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            suggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            message: { type: Type.STRING }
          },
          required: ["suggestions"]
        }
      }
    });
    return JSON.parse(response.text || '{"suggestions":[]}');
  } catch (error) {
    console.error("Gemini getCardSuggestions Error:", error);
    return { suggestions: [] };
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
            text: `Extract card details from front/back images. 
            Identify network (Visa, Mastercard, Amex, RuPay).
            Return JSON: name, cardCategory, cardType, fullNumber, cvv, last4, expiryMonth, expiryYear, suggestedAnnualFee, suggestedWaiverTarget.`,
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
            suggestedWaiverTarget: { type: Type.NUMBER },
          },
          required: ["name", "cardCategory", "fullNumber", "cvv", "last4", "expiryMonth", "expiryYear"],
        },
      },
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini analyzeCardImages error:", error);
    return null;
  }
};

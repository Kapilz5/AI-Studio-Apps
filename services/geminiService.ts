
import { GoogleGenAI, Type } from "@google/genai";
import { Benefit, CardCategory } from "../types";
import { UI_STRINGS } from "../locales/en";

const getAI = () => {
  // FIX: Vercel requires the NEXT_PUBLIC_ prefix to expose env vars to the browser.
  const apiKey = process.env.NEXT_PUBLIC_API_KEY;
  
  if (!apiKey || apiKey === "undefined" || apiKey.trim() === "") {
    console.error("Gemini Error: API_KEY is missing or invalid in the environment.");
    throw new Error(UI_STRINGS.card_form.ai_setup_incomplete);
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

    const text = response.text;
    if (!text) return [];
    
    let parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error: any) {
    console.error(`Gemini fetchCardBenefits Error:`, error);
    throw new Error(error.message || "Could not fetch benefits. Please try again later.");
  }
};

export const getCardSuggestions = async (userInput: string, category: CardCategory): Promise<{ suggestions: string[], message?: string }> => {
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
    const result = JSON.parse(response.text || '{"suggestions":[]}');
    return result;
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

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Gemini analyzeCardImages error:", error);
    return null;
  }
};


import { GoogleGenAI, Type } from "@google/genai";
import { Benefit, CardCategory } from "../types";

export const fetchCardBenefits = async (cardName: string, category: CardCategory): Promise<Omit<Benefit, 'id'>[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
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
          5. If "${cardName}" is NOT a real, recognizable, or valid ${category} card, or if no official benefits are found, you MUST return an empty array [] immediately.
          6. Do NOT hallucinate features for non-existent products.` 
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
                description: 'The category of the benefit. Must be one of: Shopping, Food, Entertainment, Fuel, Forex, Travel, Other.',
              },
              detail: {
                type: Type.STRING,
                description: 'A detailed description of the benefit.',
              },
            },
            required: ["category", "detail"],
          },
        },
      },
    });

    const text = response.text;
    if (!text) {
      console.warn(`Gemini returned an empty or undefined response for card: ${cardName}`);
      return [];
    }
    
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (parseError) {
      console.error(`Failed to parse JSON benefits response for ${cardName}. Raw text:`, text);
      return [];
    }

    if (!Array.isArray(parsed)) {
      console.error(`Gemini response for ${cardName} is not an array format:`, parsed);
      return [];
    }

    if (parsed.length === 0) {
      console.info(`No official benefits found or recognized by Gemini for card: ${cardName}`);
      return [];
    }

    return parsed;
  } catch (error: any) {
    const errorMsg = error?.message || "Unknown API Error";
    console.error(`Gemini API Error while fetching benefits for ${cardName} [${category}]: ${errorMsg}`);
    return [];
  }
};

export const getCardSuggestions = async (userInput: string, category: CardCategory): Promise<{ suggestions: string[], message?: string }> => {
  if (!userInput || userInput.trim().length < 2) return { suggestions: [] };
  
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `User input: "${userInput}". Card Category: ${category}.
      
      Instructions:
      1. Provide up to 5 full card product names that match the input AND are specifically ${category} cards in India.
      2. If the input is too vague (e.g., "IC", "HD", "A", "SBI") without enough context to distinguish a specific product, return up to 5 MOST POPULAR cards for that brand.
      3. If the input is nonsensical (e.g., "xyz", random characters, or non-card terms), return an empty suggestions list.
      4. If you return an empty list, set the message to: "Could not find any matching ${category} cards."
      5. Return ONLY JSON: { "suggestions": ["Name 1", "Name 2"], "message": "Helpful feedback" }`,
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
    return { suggestions: [] };
  }
};

export const analyzeCardImages = async (frontBase64: string, backBase64: string): Promise<any> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: frontBase64,
            },
          },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: backBase64,
            },
          },
          {
            text: `Extract card details from the provided images (front and back). 
            Identify if it is a 'Credit' or 'Debit' card.
            Carefully analyze the card face for network branding logos, holographic strips, or specific color patterns associated with major networks:
            - Visa: Look for the blue and gold logo, typically in a corner.
            - Mastercard: Look for the overlapping red and orange circles.
            - Amex (American Express): Look for the centurion logo or the blue box logo.
            - Discover: Look for the 'Discover' text with an orange circle for the 'o'.
            - RuPay: Look for the 'RuPay' logo with the orange and blue swoosh, common in India.

            Return the following details in a strictly structured JSON object:
            - name: The full commercial product name including the issuing bank (e.g., 'SBI Card ELITE', 'ICICI Bank Coral').
            - cardCategory: Either 'Credit' or 'Debit'.
            - cardType: Standardized network brand. MUST be exactly one of: 'Visa', 'Mastercard', 'Amex', 'Discover', or 'RuPay'. If the brand is absolutely unidentifiable, return an empty string "".
            - fullNumber: The complete card number as a single string of digits without spaces.
            - cvv: The 3 or 4 digit security code.
            - last4: The final 4 digits of the card number.
            - expiryMonth: Integer (1-12).
            - expiryYear: 4-digit integer year.
            - suggestedAnnualFee: Estimated official annual fee based on product knowledge (integer).
            - suggestedWaiverTarget: Estimated annual spend required to waive the fee (integer).

            Ensure all extracted values are accurate and verified against the visual data.`,
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
            cardType: { type: Type.STRING, description: "Exactly one of: Visa, Mastercard, Amex, Discover, RuPay. Empty string if unknown." },
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
    console.error("Error analyzing images:", error);
    return null;
  }
};

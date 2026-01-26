
import { Benefit, CardCategory, CreditCard, MultiAdvisorResult } from "../types";

// Privacy Regex Patterns
const PAN_REGEX = /\b(?:\d[ -]*?){13,19}\b/; // Matches 13-19 digit sequences (Card Numbers)
const EXPIRY_REGEX = /\b(0[1-9]|1[0-2])[\/.-](20[2-9]\d|[2-9]\d)\b/; // Matches MM/YY or MM/YYYY
const CVV_REGEX = /\b(cvv|cvc|cid|security\s?code)\W*\d{3,4}\b/i; // Matches CVV context

// Internal helper to check if text contains sensitive data
const isSensitive = (text: string): boolean => {
  if (!text) return false;
  if (PAN_REGEX.test(text)) return true;
  if (EXPIRY_REGEX.test(text)) return true;
  if (CVV_REGEX.test(text)) return true;
  return false;
};

const validatePrivacy = (text: string) => {
  if (isSensitive(text)) {
    throw new Error("Sensitive card data detected and blocked by privacy filter.");
  }
};

// Helper to sanitize input strings (remove control characters)
const sanitizeInput = (str: string): string => {
  if (!str) return "";
  return str.replace(/[\x00-\x1F\x7F]/g, "").trim();
};

// Security Self-Check Routine
export const checkPrivacyFilterIntegrity = (): boolean => {
  try {
    // Test with a dummy credit card number to ensure filter triggers
    validatePrivacy("4111 1111 1111 1111");
    return false; // Failed: Filter did not catch the data
  } catch (e) {
    return true; // Success: Filter blocked the data
  }
};

// Helper to call the server-side proxy
const callGeminiProxy = async (promptContent: any, apiKey: string) => {
  if (!apiKey) {
      throw new Error("Gemini API Key missing. Please configure it in Settings.");
  }

  try {
    // FIX: Send key in body as base64 to avoid header encoding issues (ISO-8859-1 restrictions)
    const safeKey = btoa(apiKey.trim());

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers,
      body: JSON.stringify({ 
        prompt: promptContent,
        userKeyB64: safeKey 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 400 && errorData.error && errorData.error.includes("User Gemini API key required")) {
         throw new Error("Gemini API Key required by server.");
      }
      throw new Error(errorData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    return data.text;
  } catch (error: any) {
    console.error("Gemini Proxy Error:", error);
    throw new Error(error.message || "Failed to communicate with AI service");
  }
};

// Robust JSON extractor
const extractJSON = (text: string) => {
  if (!text) return null;
  try {
    const clean = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    try {
      const firstArray = text.indexOf('[');
      const lastArray = text.lastIndexOf(']');
      if (firstArray !== -1 && lastArray !== -1) {
        const jsonCandidate = text.substring(firstArray, lastArray + 1);
        return JSON.parse(jsonCandidate);
      }
    } catch (e2) {
      console.warn("JSON Extraction failed for text:", text.substring(0, 50) + "...");
    }
    return null;
  }
};

export const fetchCardBenefits = async (cardName: string, category: CardCategory, apiKey: string): Promise<{ benefits: Omit<Benefit, 'id'>[], error?: string }> => {
  try {
    const cleanName = sanitizeInput(cardName);
    validatePrivacy(cleanName);

    const prompt = {
      parts: [{ 
        text: `You are a financial assistant. Extract official benefits for the Indian ${category} card: "${cleanName}".
        
        Strictly follow this JSON format for the output. Do not include markdown formatting or explanations.
        Return a JSON ARRAY of objects.
        
        Expected Schema:
        [
          { "category": "Shopping" | "Food" | "Entertainment" | "Fuel" | "Forex" | "Travel" | "Other", "detail": "string description" }
        ]

        Available Categories: "Shopping", "Food", "Entertainment", "Fuel", "Forex", "Travel", "Other".
        If no info found, return empty array [].` 
      }] 
    };

    const responseText = await callGeminiProxy(prompt, apiKey);
    const parsed = extractJSON(responseText || "");
    
    if (Array.isArray(parsed)) {
      return { benefits: parsed };
    }
    return { benefits: [] };
  } catch (error: any) {
    console.error(`Gemini fetchCardBenefits Error:`, error);
    return { benefits: [], error: error.message || "Service unavailable" };
  }
};

export const getCardSuggestions = async (userInput: string, apiKey: string): Promise<{ suggestions: string[], error?: string }> => {
  const cleanInput = sanitizeInput(userInput);
  if (!cleanInput || cleanInput.length < 2) return { suggestions: [] };
  
  try {
    validatePrivacy(cleanInput);

    const prompt = {
      parts: [{
        text: `User typed: "${cleanInput}". Return ONLY a JSON array of 5-10 real Indian credit/debit card product names matching this text. 
        Focus on popular banks like HDFC, SBI, ICICI, Axis, Amex, IDFC, etc.
        No extra text. Example format: ["HDFC Millennia", "SBI SimplyClick"]`
      }]
    };

    const responseText = await callGeminiProxy(prompt, apiKey);
    const parsed = extractJSON(responseText || "");
    
    if (Array.isArray(parsed)) {
      const unique = Array.from(new Set(parsed)).slice(0, 10) as string[];
      return { suggestions: unique };
    }
    return { suggestions: [] };
  } catch (error: any) {
    console.error("Gemini getCardSuggestions Error:", error);
    return { suggestions: [], error: error.message };
  }
};

export const analyzeCardImages = async (frontBase64: string, backBase64: string, apiKey: string): Promise<any> => {
  try {
    const prompt = {
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: frontBase64 } },
        { inlineData: { mimeType: "image/jpeg", data: backBase64 } },
        {
          text: `Identify the card from these images. Extract: name, category (Credit/Debit), network (Visa/Mastercard/Amex/RuPay), last 4 digits, expiry (MM/YYYY), CVV.
          
          Return ONLY valid JSON. No markdown.
          
          Format:
          {
            "name": "Card Name",
            "cardCategory": "Credit" or "Debit",
            "cardType": "Visa" or "Mastercard" etc,
            "fullNumber": "0000 0000 0000 0000",
            "cvv": "123",
            "last4": "1234",
            "expiryMonth": 12,
            "expiryYear": 2028,
            "suggestedAnnualFee": 0
          }`,
        }
      ]
    };

    const responseText = await callGeminiProxy(prompt, apiKey);
    return extractJSON(responseText || "") || {};
  } catch (error) {
    console.error("Gemini analyzeCardImages error:", error);
    return null;
  }
};

export const analyzeMultiPortfolioRecommendation = async (targetCardNames: string[], existingCards: CreditCard[], apiKey: string): Promise<MultiAdvisorResult[] | null> => {
  try {
    const cleanTargets = targetCardNames.map(name => sanitizeInput(name));
    cleanTargets.forEach(name => validatePrivacy(name));

    // Simplify existing portfolio for token efficiency, removing sensitive data
    const safePortfolio = existingCards.map(c => ({
      name: c.name,
      benefits: c.benefits.map(b => b.detail)
    }));

    const prompt = {
      parts: [{
        text: `You are a strict financial portfolio optimizer.
        
        Current Portfolio: ${JSON.stringify(safePortfolio)}
        Target Cards to Evaluate: ${JSON.stringify(cleanTargets)}

        Task: Compare each Target Card against the Current Portfolio.
        
        Logic:
        1. If a Target Card offers NEW, UNIQUE benefits not found in the portfolio (e.g., specific lounge access, higher cashback rate on a missing category, forex markup), decision is "APPLY".
        2. If the benefits are redundant or inferior to existing cards, decision is "SKIP".
        3. If the card is unknown or generic, decision is "MANUAL".

        Return a JSON ARRAY of objects. No Markdown.
        
        Schema:
        [
          {
            "card": "Target Card Name",
            "decision": "APPLY" | "SKIP" | "OPTIONAL" | "MANUAL",
            "reason": "Clear, short explanation of value vs redundancy.",
            "newValue": ["List of ONLY the net-new benefits gained"],
            "covered": ["List of benefits already covered by portfolio"]
          }
        ]`
      }]
    };

    const responseText = await callGeminiProxy(prompt, apiKey);
    const parsed = extractJSON(responseText || "");
    
    if (Array.isArray(parsed)) {
      return parsed as MultiAdvisorResult[];
    }
    return [];
  } catch (error) {
    console.error("Gemini analyzeMultiPortfolioRecommendation Error:", error);
    throw error;
  }
};

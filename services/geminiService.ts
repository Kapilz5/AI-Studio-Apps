
import { Benefit, CardCategory, CreditCard } from "../types";

// Privacy Regex Patterns
const PAN_REGEX = /\b(?:\d[ -]*?){13,19}\b/; // Matches 13-19 digit sequences (Card Numbers)
const EXPIRY_REGEX = /\b(0[1-9]|1[0-2])[\/.-](20[2-9]\d|[2-9]\d)\b/; // Matches MM/YY or MM/YYYY
const CVV_REGEX = /\b(cvv|cvc|cid|security\s?code)\W*\d{3,4}\b/i; // Matches CVV context

const validatePrivacy = (text: string) => {
  if (!text) return;
  
  if (PAN_REGEX.test(text)) {
    throw new Error("Sensitive card data cannot be sent to AI.");
  }
  if (EXPIRY_REGEX.test(text)) {
    throw new Error("Sensitive card data cannot be sent to AI.");
  }
  if (CVV_REGEX.test(text)) {
    throw new Error("Sensitive card data cannot be sent to AI.");
  }
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-gemini-key': apiKey // Pass the decrypted key securely in headers
    };

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt: promptContent }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      // Provide helpful error if key is missing/invalid
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
      
      // 3. Try finding array boundaries
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
    // Client-side Privacy Check
    validatePrivacy(cardName);

    // We construct the prompt object to be passed to the 'contents' parameter on the server
    const prompt = {
      parts: [{ 
        text: `You are a financial assistant. Extract official benefits for the Indian ${category} card: "${cardName}".
        
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

export const getCardSuggestions = async (userInput: string, category: CardCategory, apiKey: string): Promise<{ suggestions: string[], error?: string }> => {
  if (!userInput || userInput.trim().length < 2) return { suggestions: [] };
  
  try {
    // Client-side Privacy Check
    validatePrivacy(userInput);

    const prompt = {
      parts: [{
        text: `Suggest up to 5 popular Indian ${category} card names starting with or similar to: "${userInput}".
        Return ONLY valid JSON.
        
        Format: { "suggestions": ["Name 1", "Name 2"] }.`
      }]
    };

    const responseText = await callGeminiProxy(prompt, apiKey);
    const parsed = extractJSON(responseText || "");
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

export const analyzeCardImages = async (frontBase64: string, backBase64: string, apiKey: string): Promise<any> => {
  try {
    // Note: We do not regex check base64 strings as they are binary data. 
    // The server will enforce privacy on any text parts accompanying the request.
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

export interface AdvisorResult {
  recommendation: "Apply" | "Skip" | "Optional";
  reasoning: string;
  score: number;
  newBenefits: string[];
  alreadyCovered: string[];
  similarBenefits: string[];
}

export const analyzePortfolioRecommendation = async (newCardName: string, existingCards: CreditCard[], apiKey: string): Promise<AdvisorResult | null> => {
  try {
    validatePrivacy(newCardName);

    // PRIVACY FILTER: Extract ONLY non-sensitive benefit fields.
    // Explicitly exclude: fullNumber, cvv, expiryMonth, expiryYear.
    const safePortfolio = existingCards.map(c => ({
      cardName: c.name,
      network: c.cardType,
      category: c.cardCategory,
      
      // Financials (Non-Sensitive)
      annualFee: c.annualFee,
      feeWaiverCondition: c.waiverTarget > 0 ? `Waived on spending ${c.waiverTarget}` : c.waiverCondition,

      // Perks & Benefits
      welcomeBenefits: c.bestOffer || "None",
      benefitsList: c.benefits.map(b => `${b.category}: ${b.detail}`)
    }));

    const prompt = {
      parts: [{
        text: `You are a credit card expert advisor. The user has the following existing portfolio of cards: 
        ${JSON.stringify(safePortfolio, null, 2)}
        
        The user is considering applying for a NEW card: "${newCardName}".
        
        Task: Compare the new card against the existing portfolio.
        Analyze if this new card adds UNIQUE value (e.g. better rewards rate, new category coverage like Lounge/Fuel/Forex, or better fee structure) or if it is redundant/overlapping.
        
        Strictly follow the JSON schema below.
        
        Schema:
        {
          "recommendation": "Apply" | "Skip" | "Optional",
          "score": number (0-100, where >75 is Apply, <40 is Skip),
          "reasoning": "Concise summary (max 2 sentences) on why.",
          "newBenefits": ["List of unique benefits this card adds that are NOT in the portfolio"],
          "alreadyCovered": ["List of benefits strictly redundant with existing cards"],
          "similarBenefits": ["List of benefits that overlap but might have slight differences"]
        }`
      }]
    };

    const responseText = await callGeminiProxy(prompt, apiKey);
    const parsed = extractJSON(responseText || "");
    
    if (parsed && parsed.recommendation) {
      return parsed as AdvisorResult;
    }
    return null;
  } catch (error) {
    console.error("Gemini analyzePortfolioRecommendation Error:", error);
    throw error;
  }
};

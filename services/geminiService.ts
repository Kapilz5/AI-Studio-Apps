
import { Benefit, CardCategory, CreditCard, MultiAdvisorResult } from "../types";

// Privacy Regex Patterns
const PAN_REGEX = /\b(?:\d[ -]*?){13,19}\b/; // Matches 13-19 digit sequences (Card Numbers)
const EXPIRY_REGEX = /\b(0[1-9]|1[0-2])[\/.-](20[2-9]\d|[2-9]\d)\b/; // Matches MM/YY or MM/YYYY
const CVV_REGEX = /\b(cvv|cvc|cid|security\s?code)\W*\d{3,4}\b/i; // Matches CVV context

// Local Catalog for Instant Autocomplete (No API Latency)
const LOCAL_CARD_CATALOG = [
  "HDFC Millennia Credit Card", "HDFC Regalia Gold", "HDFC Infinia Metal Edition", "HDFC MoneyBack+ Credit Card", "HDFC Freedom Credit Card", "HDFC Tata Neu Infinity", "HDFC Tata Neu Plus", "HDFC Swiggy Credit Card", "HDFC Diners Club Black",
  "SBI Cashback Credit Card", "SBI SimplyClick Credit Card", "SBI SimplySave Credit Card", "SBI Prime Credit Card", "SBI Elite Credit Card", "SBI Pulse Credit Card", "BPCL SBI Card Octane",
  "ICICI Amazon Pay Credit Card", "ICICI Coral Credit Card", "ICICI Rubyx Credit Card", "ICICI Sapphiro Credit Card", "ICICI Emeralde Credit Card", "ICICI Platinum Chip Credit Card", "ICICI MakeMyTrip Signature",
  "Axis Flipkart Credit Card", "Axis Ace Credit Card", "Axis Magnus Credit Card", "Axis Atlas Credit Card", "Axis Select Credit Card", "Axis Neo Credit Card", "Axis My Zone Credit Card", "Axis Vistara Infinite", "Axis Airtel Credit Card",
  "American Express Platinum Travel", "American Express Membership Rewards", "American Express Gold Card", "American Express SmartEarn", "American Express Platinum Reserve",
  "OneCard Metal Credit Card", "Scapia Federal Bank Credit Card",
  "IDFC First Millennia", "IDFC First Classic", "IDFC First Select", "IDFC First Wealth", "IDFC First WOW",
  "Standard Chartered Ultimate", "Standard Chartered Smart", "Standard Chartered DigiSmart",
  "Kotak Mahindra Mojo", "Kotak Mahindra Urbane", "Kotak League Platinum",
  "RBL Bank ShopRite", "RBL Bank World Safari", "RBL Play Credit Card",
  "IndusInd Legend", "IndusInd Platinum Aura Edge", "IndusInd EazyDiner",
  "AU Small Finance Bank Zenith", "AU Small Finance Bank Lit",
  "Yes Bank Marquee", "Yes Bank ACE",
  "HSBC Visa Platinum", "HSBC Cashback Credit Card"
];

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
    // FIX: Encode API Key to ensure it only contains ASCII characters safe for HTTP headers.
    // This prevents "String contains non ISO-8859-1 code point" errors if the key has hidden unicode chars.
    const safeKey = encodeURIComponent(apiKey.trim());

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-user-gemini-key': safeKey 
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

export const getCardSuggestions = async (userInput: string, category?: string): Promise<{ suggestions: string[], error?: string }> => {
  if (!userInput || userInput.trim().length < 2) return { suggestions: [] };
  
  try {
    const query = userInput.toLowerCase().trim();
    
    // Local Filter: Search in static catalog
    // We ignore category to allow broad search as per requirements (fallback to ALL)
    const matches = LOCAL_CARD_CATALOG.filter(card => 
      card.toLowerCase().includes(query)
    ).slice(0, 6); // Limit to top 6 suggestions

    return { suggestions: matches };
  } catch (error: any) {
    console.error("Local getCardSuggestions Error:", error);
    return { suggestions: [] };
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

// Deprecated in favor of MultiAdvisor logic but kept for backward compatibility if needed
export const analyzePortfolioRecommendation = async (newCardName: string, existingCards: CreditCard[], apiKey: string): Promise<AdvisorResult | null> => {
  const result = await analyzeMultiPortfolioRecommendation([newCardName], existingCards, apiKey);
  if (result && result.length > 0) {
      const r = result[0];
      // Map new format to old format for compatibility if any old components use this
      return {
          recommendation: r.decision as "Apply" | "Skip" | "Optional",
          reasoning: r.reason,
          score: r.decision === "APPLY" ? 90 : r.decision === "SKIP" ? 20 : 50,
          newBenefits: r.newValue,
          alreadyCovered: r.covered,
          similarBenefits: []
      };
  }
  return null;
};

export const analyzeMultiPortfolioRecommendation = async (targetCardNames: string[], existingCards: CreditCard[], apiKey: string): Promise<MultiAdvisorResult[] | null> => {
  try {
    // 1. Strict Input Validation on All Target Cards
    targetCardNames.forEach(name => validatePrivacy(name));

    // 2. PRIVACY FILTER & DATA SANITIZATION for Existing Portfolio
    const safePortfolio = existingCards.reduce((acc, c) => {
      let safeName = c.name;
      if (isSensitive(safeName)) {
         safeName = `Card ending in ${c.last4}`; 
      }
      const safeWaiver = isSensitive(c.waiverCondition) ? "" : c.waiverCondition;
      const safeOffer = (c.bestOffer && !isSensitive(c.bestOffer)) ? c.bestOffer : "None";
      const safeBenefitsList = c.benefits
        .filter(b => !isSensitive(b.detail))
        .map(b => `${b.category}: ${b.detail}`);

      acc.push({
        cardName: safeName,
        network: c.cardType,
        category: c.cardCategory,
        annualFee: c.annualFee,
        feeWaiverCondition: c.waiverTarget > 0 ? `Waived on spending ${c.waiverTarget}` : safeWaiver,
        welcomeBenefits: safeOffer,
        benefitsList: safeBenefitsList
      });
      return acc;
    }, [] as any[]);

    const prompt = {
      parts: [{
        text: `You are a credit card expert advisor.
        
        User already owns these cards with benefits: ${JSON.stringify(safePortfolio)}.
        User is considering applying for these target cards: ${JSON.stringify(targetCardNames)}.

        For EACH target card, return:
        1. Benefits already covered by existing cards
        2. New benefits offered
        3. Final decision: APPLY / SKIP / OPTIONAL / MANUAL
        4. Short reason (max 2 lines)

        Rules:
        - "MANUAL" if card name is unrecognized or generic (e.g. "Visa Card").
        - "APPLY" if it adds unique high value (e.g. Lounge if none exist, Forex if none exist).
        - "SKIP" if benefits are largely redundant.

        Strictly return a JSON ARRAY of objects with this schema:
        [
          {
            "card": "Target Card Name",
            "decision": "APPLY" | "SKIP" | "OPTIONAL" | "MANUAL",
            "reason": "String",
            "covered": ["List of redundant benefits"],
            "newValue": ["List of unique benefits"]
          }
        ]
        
        No markdown.`
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

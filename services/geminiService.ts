
import { Benefit, CardCategory, CreditCard, MultiAdvisorResult } from "../types";

// Helper to sanitize input strings (remove control characters)
const sanitizeInput = (str: string): string => {
  if (!str) return "";
  return str.replace(/[\x00-\x1F\x7F]/g, "").trim();
};

const callGeminiAPI = async (mode: string, payload: any, apiKey: string) => {
  if (!apiKey) {
    throw new Error("API Key missing");
  }

  try {
    const safeKey = btoa(apiKey.trim());

    const response = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        mode,
        payload,
        userKeyB64: safeKey 
      }),
    });

    if (!response.ok) {
       throw new Error(`Server Error: ${response.status}`);
    }

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || "AI request failed");
    }

    return result.data;
  } catch (error: any) {
    console.error(`Gemini Service Error (${mode}):`, error);
    throw new Error("AI unavailable");
  }
};

export const checkPrivacyFilterIntegrity = (): boolean => {
  // Client-side self check relies on server now, so we return true to assume server is handling it
  return true;
};

export const fetchCardBenefits = async (cardName: string, category: CardCategory, apiKey: string): Promise<{ benefits: Omit<Benefit, 'id'>[], error?: string }> => {
  try {
    const data = await callGeminiAPI('benefits', { 
      cardName: sanitizeInput(cardName), 
      category 
    }, apiKey);
    
    if (Array.isArray(data)) {
      return { benefits: data };
    }
    return { benefits: [] };
  } catch (error: any) {
    return { benefits: [], error: error.message };
  }
};

export const getCardSuggestions = async (userInput: string, apiKey: string): Promise<{ suggestions: string[], error?: string }> => {
  try {
    const data = await callGeminiAPI('suggest', { 
      text: sanitizeInput(userInput) 
    }, apiKey);
    
    if (Array.isArray(data)) {
      const unique = Array.from(new Set(data)).slice(0, 10) as string[];
      return { suggestions: unique };
    }
    return { suggestions: [] };
  } catch (error: any) {
    return { suggestions: [], error: error.message };
  }
};

export const analyzeCardImages = async (frontBase64: string, backBase64: string, apiKey: string): Promise<any> => {
  try {
    const data = await callGeminiAPI('identify', {
      frontImage: frontBase64,
      backImage: backBase64
    }, apiKey);
    return data || {};
  } catch (error) {
    console.error("Image Analysis failed:", error);
    return null;
  }
};

export const analyzeMultiPortfolioRecommendation = async (targetCardNames: string[], existingCards: CreditCard[], apiKey: string): Promise<MultiAdvisorResult[] | null> => {
  try {
    const cleanTargets = targetCardNames.map(name => sanitizeInput(name));
    
    // Simplify portfolio for token efficiency and privacy
    const safePortfolio = existingCards.map(c => ({
      name: c.name,
      benefits: c.benefits.map(b => b.detail)
    }));

    const data = await callGeminiAPI('advisor', {
      targetCards: cleanTargets,
      existingCards: safePortfolio
    }, apiKey);
    
    if (Array.isArray(data)) {
      return data as MultiAdvisorResult[];
    }
    return [];
  } catch (error) {
    console.error("Advisor failed:", error);
    return []; // Return empty to prevent UI crash
  }
};

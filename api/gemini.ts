
import { GoogleGenAI } from "@google/genai";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Rate limiting setup
const rateLimitStore = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 30;

// Helper to extract JSON from markdown code blocks if necessary
const cleanJSON = (text: string) => {
  if (!text) return null;
  try {
    const clean = text.replace(/```json\n?|```/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    try {
      const firstOpen = text.indexOf('{');
      const lastClose = text.lastIndexOf('}');
      if (firstOpen !== -1 && lastClose !== -1) {
        return JSON.parse(text.substring(firstOpen, lastClose + 1));
      }
      const firstArray = text.indexOf('[');
      const lastArray = text.lastIndexOf(']');
      if (firstArray !== -1 && lastArray !== -1) {
        return JSON.parse(text.substring(firstArray, lastArray + 1));
      }
    } catch (e2) {}
  }
  return null;
};

export default async function handler(req: any, res: any) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Rate Limiting
  const getIP = () => {
    const forwarded = req.headers['x-forwarded-for'];
    return forwarded ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]) : req.socket.remoteAddress;
  };
  
  const ip = getIP() || 'unknown';
  const now = Date.now();
  const clientData = rateLimitStore.get(ip);
  
  if (clientData) {
    if (now - clientData.startTime < RATE_LIMIT_WINDOW_MS) {
      if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
        return res.status(200).json({ success: false, message: "Rate limit exceeded. Try again later." });
      }
      clientData.count++;
    } else {
      clientData.count = 1;
      clientData.startTime = now;
    }
  } else {
    rateLimitStore.set(ip, { count: 1, startTime: now });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method Not Allowed' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { mode, payload, userKeyB64 } = body;

    if (!userKeyB64) {
      return res.status(200).json({ success: false, message: "API Key required" });
    }

    // Safe Key Decoding
    let apiKey = "";
    try {
      // Decode Base64 safely (handles Node and Browser environments)
      // FIX: Access Buffer safely through globalThis to avoid type errors when node types are missing
      const BufferConstructor = (globalThis as any).Buffer;
      if (BufferConstructor) {
        apiKey = BufferConstructor.from(userKeyB64, 'base64').toString('utf-8').trim();
      } else {
        apiKey = atob(userKeyB64).trim();
      }
    } catch (e) {
      return res.status(200).json({ success: false, message: "Invalid API Key encoding" });
    }

    if (!apiKey) {
      return res.status(200).json({ success: false, message: "Decoded API Key is empty" });
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Use a stable Flash model
    const model = 'gemini-2.5-flash';

    let promptParts: any[] = [];
    let schemaType: any = undefined; // For responseSchema if needed (Using text parsing for robustness across models)

    switch (mode) {
      case 'suggest': {
        const text = payload?.text || "";
        promptParts = [{
          text: `User typed: "${text}". Return ONLY a JSON array of 5-10 real Indian credit/debit card product names matching this text. 
          Focus on popular banks like HDFC, SBI, ICICI, Axis, Amex, IDFC, etc.
          No extra text. Example format: ["HDFC Millennia", "SBI SimplyClick"]`
        }];
        break;
      }
      
      case 'benefits': {
        const { cardName, category } = payload || {};
        promptParts = [{
          text: `You are a financial assistant. Extract official benefits for the Indian ${category} card: "${cardName}".
          
          Strictly follow this JSON format for the output. Do not include markdown formatting or explanations.
          Return a JSON ARRAY of objects.
          
          Expected Schema:
          [
            { "category": "Shopping" | "Food" | "Entertainment" | "Fuel" | "Forex" | "Travel" | "Other", "detail": "string description" }
          ]

          Available Categories: "Shopping", "Food", "Entertainment", "Fuel", "Forex", "Travel", "Other".
          If no info found, return empty array [].`
        }];
        break;
      }

      case 'advisor': {
        const { targetCards, existingCards } = payload || {};
        promptParts = [{
          text: `You are a strict financial portfolio optimizer.
          
          Current Portfolio: ${JSON.stringify(existingCards)}
          Target Cards to Evaluate: ${JSON.stringify(targetCards)}

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
        }];
        break;
      }

      case 'identify': {
        const { frontImage, backImage } = payload || {};
        promptParts = [
          { text: "Identify the card from these images. Extract: name, category, network, last 4 digits, expiry, CVV." },
          { inlineData: { mimeType: "image/jpeg", data: frontImage } },
          { inlineData: { mimeType: "image/jpeg", data: backImage } },
          {
            text: `Return ONLY valid JSON. No markdown.
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
            }`
          }
        ];
        break;
      }

      default:
        return res.status(200).json({ success: false, message: "Invalid mode" });
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: { parts: promptParts },
    });

    // FIX: Use .text property instead of method as per SDK guidelines
    const text = response.text || "";
    const data = cleanJSON(text);

    if (data) {
      return res.status(200).json({ success: true, data });
    } else {
      // If JSON parsing fails but we got text, it might be an error or hallucination
      console.warn("Gemini returned non-JSON:", text.substring(0, 100));
      return res.status(200).json({ success: false, message: "AI response format error" });
    }

  } catch (error: any) {
    console.error("Gemini API Error:", error.message || error);
    // Never throw 500 to client, always return structured failure
    return res.status(200).json({ 
      success: false, 
      message: "AI temporarily unavailable" 
    });
  }
}

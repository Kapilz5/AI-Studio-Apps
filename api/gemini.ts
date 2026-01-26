import { GoogleGenAI } from "@google/genai";

// Simple in-memory rate limiting store
// Map<IP, { count: number, startTime: number }>
const rateLimitStore = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 20;

// Increase body size limit to handle Base64 images for card scanning
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Strict Privacy Patterns
const SENSITIVE_REGEX = [
  /\b(?:\d[ -]*?){13,19}\b/, // PAN: 13-19 digits (Standard Cards)
  /\b(0[1-9]|1[0-2])[\/.-](20[2-9]\d|[2-9]\d)\b/, // Expiry: MM/YY or MM/YYYY (Future dates)
  /\b(cvv|cvc|cid|security\s?code)\W*\d{3,4}\b/i // CVV context: "CVV 123"
];

// Recursive function to scan for sensitive data in text fields
const containsSensitiveData = (obj: any): boolean => {
  if (typeof obj === 'string') {
    return SENSITIVE_REGEX.some(regex => regex.test(obj));
  }
  
  if (Array.isArray(obj)) {
    return obj.some(item => containsSensitiveData(item));
  }
  
  if (typeof obj === 'object' && obj !== null) {
    // Skip checking 'inlineData' (Base64 images) to avoid false positives in binary strings
    // We only want to police the TEXT prompts sent to the model
    const entries = Object.entries(obj);
    for (const [key, value] of entries) {
      if (key === 'inlineData') continue;
      if (containsSensitiveData(value)) return true;
    }
  }
  
  return false;
};

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Rate Limiting Logic
  const getIP = () => {
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded ? (typeof forwarded === 'string' ? forwarded.split(',')[0] : forwarded[0]) : req.socket.remoteAddress;
    return ip || 'unknown';
  };

  const ip = getIP();
  const now = Date.now();
  const clientData = rateLimitStore.get(ip);

  if (clientData) {
    if (now - clientData.startTime < RATE_LIMIT_WINDOW_MS) {
      if (clientData.count >= MAX_REQUESTS_PER_WINDOW) {
        res.status(429).json({ error: 'Too Many Requests. Limit is 20 requests per minute.' });
        return;
      }
      clientData.count++;
    } else {
      // Reset window
      clientData.count = 1;
      clientData.startTime = now;
    }
  } else {
    // New client
    rateLimitStore.set(ip, { count: 1, startTime: now });
  }

  // Simple cleanup to prevent memory leaks (optional)
  if (rateLimitStore.size > 10000) {
    for (const [key, data] of rateLimitStore.entries()) {
      if (now - data.startTime > RATE_LIMIT_WINDOW_MS) {
        rateLimitStore.delete(key);
      }
    }
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // Parse the request body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { prompt, userKeyB64 } = body;

    // Validate existence but allow objects (for structured parts/images) or strings
    if (!prompt) {
      res.status(400).json({ error: 'Invalid request body. Missing "prompt" field.' });
      return;
    }

    // Decode User API Key from Body (Base64 -> UTF-8)
    // This prevents header character encoding issues
    let apiKey: string;
    if (!userKeyB64 || typeof userKeyB64 !== 'string') {
        res.status(400).json({ error: "User Gemini API Key required (encoded in body)." });
        return;
    }

    try {
        // Fix: Use global atob which is available in Node.js 16+ and Browsers
        // Buffer types are missing in this environment
        apiKey = atob(userKeyB64).trim();
    } catch (e) {
        res.status(400).json({ error: "Invalid API Key encoding." });
        return;
    }

    if (!apiKey) {
        res.status(400).json({ error: "Decoded API Key is empty." });
        return;
    }

    // STRICT PRIVACY CHECK (Server-Side)
    if (containsSensitiveData(prompt)) {
      console.warn(`Blocked request from ${ip} due to sensitive data detection.`);
      res.status(400).json({ error: 'Sensitive card data cannot be sent to AI.' });
      return;
    }

    // Initialize Gemini client server-side using the USER provided key
    // Key is used in memory for this request only
    const ai = new GoogleGenAI({ apiKey: apiKey });

    // Generate content using the recommended flash model
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Return the response as JSON
    res.status(200).json({
      text: response.text
    });

  } catch (error: any) {
    // Do not log the full error object if it potentially contains the key
    console.error("Gemini API Proxy Error:", error.message || "Unknown error");
    
    const message = error.message || "";
    // Pass through specific error if key is invalid
    if (message.includes("API key")) {
        res.status(400).json({ error: "Invalid API Key provided." });
        return;
    }

    res.status(500).json({ 
      error: 'Failed to process AI request', 
      details: error.message 
    });
  }
}
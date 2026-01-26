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

  // Securely access API key from server environment variables
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("Server Error: GEMINI_API_KEY environment variable is missing.");
    res.status(500).json({ error: 'Server configuration error' });
    return;
  }

  try {
    // Parse the request body
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { prompt } = body;

    // Validate existence but allow objects (for structured parts/images) or strings
    if (!prompt) {
      res.status(400).json({ error: 'Invalid request body. Missing "prompt" field.' });
      return;
    }

    // Initialize Gemini client server-side
    const ai = new GoogleGenAI({ apiKey });

    // Generate content using the recommended flash model
    // Note: contents can be a string or a structured object (Content/Part[])
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    // Return the response as JSON
    res.status(200).json({
      text: response.text
    });

  } catch (error: any) {
    console.error("Gemini API Proxy Error:", error);
    res.status(500).json({ 
      error: 'Failed to process AI request', 
      details: error.message 
    });
  }
}
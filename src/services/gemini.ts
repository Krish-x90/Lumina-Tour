import { GoogleGenAI, Modality, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface TimelineEvent {
  era: string;
  details: string;
}

export interface LandmarkInfo {
  name: string;
  location: string;
  description: string;
  history: string;
  funFacts: string[];
  timeline: TimelineEvent[];
  mapUrl: string;
  threeDMapUrl: string;
  streetViewUrl: string;
  imageKeywords: string[];
  additionalImageUrls: string[];
}

export interface IdentificationResult {
  name: string;
  location: string;
  isLandmark: boolean;
  type: string;
  confidence: number;
}

export async function identifyLandmark(base64Image: string): Promise<IdentificationResult> {
  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: [
      {
        parts: [
          { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
          { text: "Identify the main subject of this image. Determine if it is a famous landmark, a public place, or just a common object/thing (like a poster, furniture, etc.). Provide the name, precise location (if applicable), whether it's a landmark, and its type." },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          location: { type: Type.STRING },
          isLandmark: { type: Type.BOOLEAN },
          type: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
        },
        required: ["name", "location", "isLandmark", "type", "confidence"],
      },
    },
  });
  
  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { name: "Unknown", location: "Unknown", isLandmark: false, type: "unknown", confidence: 0 };
  }
}

export async function fetchLandmarkDetails(landmarkName: string): Promise<LandmarkInfo> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Provide a detailed historical overview, fun facts, and a chronological timeline of key eras for: ${landmarkName}. 
    Include its specific location, a Google Maps search URL, a Google Maps 3D view URL, a Google Maps Street View URL, 3 keywords for historical images.
    CRITICAL: Provide 5 DIRECT, high-quality public image URLs (e.g., from Wikipedia, Unsplash, or official tourism sites) that are likely to be accessible. Avoid broken links.`,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          location: { type: Type.STRING },
          description: { type: Type.STRING },
          history: { type: Type.STRING },
          funFacts: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          timeline: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                era: { type: Type.STRING },
                details: { type: Type.STRING },
              },
              required: ["era", "details"],
            },
          },
          mapUrl: { type: Type.STRING },
          threeDMapUrl: { type: Type.STRING },
          streetViewUrl: { type: Type.STRING },
          imageKeywords: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          additionalImageUrls: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["name", "location", "description", "history", "funFacts", "timeline", "mapUrl", "threeDMapUrl", "streetViewUrl", "imageKeywords", "additionalImageUrls"],
      },
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    console.error("Failed to parse landmark details", e);
    throw new Error("Failed to fetch landmark details");
  }
}

export async function generateNarration(text: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: `Narrate this history in a professional tour guide voice: ${text}` }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: "Kore" },
        },
      },
    },
  });

  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!base64Audio) throw new Error("Failed to generate audio");
  return base64Audio;
}

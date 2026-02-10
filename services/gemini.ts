import { GoogleGenAI, Type } from "@google/genai";
import { StudentGrade, DiagnosticResult, QuestionType } from "../types";

// Fonction utilitaire pour instancier l'IA de manière sécurisée
const getAI = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey || apiKey === "undefined") {
    throw new Error("La clé API Gemini est manquante. Vérifiez vos variables d'environnement sur Vercel.");
  }
  return new GoogleGenAI({ apiKey });
};

// Fonction de retry pour gérer les erreurs 503 (Service Unavailable)
async function fetchWithRetry(fn: () => Promise<any>, maxRetries = 3): Promise<any> {
  let lastError: any;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      const is503 = error.message?.includes('503') || error.status === 503;
      if (is503 && i < maxRetries - 1) {
        // Attente exponentielle avant de réessayer
        await new Promise(res => setTimeout(res, 1000 * (i + 1)));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

const getSystemInstruction = (grade: StudentGrade) => {
  const common = `INTERDIT : N'utilise JAMAIS les mots suivants : champion, aventure, aventurier, prince, trésor, défi. Ne parle pas de quête ou de récompense magique. 
  Tu dois impérativement t'adresser à l'élève en utilisant le 'Tu'. 
  Dans tes feedbacks, insiste toujours sur la ponctuation (majuscule au début, point à la fin) et sur la clarté de la structure de phrase. 
  Reste dans un registre réaliste, quotidien et pédagogique.`;
  
  if (['CP', 'CE1', 'CE2', 'CM1', 'CM2', '6AEP'].includes(grade)) {
    return `Tu es un professeur de FLE bienveillant pour le primaire au Maroc. Ton langage est simple, imagé et encourageant. ${common}`;
  }
  if (['1AC', '2AC', '3AC'].includes(grade)) {
    return `Tu es un professeur de FLE pour le collège au Maroc. Ton langage est clair, structuré et pédagogique. ${common}`;
  }
  return `Tu es un professeur de FLE pour le lycée au Maroc. Ton langage est analytique, précis et académique. ${common}`;
};

function cleanJSON(text: string): string {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    return jsonMatch ? jsonMatch[0] : text.replace(/```json/g, "").replace(/```/g, "").trim();
  } catch (e) {
    return text.trim();
  }
}

export async function generateDiagnostic(grade: StudentGrade) {
  return fetchWithRetry(async () => {
    const ai = getAI();
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Génère 5 questions de diagnostic de lecture pour un élève de niveau ${grade} au Maroc. 
      Chaque question doit être un objet JSON avec: id, question, options (4 choix), correctIndex (0-3), et skill (repérage, inférence ou vocabulaire).
      Format: JSON array. Évite le vocabulaire de fantaisie.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.NUMBER },
              question: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              correctIndex: { type: Type.NUMBER },
              skill: { type: Type.STRING }
            },
            required: ["id", "question", "options", "correctIndex", "skill"]
          }
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("L'API Gemini n'a pas renvoyé de texte.");
    return JSON.parse(cleanJSON(text));
  });
}

export async function generateReadingSession(grade: StudentGrade, result: DiagnosticResult) {
  return fetchWithRetry(async () => {
    const ai = getAI();
    const prompt = `En tant qu'expert FLE du programme marocain, crée une séance de lecture pour un élève de ${grade} ayant un niveau de compréhension ${result}.
    Sujet: école, famille, environnement ou citoyenneté. 
    Organise le texte en paragraphes clairs séparés par des sauts de ligne (\\n\\n).
    Génère EXACTEMENT 3 questions : 1 littérale, 1 inférentielle, 1 évaluative.
    Pour chaque question, inclus une "sampleCorrectAnswer" qui sert de modèle de réponse idéale avec majuscule et point.
    INTERDIT: champion, aventure, aventurier, prince, trésor, défi.
    Format JSON exact requis.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(grade),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reading: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                content: { type: Type.STRING },
                glossary: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      word: { type: Type.STRING },
                      definition: { type: Type.STRING }
                    },
                    required: ["word", "definition"]
                  }
                }
              },
              required: ["title", "content", "glossary"]
            },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.NUMBER },
                  text: { type: Type.STRING },
                  expectedType: { type: Type.STRING, enum: ["littérale", "inférentielle", "évaluative"] },
                  sampleCorrectAnswer: { type: Type.STRING }
                },
                required: ["id", "text", "expectedType", "sampleCorrectAnswer"]
              }
            }
          },
          required: ["reading", "questions"]
        }
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("L'API Gemini n'a pas renvoyé de texte.");
    return JSON.parse(cleanJSON(text));
  });
}

export async function getFeedback(
  grade: StudentGrade,
  text: string,
  question: string,
  expectedType: QuestionType,
  userType: QuestionType,
  userAnswer: string
) {
  return fetchWithRetry(async () => {
    const ai = getAI();
    const prompt = `Texte: "${text}"
    Question: "${question}"
    Type attendu: "${expectedType}"
    L'élève a identifié le type comme: "${userType}"
    Réponse de l'élève: "${userAnswer}"
    
    Analyse la réponse de l'élève. 
    S'adresser à lui avec "Tu". 
    Vérifie s'il y a une majuscule au début et un point à la fin.
    Évalue la structure et la clarté de sa phrase. 
    Donne un feedback sans utiliser : trésor, défi, champion.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        systemInstruction: getSystemInstruction(grade),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isValid: { type: Type.BOOLEAN },
            explanation: { type: Type.STRING },
            encouragement: { type: Type.STRING },
            advice: { type: Type.STRING }
          },
          required: ["isValid", "explanation", "encouragement", "advice"]
        }
      }
    });
    
    const responseText = response.text;
    if (!responseText) throw new Error("L'API Gemini n'a pas renvoyé de texte.");
    return JSON.parse(cleanJSON(responseText));
  });
}
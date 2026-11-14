import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";

// Ensure the API Key is loaded from process.env
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// Define the model instance once
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function analyzeFile(fileData: string, mimeType: string) {
  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [
          { text: "Extract structured information from this resume file. Return JSON." },
          { inlineData: { data: fileData, mimeType: mimeType } }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          fullName: { type: SchemaType.STRING },
          email: { type: SchemaType.STRING },
          phone: { type: SchemaType.STRING },
          skills: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          experience: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                role: { type: SchemaType.STRING },
                company: { type: SchemaType.STRING },
                duration: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING }
              }
            }
          },
          education: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                degree: { type: SchemaType.STRING },
                institution: { type: SchemaType.STRING },
                year: { type: SchemaType.STRING }
              }
            }
          }
        },
        required: ["fullName", "email", "skills"]
      }
    }
  });

  const response = await result.response;
  return JSON.parse(response.text());
}

export async function scoreApplication(jobDescription: string, candidateData: any) {
  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{
        text: `Evaluate the following candidate for the given job description. 
        Provide a score (0-100), strengths, weaknesses, and a bias check report.
        
        Job Description:
        ${jobDescription}
        
        Candidate Data:
        ${JSON.stringify(candidateData)}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          score: { type: SchemaType.NUMBER },
          summary: { type: SchemaType.STRING },
          strengths: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          weaknesses: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
          biasCheck: { type: SchemaType.STRING }
        },
        required: ["score", "summary", "strengths", "weaknesses", "biasCheck"]
      }
    }
  });

  const response = await result.response;
  return JSON.parse(response.text());
}

export async function detectJDBias(jobDescription: string) {
  const result = await model.generateContent({
    contents: [{
      role: "user",
      parts: [{
        text: `Analyze the following job description for unconscious bias (gendered language, ageism, etc.).
        
        Job Description:
        ${jobDescription}`
      }]
    }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          hasBias: { type: SchemaType.BOOLEAN },
          biasDetails: { type: SchemaType.STRING },
          suggestions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } }
        },
        required: ["hasBias", "biasDetails", "suggestions"]
      }
    }
  });

  const response = await result.response;
  return JSON.parse(response.text());
}
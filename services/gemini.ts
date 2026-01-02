
import { GoogleGenAI } from "@google/genai";

export async function getTacticalAdvice(stats: any) {
  // Use process.env.API_KEY directly as per the @google/genai coding guidelines.
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `다음 축구팀 기록을 바탕으로 짧은 팀 분석과 다음 경기 조언을 한국어로 해줘: ${JSON.stringify(stats)}`,
    });
    // The text property returns the generated string directly.
    return response.text;
  } catch (err) {
    console.error(err);
    return "현재 분석을 생성할 수 없습니다.";
  }
}

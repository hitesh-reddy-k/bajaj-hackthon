const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const GEMINI_API_KEY = "AIzaSyC3Rvv5PHBgBLCjmDnZku5tYpr5YJZwYrk";
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const model = genAI.getGenerativeModel({
  model: "models/gemini-1.5-pro", // ✅ use this
});

exports.queryGemini = async (chunks, question) => {
  const prompt = `Document:\n${chunks.join('\n\n')}\n\nQuestion: ${question}`;

  try {
    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
  } catch (err) {
    console.error("Gemini API error:", err);
    throw new Error("Failed to get response from Gemini");
  }
};

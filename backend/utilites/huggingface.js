const axios = require('axios');

const path = require('path');

require('dotenv').config({ path: "../env/.env" });

const OPENROUTER_API_KEY = "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"; 

//uptodat
if (!OPENROUTER_API_KEY) {
  throw new Error("Missing OpenRouter API key. Check your environment variables.");
}

exports.queryOpenRouter = async (textChunks, question) => {
  const prompt = `Document:\n${textChunks.join('\n\n')}\n\nQuestion: ${question}`;
  

  const payload = {
    model: 'deepseek/deepseek-chat-v3-0324:free', 
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ]
  };
  const headers = {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://bajaj-hackthon.vercel.app/', 
    'X-Title': 'GraphRAG AI'
  };

  
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      payload,
      { headers }
    );
    return response.data.choices[0].message.content || 'No answer found';
  } catch (error) {
    console.error('OpenRouter API Error:', error.response?.data || error.message);
    throw new Error('Failed to get response from OpenRouter');
  }
};
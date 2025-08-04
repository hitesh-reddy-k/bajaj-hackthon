const axios = require('axios');

const path = require('path');

require('dotenv').config({ path: "../env/.env" });

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY ;

//uptodat
if (!OPENROUTER_API_KEY) {
  throw new Error("Missing OpenRouter API key. Check your environment variables.");
}

exports.queryOpenRouter = async (textChunks, question) => {
  const prompt = `Document:\n${textChunks.join('\n\n')}\n\nQuestion: ${question}`;

  const payload = {
    model: 'mistralai/mistral-7b-instruct:free', 
    messages: [
      { role: 'system', content: 'You are a helpful assistant.' },
      { role: 'user', content: prompt }
    ]
  };

  const headers = {
    'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://bajaj-hackthon.vercel.app/', // change if deployed
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

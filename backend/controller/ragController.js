const axios = require('axios');

exports.handleQuery = async (req, res) => {
  const questions = req.body.questions;
  if (!questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: 'questions must be an array.' });
  }

  const answers = [];
  for (const question of questions) {
    try {
      const response = await axios.post('http://localhost:5000/query', {
        question: question
      });
      answers.push(response.data.answer);
    } catch (err) {
      console.error('RAG API error:', err.message);
      answers.push('Error retrieving answer');
    }
  }

  return res.status(200).json({ answers });
};

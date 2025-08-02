const axios = require('axios');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { queryOpenRouter } = require('../utilites/huggingface');

exports.handleQuery = async (req, res) => {
  try {
    const uploadedFiles = req.files || [];
    const documents = req.body.documents ? JSON.parse(req.body.documents) : [];
    const rawQuestions = req.body.questions;

    // Parse questions
    let questions = [];
    if (Array.isArray(rawQuestions)) {
      questions = rawQuestions;
    } else if (typeof rawQuestions === 'string') {
      try {
        const parsed = JSON.parse(rawQuestions);
        questions = Array.isArray(parsed) ? parsed : rawQuestions.split(',').map(q => q.trim()).filter(Boolean);
      } catch {
        questions = rawQuestions.split(',').map(q => q.trim()).filter(Boolean);
      }
    } else {
      return res.status(400).json({ error: 'Questions must be a string or an array.' });
    }

    if (!questions.length) {
      return res.status(400).json({ error: 'No valid questions provided' });
    }

    const buffersToProcess = [];

    // Process uploaded files in memory
    for (const file of uploadedFiles) {
      buffersToProcess.push({ buffer: file.buffer, mimetype: file.mimetype });
    }

    // Process remote URLs
    for (const url of documents) {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const contentType = response.headers['content-type'];
      buffersToProcess.push({ buffer: response.data, mimetype: contentType });
    }

    let fullContent = '';

    for (const file of buffersToProcess) {
      if (file.mimetype.includes('pdf')) {
        const data = await pdf(file.buffer);
        fullContent += data.text;
      } else if (file.mimetype.includes('word') || file.mimetype.includes('officedocument')) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        fullContent += result.value;
      }
    }

    // Chunk text and query model
    const chunks = fullContent.match(/(.|\s){1,1000}/g) || [fullContent];
    const answers = [];

    for (const question of questions) {
      const answer = await queryOpenRouter(chunks, question);
      answers.push({ question, answer });
    }

    return res.status(200).json({ answers });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
}
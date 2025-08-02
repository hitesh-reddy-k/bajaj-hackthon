const axios = require('axios');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { queryOpenRouter } = require('../utilites/huggingface');

exports.handleQuery = async (req, res) => {
  try {
    const uploadedFiles = req.files || [];
    const rawDocuments = req.body.documents;
    const rawQuestions = req.body.questions;

    // Parse documents (remote file URLs)
    let documentUrls = [];
    if (rawDocuments) {
      try {
        const parsed = JSON.parse(rawDocuments);
        if (!Array.isArray(parsed)) {
          return res.status(400).json({ error: 'documents must be a JSON array of URLs.' });
        }
        documentUrls = parsed;
      } catch (e) {
        return res.status(400).json({ error: 'Invalid JSON in documents field.' });
      }
    }

    // Parse questions (array or comma-separated string)
    let questions = [];
    if (Array.isArray(rawQuestions)) {
      questions = rawQuestions;
    } else if (typeof rawQuestions === 'string') {
      try {
        const parsed = JSON.parse(rawQuestions);
        questions = Array.isArray(parsed)
          ? parsed
          : rawQuestions.split(',').map(q => q.trim()).filter(Boolean);
      } catch {
        questions = rawQuestions.split(',').map(q => q.trim()).filter(Boolean);
      }
    }

    if (!questions.length) {
      return res.status(400).json({ error: 'No valid questions provided.' });
    }

    const buffersToProcess = [];

    // Uploaded files
    for (const file of uploadedFiles) {
      buffersToProcess.push({ buffer: file.buffer, mimetype: file.mimetype });
    }

    // Remote files from URLs
    for (const url of documentUrls) {
      try {
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        buffersToProcess.push({
          buffer: response.data,
          mimetype: response.headers['content-type']
        });
      } catch (err) {
        console.warn(`Failed to download ${url}: ${err.message}`);
      }
    }

    // Extract text
    let fullContent = '';
    for (const file of buffersToProcess) {
      if (file.mimetype.includes('pdf')) {
        const data = await pdf(file.buffer);
        fullContent += data.text + '\n';
      } else if (
        file.mimetype.includes('word') ||
        file.mimetype.includes('officedocument')
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        fullContent += result.value + '\n';
      } else {
        console.warn('Unsupported MIME type:', file.mimetype);
      }
    }

    // Split into chunks (optional, depending on model input limits)
    const chunks = fullContent.match(/(.|\s){1,1000}/g) || [fullContent];

    // Answer questions
    const answers = [];
    for (const question of questions) {
      const answer = await queryOpenRouter(chunks, question);
      answers.push({ question, answer });
    }

    return res.status(200).json({ answers });

  } catch (err) {
    console.error('Internal error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
};

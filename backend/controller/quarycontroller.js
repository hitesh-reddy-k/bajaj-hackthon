const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { extractTextFromPDF, extractTextFromDocx } = require('../utilites/extracttext');
const { queryOpenRouter } = require('../utilites/huggingface');

exports.handleQuery = async (req, res) => {
  try {
    const uploadedFiles = req.files || [];
    const documents = req.body.urls ? JSON.parse(req.body.urls) : [];
    const rawQuestions = req.body.questions;

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

    const filesToProcess = [];

    // Process uploaded files
    for (const file of uploadedFiles) {
      const filePath = path.resolve(file.path);
      filesToProcess.push({ path: filePath, mimetype: file.mimetype, temp: true });
    }

    // Download and save files from URLs
    for (const url of documents) {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      const ext = path.extname(url).split('?')[0] || '.pdf';
      const filename = `downloaded_${Date.now()}${ext}`;
      const tempPath = path.join('uploads', filename);
      fs.writeFileSync(tempPath, response.data);
      const mimetype = ext.includes('pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      filesToProcess.push({ path: tempPath, mimetype, temp: true });
    }

    let fullContent = '';

    for (const file of filesToProcess) {
      if (file.mimetype.includes('pdf')) {
        fullContent += await extractTextFromPDF(file.path);
      } else if (file.mimetype.includes('word')) {
        fullContent += await extractTextFromDocx(file.path);
      }
    }

    // Chunk and send to OpenRouter
    const CHUNK_SIZE = 1000;
    const chunks = fullContent.match(/(.|\s){1,1000}/g) || [fullContent];
    const answers = [];

    for (let question of questions) {
      const answer = await queryOpenRouter(chunks, question);
      answers.push({ question, answer });
    }

    // Cleanup temporary files
    for (const file of filesToProcess) {
      if (file.temp) fs.unlinkSync(file.path);
    }

    return res.status(200).json({ answers });

  } catch (err) {
    console.error('Error:', err.message);
    return res.status(500).json({ error: 'Internal Server Error', details: err.message });
  }
};

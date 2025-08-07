const axios = require('axios');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { queryOpenRouter } = require('../utilites/huggingface');

exports.handleQuery = async (req, res) => {
  try {
    const uploadedFiles = req.files || [];
    const rawDocuments = req.body.documents;
    const rawQuestions = req.body.questions;

    // Normalize document URLs
    let documentUrls = [];
    if (typeof rawDocuments === 'string') {
      try {
        const parsed = JSON.parse(rawDocuments);
        documentUrls = Array.isArray(parsed) ? parsed : [rawDocuments];
      } catch {
        documentUrls = [rawDocuments];
      }
    } else if (Array.isArray(rawDocuments)) {
      documentUrls = rawDocuments;
    }

    if (!documentUrls.length || !documentUrls.every(url => typeof url === 'string')) {
      return res.status(400).json({ error: 'documents must be a URL string or an array of URLs.' });
    }

    // Parse questions
    let questions = [];
    if (Array.isArray(rawQuestions)) {
      questions = rawQuestions;
    } else if (typeof rawQuestions === 'string') {
      try {
        const parsed = JSON.parse(rawQuestions);
        questions = Array.isArray(parsed) ? parsed : rawQuestions.split(',').map(q => q.trim());
      } catch {
        questions = rawQuestions.split(',').map(q => q.trim());
      }
    }

    if (!questions.length) {
      return res.status(400).json({ error: 'No valid questions provided.' });
    }

    // Download and prepare buffers
    const buffersToProcess = [];

    for (const file of uploadedFiles) {
      buffersToProcess.push({ buffer: file.buffer, mimetype: file.mimetype });
    }

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

    // Chunk document text
    const chunks = fullContent.match(/(.|\s){1,1500}/g) || [fullContent];
    const MAX_CHUNKS_PER_QUESTION = 10;

    // Ask each question using the model
    const answers = [];
    for (const question of questions) {
      const relevantChunks = chunks.slice(0, MAX_CHUNKS_PER_QUESTION);
      try {
        const answer = await queryOpenRouter(relevantChunks, question);
        answers.push(answer); // ✅ Push only string directly
      } catch (err) {
        answers.push('Error retrieving answer');
        console.error('Query failed for:', question, err.message);
      }
    }

    return res.status(200).json({ answers }); // ✅ Exactly what you wanted
  } catch (err) {
    console.error('Internal error:', err);
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
};




// const axios = require('axios');
// const mammoth = require('mammoth');
// const pdf = require('pdf-parse');

// exports.handleQuery = async (req, res) => {
//   try {
//     const uploadedFiles = req.files || [];
//     const rawDocuments = req.body.documents;
//     const rawQuestions = req.body.questions;

//     // 1. Normalize document URLs
//     let documentUrls = [];
//     if (typeof rawDocuments === 'string') {
//       try {
//         const parsed = JSON.parse(rawDocuments);
//         documentUrls = Array.isArray(parsed) ? parsed : [rawDocuments];
//       } catch {
//         documentUrls = [rawDocuments];
//       }
//     } else if (Array.isArray(rawDocuments)) {
//       documentUrls = rawDocuments;
//     }

//     // 2. Normalize questions
//     let questions = [];
//     if (Array.isArray(rawQuestions)) {
//       questions = rawQuestions;
//     } else if (typeof rawQuestions === 'string') {
//       try {
//         const parsed = JSON.parse(rawQuestions);
//         questions = Array.isArray(parsed) ? parsed : rawQuestions.split(',').map(q => q.trim());
//       } catch {
//         questions = rawQuestions.split(',').map(q => q.trim());
//       }
//     }

//     if (!questions.length) {
//       return res.status(400).json({ error: 'No valid questions provided.' });
//     }

//     // 3. Download and prepare buffers
//     const buffersToProcess = [];

//     for (const file of uploadedFiles) {
//       buffersToProcess.push({ buffer: file.buffer, mimetype: file.mimetype });
//     }

//     for (const url of documentUrls) {
//       try {
//         const response = await axios.get(url, { responseType: 'arraybuffer' });
//         buffersToProcess.push({
//           buffer: response.data,
//           mimetype: response.headers['content-type']
//         });
//       } catch (err) {
//         console.warn(`Failed to download ${url}: ${err.message}`);
//       }
//     }

//     // 4. Extract text from PDFs/DOCX
//     let fullContent = '';
//     for (const file of buffersToProcess) {
//       if (file.mimetype.includes('pdf')) {
//         const data = await pdf(file.buffer);
//         fullContent += data.text + '\n';
//       } else if (
//         file.mimetype.includes('word') ||
//         file.mimetype.includes('officedocument')
//       ) {
//         const result = await mammoth.extractRawText({ buffer: file.buffer });
//         fullContent += result.value + '\n';
//       } else {
//         console.warn('Unsupported MIME type:', file.mimetype);
//       }
//     }

//     if (!fullContent.trim()) {
//       return res.status(400).json({ error: 'No valid content extracted from files.' });
//     }

//     const answers = [];
//     for (const question of questions) {
//       const prompt = `Document:\n${fullContent}\n\nQuestion: ${question}`;
//       try {
//         const response = await axios.post('http://localhost:5000/query', {
//           question: prompt
//         });
//         answers.push(response.data.answer);
//       } catch (err) {
//         console.error('RAG API error:', err.message);
//         answers.push('Error retrieving answer');
//       }
//     }

//     return res.status(200).json({ answers });
//   } catch (err) {
//     console.error('Internal error:', err);
//     return res.status(500).json({
//       error: 'Internal Server Error',
//       details: err.message
//     });
//   }
// };
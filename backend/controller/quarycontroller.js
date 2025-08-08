const axios = require('axios');
const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { queryOpenRouter } = require('../utilites/huggingface');

// Helper function to format logs
const logQueryResponse = (question, answer, index) => {
  console.log('\n' + '='.repeat(80));
  console.log(`QUERY ${index + 1}:`);
  console.log('Question:', question);
  console.log('Answer:', answer);
  console.log('Timestamp:', new Date().toISOString());
  console.log('='.repeat(80) + '\n');
};

exports.handleQuery = async (req, res) => {
  const startTime = Date.now();
  
  try {
    console.log('\n🚀 NEW QUERY REQUEST STARTED');
    console.log('Timestamp:', new Date().toISOString());
    console.log('Request Body Keys:', Object.keys(req.body));
    console.log('Uploaded Files Count:', (req.files || []).length);

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
      console.log('❌ ERROR: Invalid documents format');
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
      console.log('❌ ERROR: No valid questions provided');
      return res.status(400).json({ error: 'No valid questions provided.' });
    }

    console.log('📋 QUESTIONS TO PROCESS:', questions.length);
    questions.forEach((q, i) => console.log(`  ${i + 1}. ${q}`));
    
    console.log('📄 DOCUMENTS TO PROCESS:', documentUrls.length);
    documentUrls.forEach((url, i) => console.log(`  ${i + 1}. ${url}`));

    // Download and prepare buffers
    const buffersToProcess = [];

    for (const file of uploadedFiles) {
      buffersToProcess.push({ buffer: file.buffer, mimetype: file.mimetype });
      console.log('📎 Added uploaded file with mimetype:', file.mimetype);
    }

    for (const url of documentUrls) {
      try {
        console.log('🔄 Downloading:', url);
        const response = await axios.get(url, { responseType: 'arraybuffer' });
        buffersToProcess.push({
          buffer: response.data,
          mimetype: response.headers['content-type']
        });
        console.log('✅ Downloaded successfully, mimetype:', response.headers['content-type']);
      } catch (err) {
        console.warn(`⚠️ Failed to download ${url}: ${err.message}`);
      }
    }

    // Extract text
    let fullContent = '';
    console.log('📖 Extracting text from', buffersToProcess.length, 'files...');
    
    for (const file of buffersToProcess) {
      if (file.mimetype.includes('pdf')) {
        console.log('🔍 Processing PDF...');
        const data = await pdf(file.buffer);
        fullContent += data.text + '\n';
        console.log('✅ PDF processed, extracted', data.text.length, 'characters');
      } else if (
        file.mimetype.includes('word') ||
        file.mimetype.includes('officedocument')
      ) {
        console.log('🔍 Processing Word document...');
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        fullContent += result.value + '\n';
        console.log('✅ Word document processed, extracted', result.value.length, 'characters');
      } else {
        console.warn('⚠️ Unsupported MIME type:', file.mimetype);
      }
    }

    console.log('📊 TOTAL CONTENT LENGTH:', fullContent.length, 'characters');

    // Chunk document text
    const chunks = fullContent.match(/(.|\s){1,1500}/g) || [fullContent];
    const MAX_CHUNKS_PER_QUESTION = 10;
    
    console.log('🔗 Created', chunks.length, 'chunks');
    console.log('📝 Using max', MAX_CHUNKS_PER_QUESTION, 'chunks per question');

    // Ask each question using the model
    const answers = [];
    console.log('\n🤖 STARTING AI QUERIES...');
    
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i];
      const relevantChunks = chunks.slice(0, MAX_CHUNKS_PER_QUESTION);
      
      console.log(`\n🔄 Processing question ${i + 1}/${questions.length}:`, question);
      
      try {
        const queryStartTime = Date.now();
        const answer = await queryOpenRouter(relevantChunks, question);
        const queryEndTime = Date.now();
        
        answers.push(answer);
        
        // Log the question and response
        logQueryResponse(question, answer, i);
        
        console.log(`⏱️ Query ${i + 1} completed in ${queryEndTime - queryStartTime}ms`);
        
      } catch (err) {
        const errorMsg = 'Error retrieving answer';
        answers.push(errorMsg);
        console.error(`❌ Query ${i + 1} failed:`, question, err.message);
        
        // Log the failed query
        logQueryResponse(question, errorMsg, i);
      }
    }

    const totalTime = Date.now() - startTime;
    console.log('\n✅ ALL QUERIES COMPLETED');
    console.log('📊 SUMMARY:');
    console.log('  - Total questions processed:', questions.length);
    console.log('  - Total processing time:', totalTime + 'ms');
    console.log('  - Average time per question:', Math.round(totalTime / questions.length) + 'ms');
    console.log('  - Successful answers:', answers.filter(a => a !== 'Error retrieving answer').length);
    console.log('  - Failed answers:', answers.filter(a => a === 'Error retrieving answer').length);
    console.log('\n🎯 FINAL RESPONSE SENT');

    return res.status(200).json({ answers });
    
  } catch (err) {
    const totalTime = Date.now() - startTime;
    console.error('\n💥 INTERNAL ERROR OCCURRED');
    console.error('Error:', err.message);
    console.error('Stack:', err.stack);
    console.error('Total time before error:', totalTime + 'ms');
    console.error('Timestamp:', new Date().toISOString());
    
    return res.status(500).json({
      error: 'Internal Server Error',
      details: err.message
    });
  }
};
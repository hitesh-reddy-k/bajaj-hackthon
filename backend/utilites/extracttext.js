const fs = require('fs');
const pdf = require('pdf-parse');
const mammoth = require('mammoth');

exports.extractTextFromPDF = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    return data.text;
  } catch (err) {
    console.error('PDF parsing error:', err.message);
    throw new Error('Failed to extract text from PDF');
  }
};

exports.extractTextFromDocx = async (filePath) => {
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value;
  } catch (err) {
    console.error('DOCX parsing error:', err.message);
    throw new Error('Failed to extract text from DOCX');
  }
};

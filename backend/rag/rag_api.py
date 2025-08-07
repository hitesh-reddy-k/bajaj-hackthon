from flask import Flask, request, jsonify
from llama_index.core import VectorStoreIndex, Document

app = Flask(__name__)

@app.route('/query', methods=['POST'])
def query():
    data = request.json
    full_text = data.get('question')  # This includes "Document:\n... \n\nQuestion: ..."

    if not full_text:
        return jsonify({'error': 'No question provided'}), 400

    # Split document and actual question
    try:
        doc_part, actual_question = full_text.split("Question:", 1)
        documents = [Document(text=doc_part.strip())]
        index = VectorStoreIndex.from_documents(documents)
        query_engine = index.as_query_engine()
        response = query_engine.query(actual_question.strip())
        return jsonify({'answer': str(response)})
    except Exception as e:
        return jsonify({'error': f'Parsing failed: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(port=5000)

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const queryRoute = require('./router/quaryrouter.js');

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.use('/api/v1', queryRoute);


app.get('/', (req, res) => {
  res.send('LLM Query-Retrieval API running...');
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
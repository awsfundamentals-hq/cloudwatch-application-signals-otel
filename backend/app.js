const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const port = 80;

app.use(cors());

const fetchMetadata = async () => {
  try {
    const response = await axios.get(process.env.ECS_CONTAINER_METADATA_URI);
    return response.data;
  } catch (error) {
    console.error('Error fetching metadata:', error);
    return null;
  }
};

app.get('/', async (_req, res) => {
  if (process.env.AWS_REGION) {
    const metadata = await fetchMetadata();
    res.json({
      message: 'Hello World from Fargate! 🏗️',
      metadata,
    });
  } else {
    res.json({
      message: 'Hello World from Local! 🏠',
    });
  }
});

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});

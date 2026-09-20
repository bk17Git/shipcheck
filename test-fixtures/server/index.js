import express from 'express';

const app = express();
app.use(express.json());

// BUG: No authentication! Anyone can call this and spend your money.
app.post('/api/chat', async (req, res) => {
  const { message } = req.body;

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: message }] }]
      })
    }
  );

  const data = await response.json();
  res.json(data);
});

app.listen(3000, () => console.log('Server running on port 3000'));

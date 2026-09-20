import React, { useState } from 'react';

// BUG: This key gets compiled into the browser bundle!
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_KEY;

export default function App() {
  const [response, setResponse] = useState('');

  async function askAI(prompt) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );
    const data = await res.json();
    setResponse(data.candidates[0].content.parts[0].text);
  }

  return (
    <div>
      <h1>My AI Chat App</h1>
      <button onClick={() => askAI('Hello!')}>Ask AI</button>
      <p>{response}</p>
    </div>
  );
}

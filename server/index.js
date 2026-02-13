import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Store conversation history
const conversations = new Map();

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId, imageUrl } = req.body;

    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, [
        {
          role: 'system',
          content: `You are a friendly AI storyteller talking to a child. Keep responses short (2-3 sentences), engaging, and age-appropriate. Ask follow-up questions to keep the conversation going. The image shows: ${imageUrl ? 'a magical adventure scene' : 'an exciting story'}.`
        }
      ]);
    }

    const history = conversations.get(sessionId);
    history.push({ role: 'user', content: message });

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: history,
      max_tokens: 100,
      temperature: 0.8,
    });

    const aiResponse = completion.choices[0].message.content;
    history.push({ role: 'assistant', content: aiResponse });

    res.json({ response: aiResponse });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/start-conversation', async (req, res) => {
  try {
    const { sessionId, imageUrl } = req.body;

    const prompt = `You're starting a 1-minute conversation with a child about this image: ${imageUrl}. Begin with an engaging question about what they see.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a friendly AI storyteller for children.' },
        { role: 'user', content: prompt }
      ],
      max_tokens: 80,
    });

    const initialMessage = completion.choices[0].message.content;

    conversations.set(sessionId, [
      { role: 'system', content: 'You are a friendly AI storyteller talking to a child.' },
      { role: 'assistant', content: initialMessage }
    ]);

    res.json({ message: initialMessage });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY,
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
          content: `You are a warm, playful storyteller talking to a young child (around 6–8 years old). Use very simple words and short sentences (1–3 per reply). Sound excited, kind, and encouraging. Ask gentle follow-up questions so the child keeps talking about what they see and imagine in the picture. Never mention anything scary, violent, or upsetting. If the story reaches a really fun or magical moment, use the add_visual_effect function to make the picture feel extra special. The picture shows: ${imageUrl ? 'a magical space adventure scene full of stars' : 'a fun, imaginative story picture'}.`
        }
      ]);
    }

    const history = conversations.get(sessionId);
    history.push({ role: 'user', content: message });

    const tools = [
      {
        type: 'function',
        function: {
          name: 'add_visual_effect',
          description: 'Add a visual effect to the story image when something exciting happens',
          parameters: {
            type: 'object',
            properties: {
              effect: {
                type: 'string',
                enum: ['sparkle', 'glow', 'zoom'],
                description: 'The type of visual effect to apply'
              },
              reason: {
                type: 'string',
                description: 'Why this effect enhances the story moment'
              }
            },
            required: ['effect', 'reason']
          }
        }
      }
    ];

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: history,
      max_tokens: 100,
      temperature: 0.8,
      tools: tools,
      tool_choice: 'auto'
    });

    const responseMessage = completion.choices[0].message;
    let toolCall = null;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      toolCall = {
        name: responseMessage.tool_calls[0].function.name,
        arguments: JSON.parse(responseMessage.tool_calls[0].function.arguments)
      };
    }

    const aiResponse = responseMessage.content || "Let me show you something magical!";
    history.push({ role: 'assistant', content: aiResponse });

    res.json({ 
      response: aiResponse,
      toolCall: toolCall
    });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/start-conversation', async (req, res) => {
  try {
    const { sessionId, imageUrl } = req.body;

    const prompt = `You are starting a friendly 1-minute chat with a young child about this picture: ${imageUrl}. Ask just one simple, fun question to begin, about what they see or what they think might be happening in the picture. Use playful, encouraging language and do not mention anything scary or upsetting.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        {
          role: 'system',
          content:
            'You are a warm, playful storyteller talking to a young child (around 6–8 years old). Use very simple words and short sentences. Be positive, kind, and encouraging, and never mention anything scary, violent, or upsetting.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 80,
    });

    const initialMessage = completion.choices[0].message.content;

    conversations.set(sessionId, [
      {
        role: 'system',
        content:
          'You are a warm, playful storyteller talking to a young child (around 6–8 years old). Use very simple words and short sentences. Be positive, kind, and encouraging, and never mention anything scary, violent, or upsetting.'
      },
      { role: 'assistant', content: initialMessage }
    ]);

    res.json({ message: initialMessage });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text } = req.body;
    
    const audio = await elevenlabs.textToSpeech.convert('21m00Tcm4TlvDq8ikWAM', {
      text,
      model_id: 'eleven_turbo_v2_5',
    });

    res.set({
      'Content-Type': 'audio/mpeg',
      'Transfer-Encoding': 'chunked',
    });

    for await (const chunk of audio) {
      res.write(chunk);
    }
    
    res.end();
  } catch (error) {
    console.error('TTS Error:', error);
    res.status(500).json({ error: 'Text-to-speech failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

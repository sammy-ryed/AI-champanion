import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import Groq from 'groq-sdk';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import multer from 'multer';
import fs from 'fs';
import os from 'os';
import path from 'path';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const elevenlabs = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });

// Available story scenes
export const SCENES = {
  space: {
    id: 'space',
    url: 'https://cdn.pixabay.com/photo/2016/11/29/05/45/astronomy-1867616_1280.jpg',
    description: 'a breathtaking space scene with colorful galaxies, twinkling stars, and glowing nebulae',
    label: 'Outer Space'
  },
  ocean: {
    id: 'ocean',
    url: 'https://cdn.pixabay.com/photo/2017/01/20/00/30/maldives-1993704_1280.jpg',
    description: 'a crystal-clear tropical ocean with colorful fish, coral reefs, and gentle waves',
    label: 'Ocean World'
  },
  forest: {
    id: 'forest',
    url: 'https://cdn.pixabay.com/photo/2015/09/09/16/05/forest-931706_1280.jpg',
    description: 'a magical enchanted forest with golden rays of sunlight through tall trees and mysterious paths',
    label: 'Enchanted Forest'
  },
  castle: {
    id: 'castle',
    url: 'https://cdn.pixabay.com/photo/2016/01/09/18/27/journey-1130732_1280.jpg',
    description: 'a grand castle on a hilltop with rolling green fields and a big bright sky',
    label: 'Magic Kingdom'
  },
  mountains: {
    id: 'mountains',
    url: 'https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885_1280.jpg',
    description: 'a stunning mountain landscape with snowy peaks, green meadows, and a clear blue sky',
    label: 'Mountain Adventure'
  }
};

const SCENE_KEYS = Object.keys(SCENES);

// Store per-session state: { history, currentScene }
const conversations = new Map();

function buildSystemPrompt(sceneId) {
  const scene = SCENES[sceneId] || SCENES.space;
  return `You are Cosmo, a fun and enthusiastic storytelling buddy for young children aged 5–8.

CURRENT SCENE: ${scene.description} ("${scene.label}").

RULES — follow every single one:
1. ALWAYS write 1–3 short, cheerful sentences in your reply. NEVER return empty text.
2. End EVERY reply with exactly ONE simple question for the child.
3. Use easy words a 6-year-old knows.
4. Be excited, warm, and encouraging. Never scary.

TOOL USAGE — you MUST use tools regularly:
- call add_visual_effect on exciting moments (sparkle=magic, glow=happy, zoom=action)
- call change_scene after every 2–3 exchanges to move the adventure to a new place (available: ${SCENE_KEYS.filter(k => k !== sceneId).join(', ')})
- You can call a tool AND write text in the same response — always do both

STORY FLOW: The child is the hero. Build on exactly what they said. Keep the adventure going!`;
}

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_visual_effect',
      description: 'Add a visual effect to the current scene image when something exciting or magical happens in the story',
      parameters: {
        type: 'object',
        properties: {
          effect: { type: 'string', enum: ['sparkle', 'glow', 'zoom'], description: 'sparkle=magic moment, glow=warm/happy, zoom=action/excitement' },
          reason: { type: 'string', description: 'Brief label for the effect' }
        },
        required: ['effect', 'reason']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'change_scene',
      description: 'Change the story image to a new exciting location to advance the adventure',
      parameters: {
        type: 'object',
        properties: {
          scene: { type: 'string', enum: SCENE_KEYS, description: 'The new scene to travel to' },
          transition_line: { type: 'string', description: 'A short exciting sentence telling the child where the story is going next (max 15 words)' }
        },
        required: ['scene', 'transition_line']
      }
    }
  }
];

// Strip hallucinated <function=...>...</function> or <function=...{...}/> tags
// that Llama sometimes embeds in text content instead of using proper tool_calls
function cleanContent(text) {
  if (!text) return text;
  return text
    .replace(/<function=[^>]*?\{[^}]*?\}[^<]*?<\/function>/gs, '')
    .replace(/<function=[^/]*?\/>/gs, '')
    .replace(/<function=[^>]*?>[^<]*?<\/function>/gs, '')
    .trim();
}

app.post('/api/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    if (!conversations.has(sessionId)) {
      conversations.set(sessionId, {
        currentScene: 'space',
        history: [{ role: 'system', content: buildSystemPrompt('space') }]
      });
    }

    const session = conversations.get(sessionId);
    session.history.push({ role: 'user', content: message });

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: session.history,
      max_tokens: 150,
      temperature: 0.9,
      tools: TOOLS,
      tool_choice: 'auto'
    });

    const responseMessage = completion.choices[0].message;
    let toolCall = null;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const raw = responseMessage.tool_calls[0];
      const name = raw.function.name;
      const args = JSON.parse(raw.function.arguments);
      toolCall = { name, arguments: args };

      if (name === 'change_scene' && SCENES[args.scene]) {
        session.currentScene = args.scene;
        session.history[0] = { role: 'system', content: buildSystemPrompt(args.scene) };
      }
    }

    let aiResponse = cleanContent(responseMessage.content);

    // When the model returns tool_calls with no text, do a follow-up call
    // WITHOUT tools so it can't fail with tool_use_failed
    if (!aiResponse && toolCall) {
      try {
        const followUpMessages = [
          ...session.history,
          {
            role: 'assistant',
            content: null,
            tool_calls: responseMessage.tool_calls
          },
          {
            role: 'tool',
            tool_call_id: responseMessage.tool_calls[0].id,
            content: 'done'
          }
        ];

        const followUp = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: followUpMessages,
          max_tokens: 120,
          temperature: 0.9
          // no tools — prevents tool_use_failed 400 errors
        });

        aiResponse = cleanContent(followUp.choices[0].message.content);
      } catch (followUpErr) {
        console.error('Follow-up error:', followUpErr?.error?.error?.message || followUpErr.message);
        // Generate a simple reply with a plain call, no tools at all
        const simple = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: buildSystemPrompt(session.currentScene) },
            { role: 'user', content: message }
          ],
          max_tokens: 100,
          temperature: 0.9
        });
        aiResponse = cleanContent(simple.choices[0].message.content);
      }
    }

    if (!aiResponse) aiResponse = "That sounds amazing! What happens next?";

    session.history.push({ role: 'assistant', content: aiResponse });

    res.json({ response: aiResponse, toolCall, currentScene: session.currentScene });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/start-conversation', async (req, res) => {
  try {
    const { sessionId } = req.body;

    const startScene = 'space';
    const scene = SCENES[startScene];

    const systemPrompt = buildSystemPrompt(startScene);
    const userPrompt = `Start the story! You're looking at ${scene.description}. Say one short, exciting sentence about what you see, then ask the child ONE simple question about it. Be super enthusiastic!`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 80,
      temperature: 0.9
    });

    const initialMessage = completion.choices[0].message.content;

    conversations.set(sessionId, {
      currentScene: startScene,
      history: [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: initialMessage }
      ]
    });

    res.json({ message: initialMessage, currentScene: startScene });
  } catch (error) {
    console.error('Start error:', error);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

app.get('/api/scenes', (req, res) => {
  res.json(SCENES);
});

const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  let tmpPath = null;
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    // Write buffer to temp file so Groq SDK can read it as a stream
    tmpPath = path.join(os.tmpdir(), `rec-${Date.now()}.webm`);
    fs.writeFileSync(tmpPath, req.file.buffer);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(tmpPath),
      model: 'whisper-large-v3-turbo',
      language: 'en',
      response_format: 'json'
    });

    res.json({ text: transcription.text || '' });
  } catch (err) {
    console.error('Transcribe error:', err);
    res.status(500).json({ error: 'Transcription failed' });
  } finally {
    if (tmpPath) try { fs.unlinkSync(tmpPath); } catch (_) {}
  }
});

app.post('/api/text-to-speech', async (req, res) => {
  try {
    const { text } = req.body;

    const audio = await elevenlabs.textToSpeech.convert('21m00Tcm4TlvDq8ikWAM', {
      text,
      model_id: 'eleven_turbo_v2_5',
      voice_settings: { stability: 0.5, similarity_boost: 0.75 }
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

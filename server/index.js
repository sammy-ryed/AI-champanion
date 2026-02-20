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

// ElevenLabs voice — auto-detect an Indian accent voice at startup, fallback to Rachel
let VOICE_ID = process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
(async () => {
  try {
    const result = await elevenlabs.voices.getAll();
    const list   = result?.voices || [];
    const indian = list.find(v =>
      v.labels?.accent?.toLowerCase().includes('indian') ||
      /meera|priya|neerja|ananya/i.test(v.name || '')
    );
    if (indian) {
      VOICE_ID = indian.voice_id;
      console.log(`Indian voice found: ${indian.name} (${VOICE_ID})`);
    } else {
      console.log('No Indian accent voice found on your account — using default voice. Add one on elevenlabs.io and set ELEVENLABS_VOICE_ID in .env.');
    }
  } catch (_) { /* keep default */ }
})();

// Available story scenes
export const SCENES = {
  space: {
    id: 'space',
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1280&q=80&auto=format',
    description: 'a breathtaking space scene with colorful galaxies, twinkling stars, and glowing nebulae',
    label: 'Outer Space'
  },
  ocean: {
    id: 'ocean',
    url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1280&q=80&auto=format',
    description: 'a crystal-clear tropical ocean with colorful fish, coral reefs, and gentle waves',
    label: 'Ocean World'
  },
  forest: {
    id: 'forest',
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1280&q=80&auto=format',
    description: 'a magical enchanted forest with golden rays of sunlight through tall trees and mysterious paths',
    label: 'Enchanted Forest'
  },
  castle: {
    id: 'castle',
    url: 'https://images.unsplash.com/photo-1599930113854-d6d7fd521f10?w=1280&q=80&auto=format',
    description: 'a grand medieval castle on a hilltop with rolling green fields and a big bright sky',
    label: 'Magic Kingdom'
  },
  mountains: {
    id: 'mountains',
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&q=80&auto=format',
    description: 'a stunning mountain landscape with snowy peaks, green meadows, and a clear blue sky',
    label: 'Mountain Adventure'
  }
};

const SCENE_KEYS = Object.keys(SCENES);

// Store per-session state: { history, currentScene }
const conversations = new Map();

// ── Safety pre-filter ─────────────────────────────────────────────────────
// Crude words a child should not be using — redirect gently without repeating them
const INAPPROPRIATE_PATTERNS = [
  /\bgand\b/i, /\bgandu\b/i, /\bchut\b/i, /\bmadarchod\b/i, /\bbhench?od\b/i,
  /\bsaala\b/i, /\bkamina\b/i, /\bkutiya\b/i, /\bharam(i|zada)\b/i,
  /\bf+u+c+k+\b/i, /\bs+h+i+t+\b/i, /\bb+i+t+c+h+\b/i, /\bass\b/i,
  /\bdamn\b/i, /\bcrap\b/i, /\bhell\b/i, /\bstupid\b/i, /\bidiot\b/i,
  /mar lo/i, /maa ki/i, /teri maa/i
];

function containsInappropriate(text) {
  return INAPPROPRIATE_PATTERNS.some(p => p.test(text));
}

function buildSystemPrompt(sceneId) {
  const scene = SCENES[sceneId] || SCENES.space;
  return `You are Cosmo, a warm and enthusiastic bilingual storytelling buddy for Indian children aged 5–8.

CURRENT SCENE: ${scene.description} ("${scene.label}").

LANGUAGE RULES — follow strictly for every single sentence:
1. Say EVERY sentence in English first, then immediately add the Hindi translation in parentheses.
   Format exactly like this: "Wow, look at those shiny stars! (वाह, देखो वो चमकदार तारे!) What do you see? (तुम क्या देख रहे हो?)"
2. If the child writes or speaks in Hindi, warmly say "Bahut acha! (बहुत अच्छा!)" then gently teach the English words: "In English we say: [phrase]! (अंग्रेज़ी में हम कहते हैं: [phrase]!)"
3. Use simple English words a 5-year-old knows. Speak like a friendly Indian maasi or didi.

REPLY RULES:
1. Write 2–3 short bilingual sentences + 1 bilingual question. NEVER return empty text.
2. Be excited, warm, and encouraging. Never scary.

SCENE-SWITCHING — IMMEDIATELY change scene when the child mentions these topics:
• fish, sea, water, ocean, whale, dolphin, crab, coral, mermaid, seahorse → change to "ocean"
• trees, animals, lion, tiger, elephant, jungle, birds, monkey, deer, bear → change to "forest"
• castle, princess, dragon, knight, king, queen, palace, magic wand → change to "castle"
• mountains, snow, climb, hill, cold, hiking, peak, glacier → change to "mountains"
• rocket, stars, planet, alien, galaxy, spacecraft, astronaut, moon → change to "space"
Also call change_scene every 2–3 exchanges to keep the adventure fresh (available: ${SCENE_KEYS.filter(k => k !== sceneId).join(', ')}).

TOOL USAGE:
- Call add_visual_effect on magical moments (sparkle=magic, glow=happy, zoom=action)
- CRITICAL: NEVER write function names, tool names, or JSON in your spoken text. Tools are invisible.

STORY FLOW: The child is the hero. Build on exactly what they said!`;
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

// For TTS: flatten parenthesised Hindi into inline text so speech flows naturally
function toTTSText(text) {
  if (!text) return text;
  return text
    .replace(/\(([^)]+)\)/g, ' $1 ')
    .replace(/  +/g, ' ')
    .trim();
}

// Strip ALL hallucinated function call patterns that Llama embeds in text
// instead of using proper tool_calls
function cleanContent(text) {
  if (!text) return text;
  return text
    // <function=name ...>...</function>  or  <function=name/>
    .replace(/<function=[^>]*?(?:\/?>.*?<\/function>|\/?>)/gs, '')
    // add_visual_effect({...}) or add_visual_effect(word)
    .replace(/\badd_visual_effect\s*[({][^)}]*[)}]/g, '')
    // change_scene({...}) or change_scene(word)
    .replace(/\bchange_scene\s*[({][^)}]*[)}]/g, '')
    // [function: name(...)] or [name: {...}]
    .replace(/\[(?:function:\s*)?(?:add_visual_effect|change_scene)[^\]]*\]/g, '')
    // any remaining bare tool names with attached JSON braces
    .replace(/\b(?:add_visual_effect|change_scene)\s*\{[^}]*\}/g, '')
    // clean up double spaces / leading-trailing whitespace
    .replace(/  +/g, ' ')
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

    // ── Safety pre-filter ────────────────────────────────────────────────
    if (containsInappropriate(message)) {
      const safeReply = 'Are yaar, we don\'t say things like that! Cosmo only goes on adventures with kind explorers. Chalo, should we find something magical instead?';
      session.history.push({ role: 'user', content: '[inappropriate input filtered]' });
      session.history.push({ role: 'assistant', content: safeReply });
      return res.json({ response: safeReply, ttsText: safeReply, toolCall: null, currentScene: session.currentScene });
    }

    session.history.push({ role: 'user', content: message });

    let toolCall    = null;
    let aiResponse  = null;

    // ── Helper: salvage text + scene from a failed_generation string ──────
    const salvageFromFailedGen = (failedGen) => {
      if (!failedGen) return;
      // Extract scene from <function=change_scene>{"scene":"ocean",...}
      const sceneMatch = failedGen.match(/<function=change_scene[^>]*>\s*\{[^}]*"scene"\s*:\s*"([^"]+)"/);
      if (sceneMatch && SCENES[sceneMatch[1]]) {
        const newScene = sceneMatch[1];
        toolCall = { name: 'change_scene', arguments: { scene: newScene, transition_line: '' } };
        session.currentScene = newScene;
        session.history[0]   = { role: 'system', content: buildSystemPrompt(newScene) };
      }
      // Extract scene from <function=add_visual_effect>{"effect":"sparkle",...}
      const fxMatch = failedGen.match(/<function=add_visual_effect[^>]*>\s*\{[^}]*"effect"\s*:\s*"([^"]+)"/);
      if (fxMatch && !toolCall) {
        toolCall = { name: 'add_visual_effect', arguments: { effect: fxMatch[1], reason: '' } };
      }
      // Strip the broken function tag from text
      aiResponse = cleanContent(failedGen);
    };

    // ── First attempt: with tools ─────────────────────────────────────────
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: session.history,
        max_tokens: 200,
        temperature: 0.9,
        tools: TOOLS,
        tool_choice: 'auto'
      });

      const responseMessage = completion.choices[0].message;

      if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
        const raw  = responseMessage.tool_calls[0];
        const name = raw.function.name;
        const args = JSON.parse(raw.function.arguments);
        toolCall   = { name, arguments: args };

        if (name === 'change_scene' && SCENES[args.scene]) {
          session.currentScene = args.scene;
          session.history[0]   = { role: 'system', content: buildSystemPrompt(args.scene) };
        }
      }

      aiResponse = cleanContent(responseMessage.content);

      // Tool called but no text → follow-up without tools to get spoken reply
      if (!aiResponse && toolCall) {
        const followUp = await groq.chat.completions.create({
          model: 'llama-3.3-70b-versatile',
          messages: [
            ...session.history,
            { role: 'assistant', content: null, tool_calls: responseMessage.tool_calls },
            { role: 'tool', tool_call_id: responseMessage.tool_calls[0].id, content: 'done' }
          ],
          max_tokens: 200,
          temperature: 0.9
          // no tools here — prevents cascading tool_use_failed
        });
        aiResponse = cleanContent(followUp.choices[0].message.content);
      }

    } catch (firstErr) {
      const isToolFail = firstErr?.status === 400 &&
        firstErr?.error?.error?.code === 'tool_use_failed';

      if (isToolFail) {
        // Salvage text + scene from the partial generation Groq returns
        salvageFromFailedGen(firstErr?.error?.error?.failed_generation);
        console.warn('tool_use_failed — salvaged from failed_generation');

        // If salvage got nothing, do a clean no-tools retry
        if (!aiResponse) {
          const retry = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: session.history,
            max_tokens: 200,
            temperature: 0.9
            // no tools at all
          });
          aiResponse = cleanContent(retry.choices[0].message.content);
        }
      } else {
        throw firstErr; // re-throw unrelated errors
      }
    }

    if (!aiResponse) aiResponse = 'Bahut maja aa raha hai! (बहुत मजा आ रहा है!) What shall we do next? (हम आगे क्या करें?)';

    session.history.push({ role: 'assistant', content: aiResponse });

    res.json({ response: aiResponse, ttsText: toTTSText(aiResponse), toolCall, currentScene: session.currentScene });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.post('/api/start-conversation', async (req, res) => {
  try {
    const { sessionId } = req.body;

    // Pick a random scene each time so every adventure feels fresh
    const startScene = SCENE_KEYS[Math.floor(Math.random() * SCENE_KEYS.length)];
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

    res.json({ message: initialMessage, ttsText: toTTSText(initialMessage), currentScene: startScene });
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
      // prompt hint tells Whisper to expect only Hindi or English
      prompt: 'The child is speaking in either Hindi or English.',
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

    const audio = await elevenlabs.textToSpeech.convert(VOICE_ID, {
      text,
      modelId: 'eleven_multilingual_v2',   // required for Hindi + English bilingual speech
      voiceSettings: { stability: 0.5, similarityBoost: 0.75 },
      optimizeStreamingLatency: 3
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

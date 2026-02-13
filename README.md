# AI Storyteller 🌟

An interactive AI-powered storytelling experience that engages children through visual prompts and real-time voice conversation.

## Features

- 🎨 **Visual Storytelling** - Engaging image that sets the scene for conversation
- 🎤 **Voice Interaction** - Real-time speech recognition and synthesis
- 🤖 **AI-Driven Conversation** - GPT-4 powered natural conversation flow
- ✨ **Dynamic Visual Effects** - AI can trigger visual effects based on conversation
- ⏱️ **Timed Experience** - Focused 1-minute conversation sessions
- 💬 **Live Transcription** - See the conversation in real-time

## Tech Stack

**Frontend:**
- React 19 + Vite
- Web Speech API (Speech Recognition & Synthesis)
- Axios for API calls
- CSS3 animations

**Backend:**
- Node.js + Express
- Groq (Llama 3.3 70B) - Ultra-fast inference
- Function calling for UI interactions

## Prerequisites

- Node.js 16+ and npm
- Groq API key
- Modern browser with Web Speech API support (Chrome recommended)

## Setup

1. **Clone and install dependencies:**
```bash
npm install
```

2. **Configure environment variables:**
```bash
cp .env.example .env
```
Then edit `.env` and add your Groq API key:
```
GROQ_API_KEY=your_key_here
PORT=3001
```

3. **Start the backend server:**
```bash
npm run server
```

4. **In a new terminal, start the frontend:**
```bash
npm run dev
```

5. **Open your browser:**
Navigate to `http://localhost:5173`

## How It Works

1. Click "Start Story Time" to begin
2. The AI will initiate conversation based on the displayed image
3. Speak naturally - the app uses speech recognition to capture your responses
4. The AI responds with voice and text
5. During exciting moments, the AI may trigger visual effects on the image
6. Conversation automatically ends after 60 seconds

## Project Structure

```
├── src/
│   ├── components/
│   │   ├── VoiceControls.jsx    # Main voice interaction component
│   │   └── VoiceControls.css    # Component styles
│   ├── App.jsx                   # Main app component
│   ├── App.css                   # App styles
│   └── index.css                 # Global styles
├── server/
│   └── index.js                  # Express backend with OpenAI
└── package.json
```

## Browser Compatibility

Works best in Chrome/Edge with Web Speech API support. Firefox and Safari have limited speech recognition support.

## Future Enhancements

- Multiple story images to choose from
- Customizable conversation duration
- Save conversation history
- Multi-language support
- Parent dashboard

---

Built with ❤️ for creating magical storytelling moments

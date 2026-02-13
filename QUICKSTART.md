# Quick Start Guide 🚀

Get the AI Storyteller running in 3 minutes!

## Prerequisites

- Node.js 16+ installed
- Groq API key ([Get one here](https://console.groq.com))
- Chrome or Edge browser (for best speech recognition)

## Setup Steps

### 1️⃣ Install Dependencies

```bash
npm install
```

### 2️⃣ Configure Environment

```bash
# Copy the example file
cp .env.example .env

# Edit .env and add your OpenAI API key
```

Your `.env` should look like:
```
GROQ_API_KEY=gsk-your-actual-key-here
PORT=3001
```

### 3️⃣ Start the Backend

```bash
# Terminal 1
npm run server
```

You should see: `Server running on port 3001`

### 4️⃣ Start the Frontend

```bash
# Terminal 2 (new terminal)
npm run dev
```

You should see: `Local: http://localhost:5173/`

### 5️⃣ Open in Browser

Navigate to: **http://localhost:5173**

## First Time Use

1. **Allow Microphone Access** - Browser will ask for permission
2. **Click "Start Story Time"** - Big purple button
3. **Listen to the AI** - It will ask about the image
4. **Speak Your Response** - When you see "🎤 Listening..."
5. **Watch the Magic** - AI responds and may trigger visual effects!

## Troubleshooting

### "Server not running" error?
- Make sure Terminal 1 is still running `npm run server`
- Check port 3001 is not in use

### Microphone not working?
- Allow permissions in browser
- Use Chrome or Edge (best support)
- Check system microphone is working

### "Invalid API key" error?
- Verify Groq API key in `.env`
- Make sure it starts with `gsk-`
- Restart the server after changing `.env`

### Speech recognition not working?
- Chrome/Edge recommended
- HTTPS or localhost required
- Check browser console for errors

## Project Structure

```
📦 ai-storyteller
├── 📁 src/                  Frontend React app
│   ├── 📁 components/       VoiceControls component
│   ├── App.jsx             Main app component
│   └── ...
├── 📁 server/              Backend Express API
│   └── index.js           OpenAI integration
├── 📄 .env                Environment variables (your key here)
├── 📄 package.json        Dependencies
└── 📄 README.md          Full documentation
```

## What to Expect

✨ **Visual**: Beautiful gradient UI with story image  
🎤 **Audio**: AI speaks to you, listens to your responses  
🤖 **Smart**: GPT-4 powered natural conversation  
⏱️ **Timed**: Exactly 60 seconds of interaction  
🌟 **Effects**: Dynamic visual effects during exciting moments  

## Next Steps

- Read [README.md](README.md) for detailed info
- Check [USAGE.md](USAGE.md) for tips
- See [PROJECT_SUMMARY.md](PROJECT_SUMMARY.md) for technical details

---

**Enjoy your storytelling adventure! 🌟**

Need help? Check the full README or open an issue on GitHub.

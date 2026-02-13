# Usage Instructions

## Quick Start

1. Ensure both frontend and backend servers are running
2. Click the "Start Story Time" button
3. When the AI speaks, listen to the question
4. Reply naturally when you see "🎤 Listening..."
5. Watch for visual effects during exciting moments!

## Tips for Best Experience

- Speak clearly after the AI finishes talking
- Use Chrome or Edge browser for best speech recognition
- Keep ambient noise low for better recognition
- Allow microphone permissions when prompted

## Troubleshooting

**Speech recognition not working?**
- Check microphone permissions in browser
- Use Chrome/Edge (best support)
- Ensure you're on HTTPS or localhost

**Backend errors?**
- Verify Groq API key is set in `.env`
- Check that server is running on port 3001
- Look at console for detailed error messages

**No visual effects?**
- This is normal - effects only trigger based on conversation context
- Try discussing exciting parts of the image

## Customization

You can change the story image in `App.jsx`:
```jsx
src="YOUR_IMAGE_URL_HERE"
```

Adjust conversation duration in `VoiceControls.jsx`:
```jsx
const [timeLeft, setTimeLeft] = useState(60); // Change 60 to desired seconds
```

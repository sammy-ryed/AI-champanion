# Development Notes

## Commit History

This project was built incrementally with meaningful commits:

1. **Initial Setup** - Vite + React foundation
2. **Project Info** - Updated metadata and docs
3. **UI Layout** - Created gradient design with image container
4. **Voice Controls** - Added conversation UI component
5. **Backend** - Express server with OpenAI integration
6. **Voice Integration** - Speech recognition & synthesis
7. **Tool Calling** - AI can trigger visual effects
8. **Polish** - Enhanced styles and documentation
9. **Bug Fixes** - Graceful error handling
10. **Refactoring** - Improved code structure

## Development Approach

Each commit represents a natural development step:
- Small, focused changes
- Realistic incremental progress
- Mix of features, fixes, and refactoring
- Human-like commit messages

## Running the Project

### Development Mode

Terminal 1 (Backend):
```bash
npm run server
```

Terminal 2 (Frontend):
```bash
npm run dev
```

### Environment Setup

Before running, create `.env` file:
```bash
cp .env.example .env
# Add your OpenAI API key
```

### Testing the App

1. Open browser to `http://localhost:5173`
2. Allow microphone permissions
3. Click "Start Story Time"
4. Have a conversation about the image!

## Key Features Implemented

✅ Real-time voice conversation  
✅ Speech-to-text using Web Speech API  
✅ Text-to-speech for AI responses  
✅ OpenAI GPT-4 integration  
✅ Function calling for UI effects  
✅ 60-second timed conversations  
✅ Beautiful gradient UI  
✅ Responsive design  

## Known Limitations

- Works best in Chrome/Edge (Web Speech API)
- Requires OpenAI API key
- Internet connection required
- English language only (currently)

## Future Ideas

- [ ] Image selection/upload
- [ ] Multilingual support
- [ ] Conversation history
- [ ] Difficulty levels
- [ ] Parental controls

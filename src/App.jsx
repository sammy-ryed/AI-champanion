import { useState } from 'react'
import './App.css'
import VoiceControls from './components/VoiceControls'

function App() {
  const [imageEffect, setImageEffect] = useState('');
  const [effectLabel, setEffectLabel] = useState('');

  const handleToolCall = (toolCall) => {
    if (toolCall && toolCall.name === 'add_visual_effect') {
      const { effect, reason } = toolCall.arguments;
      setImageEffect(effect);
      setEffectLabel(reason);
      
      setTimeout(() => {
        setImageEffect('');
        setEffectLabel('');
      }, 3000);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>🌟 AI Story Time</h1>
        <p>Let's explore stories together!</p>
      </header>
      
      <div className="content">
        <div className={`image-container ${imageEffect ? `effect-${imageEffect}` : ''}`}>
          <img 
            src="https://images.unsplash.com/photo-1518021857458-4c0d7c0ebba6?w=800&q=80"
            alt="A child's adventure story scene"
            className="story-image"
          />
          {effectLabel && (
            <div className="effect-badge">✨ {effectLabel}</div>
          )}
        </div>
        
        <VoiceControls onToolCall={handleToolCall} />
      </div>
    </div>
  )
}

export default App

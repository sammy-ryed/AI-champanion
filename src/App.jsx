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

  const storyImages = [
    {
      url: "https://cdn.pixabay.com/photo/2016/11/29/05/45/astronomy-1867616_1280.jpg",
      alt: "A magical space adventure with stars and galaxies"
    }
  ];

  const currentImage = storyImages[0];

  return (
    <div className="app-container">
      <header className="header">
        <h1>Space Story Time</h1>
        <p>Let&apos;s tell a fun story about this picture!</p>
      </header>
      
      <div className="content">
        <div className={`image-container ${imageEffect ? `effect-${imageEffect}` : ''}`}>
          <img 
            src={currentImage.url}
            alt={currentImage.alt}
            className="story-image"
          />
          {effectLabel && (
            <div className="effect-badge">{effectLabel}</div>
          )}
        </div>
        
        <VoiceControls onToolCall={handleToolCall} imageUrl={currentImage.url} />
      </div>
    </div>
  )
}

export default App

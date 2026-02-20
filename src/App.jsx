import { useState, useCallback } from 'react'
import './App.css'
import VoiceControls from './components/VoiceControls'

const SCENES = {
  space: {
    url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1280&q=80&auto=format',
    label: 'Outer Space'
  },
  ocean: {
    url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1280&q=80&auto=format',
    label: 'Ocean World'
  },
  forest: {
    url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1280&q=80&auto=format',
    label: 'Enchanted Forest'
  },
  castle: {
    url: 'https://images.unsplash.com/photo-1599930113854-d6d7fd521f10?w=1280&q=80&auto=format',
    label: 'Magic Kingdom'
  },
  mountains: {
    url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&q=80&auto=format',
    label: 'Mountain Adventure'
  }
}

function App() {
  const [currentSceneId, setCurrentSceneId] = useState('space')
  const [imageEffect, setImageEffect] = useState('')
  const [effectLabel, setEffectLabel] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleToolCall = useCallback((toolCall) => {
    if (!toolCall) return

    if (toolCall.name === 'add_visual_effect') {
      const { effect, reason } = toolCall.arguments
      setImageEffect(effect)
      setEffectLabel(reason)
      setTimeout(() => {
        setImageEffect('')
        setEffectLabel('')
      }, 2500)
    }

    if (toolCall.name === 'change_scene') {
      const { scene } = toolCall.arguments
      if (SCENES[scene] && scene !== currentSceneId) {
        setIsTransitioning(true)
        setTimeout(() => {
          setCurrentSceneId(scene)
          setImageEffect('')
          setEffectLabel('')
          setTimeout(() => setIsTransitioning(false), 400)
        }, 300)
      }
    }
  }, [currentSceneId])

  const scene = SCENES[currentSceneId]

  return (
    <div className="app">
      <div className="scene-panel">
        <div className={`scene-image-wrap ${imageEffect ? `fx-${imageEffect}` : ''} ${isTransitioning ? 'transitioning' : ''}`}>
          <img
            key={currentSceneId}
            src={scene.url}
            alt={scene.label}
            className="scene-img"
          />
          <div className="scene-label">{scene.label}</div>
          {effectLabel && <div className="effect-tag">{effectLabel}</div>}
        </div>
      </div>

      <div className="chat-panel">
        <VoiceControls onToolCall={handleToolCall} />
      </div>
    </div>
  )
}

export default App

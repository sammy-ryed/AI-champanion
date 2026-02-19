import { useState, useCallback } from 'react'
import './App.css'
import VoiceControls from './components/VoiceControls'

const SCENES = {
  space: {
    url: 'https://cdn.pixabay.com/photo/2016/11/29/05/45/astronomy-1867616_1280.jpg',
    label: 'Outer Space'
  },
  ocean: {
    url: 'https://cdn.pixabay.com/photo/2017/01/20/00/30/maldives-1993704_1280.jpg',
    label: 'Ocean World'
  },
  forest: {
    url: 'https://cdn.pixabay.com/photo/2015/09/09/16/05/forest-931706_1280.jpg',
    label: 'Enchanted Forest'
  },
  castle: {
    url: 'https://cdn.pixabay.com/photo/2016/01/09/18/27/journey-1130732_1280.jpg',
    label: 'Magic Kingdom'
  },
  mountains: {
    url: 'https://cdn.pixabay.com/photo/2015/04/23/22/00/tree-736885_1280.jpg',
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

import { useState, useCallback } from 'react'
import './App.css'
import VoiceControls from './components/VoiceControls'

// Starting scenes (Unsplash, loads instantly) — used for the initial random pick
const INITIAL_SCENES = [
  { url: 'https://images.unsplash.com/photo-1462331940025-496dfbfc7564?w=1280&q=80&auto=format', label: 'Outer Space' },
  { url: 'https://images.unsplash.com/photo-1518020382113-a7e8fc38eac9?w=1280&q=80&auto=format', label: 'Ocean World' },
  { url: 'https://images.unsplash.com/photo-1448375240586-882707db888b?w=1280&q=80&auto=format', label: 'Enchanted Forest' },
  { url: 'https://images.unsplash.com/photo-1599930113854-d6d7fd521f10?w=1280&q=80&auto=format', label: 'Magic Kingdom' },
  { url: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1280&q=80&auto=format', label: 'Mountain Adventure' },
]

const INITIAL_SCENE_MAP = {
  space:     INITIAL_SCENES[0],
  ocean:     INITIAL_SCENES[1],
  forest:    INITIAL_SCENES[2],
  castle:    INITIAL_SCENES[3],
  mountains: INITIAL_SCENES[4],
}

function pollinationsUrl(description) {
  const prompt = `${description}, magical storybook illustration, vibrant colors, child-friendly, high quality`
  return `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1280&height=720&nologo=true&model=flux`
}

function App() {
  const [currentScene, setCurrentScene] = useState(INITIAL_SCENES[0])
  const [pendingScene, setPendingScene]  = useState(null)   // preloading next scene
  const [imageEffect, setImageEffect]   = useState('')
  const [effectLabel, setEffectLabel]   = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleToolCall = useCallback((toolCall) => {
    if (!toolCall) return

    if (toolCall.name === 'add_visual_effect') {
      const { effect, reason } = toolCall.arguments
      setImageEffect(effect)
      setEffectLabel(reason)
      setTimeout(() => { setImageEffect(''); setEffectLabel(''); }, 2500)
    }

    if (toolCall.name === 'change_scene') {
      const { scene_label, scene_description, scene } = toolCall.arguments

      // Initial scene set by handleStart uses Unsplash URL directly
      if (scene && !scene_description) {
        const next = INITIAL_SCENE_MAP[scene] || INITIAL_SCENES[0]
        setIsTransitioning(true)
        setTimeout(() => { setCurrentScene(next); setIsTransitioning(false); }, 300)
        return
      }

      // Dynamic AI-chosen scene — preload Pollinations image then crossfade
      const label = scene_label || 'Adventure'
      const desc  = scene_description || `${label} magical storybook illustration vibrant colors child-friendly`
      const url   = pollinationsUrl(desc)
      setPendingScene({ url, label })

      const img = new Image()
      const applyScene = () => {
        setIsTransitioning(true)
        setTimeout(() => {
          setCurrentScene({ url, label })
          setImageEffect('')
          setEffectLabel('')
          setPendingScene(null)
          setTimeout(() => setIsTransitioning(false), 400)
        }, 300)
      }
      // Apply after load, or force-apply after 25s timeout
      const timeout = setTimeout(applyScene, 25000)
      img.onload  = () => { clearTimeout(timeout); applyScene(); }
      img.onerror = () => { clearTimeout(timeout); applyScene(); } // show even if broken
      img.src = url
    }
  }, [])

  return (
    <div className="app">
      <div className="scene-panel">
        <div className={`scene-image-wrap ${imageEffect ? `fx-${imageEffect}` : ''} ${isTransitioning ? 'transitioning' : ''}`}>
          <img
            key={currentScene.url}
            src={currentScene.url}
            alt={currentScene.label}
            className="scene-img"
          />
          <div className="scene-label">{currentScene.label}</div>
          {effectLabel && <div className="effect-tag">{effectLabel}</div>}
          {pendingScene && (
            <div className="scene-generating">
              <span>✨ Generating scene…</span>
            </div>
          )}
        </div>
      </div>

      <div className="chat-panel">
        <VoiceControls onToolCall={handleToolCall} />
      </div>
    </div>
  )
}

export default App

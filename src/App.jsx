import { useState } from 'react'
import './App.css'

function App() {
  return (
    <div className="app-container">
      <header className="header">
        <h1>🌟 AI Story Time</h1>
        <p>Let's explore stories together!</p>
      </header>
      
      <div className="content">
        <div className="image-container">
          <img 
            src="https://images.unsplash.com/photo-1518021857458-4c0d7c0ebba6?w=800&q=80"
            alt="A child's adventure story scene"
            className="story-image"
          />
        </div>
      </div>
    </div>
  )
}

export default App

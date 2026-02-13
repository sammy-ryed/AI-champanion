import { useState } from 'react';
import './VoiceControls.css';

function VoiceControls() {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);

  const handleStart = () => {
    setIsActive(true);
    setMessages([
      { 
        sender: 'AI', 
        text: "Hi there! I can see a beautiful adventure scene. What do you think is happening in this picture?",
        type: 'ai'
      }
    ]);
  };

  return (
    <div className="controls-section">
      <button 
        className={`start-button ${isActive ? 'listening' : ''}`}
        onClick={handleStart}
        disabled={isActive}
      >
        {isActive ? '🎤 Listening...' : '🎬 Start Story Time'}
      </button>

      {isActive && (
        <>
          <div className="timer">
            Time: {timeLeft}s
          </div>

          <div className="conversation-display">
            <h3>Conversation</h3>
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.type}`}>
                <div className="sender">{msg.sender}</div>
                <div className="text">{msg.text}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="status-indicator">
                Waiting to start...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default VoiceControls;

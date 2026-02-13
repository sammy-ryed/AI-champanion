import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './VoiceControls.css';

const API_URL = 'http://localhost:3001/api';

function VoiceControls({ onToolCall }) {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isListening, setIsListening] = useState(false);
  const sessionId = useRef(Date.now().toString());
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        handleUserMessage(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            handleEnd();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [isActive, timeLeft]);

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    synthRef.current.speak(utterance);
    
    return new Promise((resolve) => {
      utterance.onend = resolve;
    });
  };

  const handleStart = async () => {
    setIsActive(true);
    setTimeLeft(60);
    setMessages([]);

    try {
      const response = await axios.post(`${API_URL}/start-conversation`, {
        sessionId: sessionId.current,
        imageUrl: 'https://images.unsplash.com/photo-1518021857458-4c0d7c0ebba6'
      });

      const aiMessage = response.data.message;
      setMessages([{ sender: 'AI', text: aiMessage, type: 'ai' }]);
      
      await speak(aiMessage);
      
      if (recognitionRef.current) {
        recognitionRef.current.start();
        setIsListening(true);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const handleUserMessage = async (userText) => {
    if (!isActive) return;

    setMessages(prev => [...prev, { sender: 'You', text: userText, type: 'user' }]);
    setIsListening(false);

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        message: userText,
        sessionId: sessionId.current,
        imageUrl: 'https://images.unsplash.com/photo-1518021857458-4c0d7c0ebba6'
      });

      const aiResponse = response.data.response;
      const toolCall = response.data.toolCall;
      
      setMessages(prev => [...prev, { sender: 'AI', text: aiResponse, type: 'ai' }]);
      
      if (toolCall && onToolCall) {
        onToolCall(toolCall);
      }
      
      await speak(aiResponse);
      
      if (recognitionRef.current && timeLeft > 5) {
        recognitionRef.current.start();
        setIsListening(true);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleEnd = () => {
    setIsActive(false);
    setIsListening(false);
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    synthRef.current.cancel();
    speak("Great conversation! Thanks for sharing your thoughts with me!");
  };

  return (
    <div className="controls-section">
      <button 
        className={`start-button ${isListening ? 'listening' : ''}`}
        onClick={handleStart}
        disabled={isActive}
      >
        {isListening ? '🎤 Listening...' : '🎬 Start Story Time'}
      </button>

      {isActive && (
        <>
          <div className="timer">
            ⏱️ {timeLeft}s remaining
          </div>

          <div className="conversation-display">
            <h3>💬 Our Conversation</h3>
            {messages.map((msg, index) => (
              <div key={index} className={`message ${msg.type}`}>
                <div className="sender">{msg.sender}</div>
                <div className="text">{msg.text}</div>
              </div>
            ))}
            {messages.length === 0 && (
              <div className="status-indicator">
                Starting conversation...
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default VoiceControls;

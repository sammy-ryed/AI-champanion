import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import './VoiceControls.css';

const API_URL = 'http://localhost:3001/api';

function VoiceControls({ onToolCall, imageUrl }) {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isListening, setIsListening] = useState(false);
  const sessionId = useRef(Date.now().toString());
  const recognitionRef = useRef(null);
  const audioRef = useRef(new Audio());
  const isSpeakingRef = useRef(false);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[event.results.length - 1][0].transcript;
        console.log('Heard:', transcript);
        handleUserMessage(transcript);
      };

      recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'no-speech') {
          // Restart if no speech detected
          if (isActive && !isSpeakingRef.current) {
            setTimeout(() => {
              try {
                recognition.start();
              } catch (e) {
                console.log('Recognition already started');
              }
            }, 100);
          }
        }
      };

      recognition.onend = () => {
        console.log('Recognition ended');
        setIsListening(false);
        // Auto-restart recognition if conversation is still active and not speaking
        if (isActive && !isSpeakingRef.current) {
          setTimeout(() => {
            try {
              recognitionRef.current?.start();
              setIsListening(true);
              console.log('Recognition restarted');
            } catch (e) {
              console.log('Could not restart:', e.message);
            }
          }, 500);
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
      }
    };
  }, [isActive]);

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

  const speak = async (text) => {
    try {
      isSpeakingRef.current = true;
      setIsListening(false);
      
      // Stop recognition while speaking
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          // Already stopped
        }
      }

      const response = await axios.post(`${API_URL}/text-to-speech`, 
        { text },
        { responseType: 'arraybuffer' }
      );

      const blob = new Blob([response.data], { type: 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(blob);
      
      audioRef.current.src = audioUrl;
      
      return new Promise((resolve) => {
        audioRef.current.onended = () => {
          isSpeakingRef.current = false;
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        audioRef.current.play();
      });
    } catch (error) {
      console.error('TTS Error:', error);
      isSpeakingRef.current = false;
      // Fallback to browser TTS
      return new Promise((resolve) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.9;
        utterance.onend = () => {
          isSpeakingRef.current = false;
          resolve();
        };
        window.speechSynthesis.speak(utterance);
      });
    }
  };

  const handleStart = async () => {
    setIsActive(true);
    setTimeLeft(60);
    setMessages([]);

    try {
      const response = await axios.post(`${API_URL}/start-conversation`, {
        sessionId: sessionId.current,
        imageUrl: imageUrl
      });

      const aiMessage = response.data.message;
      setMessages([{ sender: 'AI', text: aiMessage, type: 'ai' }]);
      
      await speak(aiMessage);
      
      // Start listening after AI finishes speaking
      if (recognitionRef.current) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListening(true);
            console.log('Started listening');
          } catch (e) {
            console.log('Recognition start error:', e);
          }
        }, 300);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
    }
  };

  const handleUserMessage = async (userText) => {
    if (!isActive || isSpeakingRef.current) return;

    console.log('Processing message:', userText);
    setMessages(prev => [...prev, { sender: 'You', text: userText, type: 'user' }]);

    // Stop listening while processing
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        // Already stopped
      }
    }

    try {
      const response = await axios.post(`${API_URL}/chat`, {
        message: userText,
        sessionId: sessionId.current,
        imageUrl: imageUrl
      });

      const aiResponse = response.data.response;
      const toolCall = response.data.toolCall;
      
      setMessages(prev => [...prev, { sender: 'AI', text: aiResponse, type: 'ai' }]);
      
      if (toolCall && onToolCall) {
        onToolCall(toolCall);
      }
      
      await speak(aiResponse);
      
      // Restart listening after AI speaks
      if (recognitionRef.current && timeLeft > 5) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListening(true);
            console.log('Restarted listening after response');
          } catch (e) {
            console.log('Could not restart:', e);
          }
        }, 300);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Try to restart listening even if there's an error
      if (recognitionRef.current && isActive) {
        setTimeout(() => {
          try {
            recognitionRef.current.start();
            setIsListening(true);
          } catch (e) {
            console.log('Error restart failed:', e);
          }
        }, 300);
      }
    }
  };

  const handleEnd = () => {
    setIsActive(false);
    setIsListening(false);
    isSpeakingRef.current = false;
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        recognitionRef.current.onend = null;
      } catch (e) {
        // Already stopped
      }
    }
    
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
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

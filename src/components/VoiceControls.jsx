import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './VoiceControls.css';

const API_URL = 'http://localhost:3001/api';

function VoiceControls({ onToolCall, imageUrl }) {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPressing, setIsPressing] = useState(false);
  
  const sessionId = useRef(Date.now().toString());
  const recognitionRef = useRef(null);
  const isProcessingRef = useRef(false);
  const transcriptRef = useRef('');

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
        setIsListening(false);
        console.log('Stopped listening');
      } catch (e) {
        console.error('Stop error:', e.message);
      }
    }
  }, []);

  const speak = useCallback((text) => {
    return new Promise(async (resolve) => {
      try {
        setIsSpeaking(true);
        stopListening();
        
        const response = await axios.post(`${API_URL}/text-to-speech`, 
          { text },
          { responseType: 'arraybuffer' }
        );

        const blob = new Blob([response.data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio = new Audio(audioUrl);
        
        audio.onended = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        audio.onerror = () => {
          setIsSpeaking(false);
          URL.revokeObjectURL(audioUrl);
          resolve();
        };
        
        audio.play();
      } catch (error) {
        console.error('TTS Error:', error);
        // Fallback to browser TTS
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;
        
        utterance.onend = () => {
          setIsSpeaking(false);
          resolve();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          resolve();
        };
        
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      }
    });
  }, [stopListening]);

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        console.log('Started listening');
      } catch (e) {
        if (e.message.includes('already started')) {
          setIsListening(true);
        } else {
          console.error('Start error:', e.message);
        }
      }
    }
  }, []);

  const handleUserMessage = useCallback(async (userText) => {
    if (!isActive || isProcessingRef.current || isSpeaking) return;
    
    isProcessingRef.current = true;
    stopListening();
    
    setMessages(prev => [...prev, { sender: 'You', text: userText, type: 'user' }]);

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
      
      isProcessingRef.current = false;
      
      if (isActive) {
        setTimeout(() => startListening(), 500);
      }
    } catch (error) {
      console.error('Error:', error);
      isProcessingRef.current = false;
      if (isActive) {
        setTimeout(() => startListening(), 500);
      }
    }
  }, [isActive, isSpeaking, stopListening, speak, startListening, imageUrl, onToolCall]);

  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Got transcript:', transcript);
        transcriptRef.current = transcript;
      };

      recognition.onend = () => {
        console.log('Recognition ended, transcript:', transcriptRef.current);
        setIsListening(false);
        
        if (isPressing && !transcriptRef.current) {
          // Still holding spacebar but no transcript yet, restart
          console.log('Restarting recognition - still holding spacebar');
          setTimeout(() => {
            if (isPressing) {
              startListening();
            }
          }, 100);
        } else if (transcriptRef.current) {
          const text = transcriptRef.current;
          transcriptRef.current = '';
          console.log('Processing message:', text);
          handleUserMessage(text);
        }
      };

      recognition.onerror = (event) => {
        console.error('Recognition error:', event.error);
        setIsListening(false);
        
        if (event.error === 'network' || event.error === 'audio-capture') {
          console.warn(event.error + ' error - restarting in 200ms');
          setTimeout(() => {
            if (isPressing) {
              startListening();
            }
          }, 200);
        } else if (event.error === 'no-speech') {
          console.log('No speech - restarting');
          if (isPressing) {
            setTimeout(() => startListening(), 100);
          }
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
      }
    };
  }, [handleUserMessage, isPressing, startListening]);

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      console.log('Key down:', e.code, 'repeat:', e.repeat, 'pressing:', isPressing, 'speaking:', isSpeaking);
      if (e.code === 'Space' && !e.repeat && !isPressing && !isSpeaking && !isProcessingRef.current) {
        e.preventDefault();
        console.log('SPACEBAR PRESSED - Starting to listen');
        setIsPressing(true);
        transcriptRef.current = '';
        startListening();
      }
    };

    const handleKeyUp = (e) => {
      console.log('Key up:', e.code, 'pressing:', isPressing);
      if (e.code === 'Space' && isPressing) {
        e.preventDefault();
        console.log('SPACEBAR RELEASED - Stopping');
        setIsPressing(false);
        stopListening();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isActive, isPressing, isSpeaking, startListening, stopListening]);

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

  const handleStart = async () => {
    setIsActive(true);
    setTimeLeft(60);
    setMessages([]);
    isProcessingRef.current = false;

    // Request microphone permission
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log('Microphone permission granted');
    } catch (err) {
      console.error('Microphone permission denied:', err);
      alert('Please allow microphone access to use voice chat!');
      setIsActive(false);
      return;
    }

    try {
      const response = await axios.post(`${API_URL}/start-conversation`, {
        sessionId: sessionId.current,
        imageUrl: imageUrl
      });

      const aiMessage = response.data.message;
      setMessages([{ sender: 'AI', text: aiMessage, type: 'ai' }]);
      
      await speak(aiMessage);
    } catch (error) {
      console.error('Error starting:', error);
    }
  };

  const handleEnd = () => {
    setIsActive(false);
    stopListening();
    isProcessingRef.current = false;
    window.speechSynthesis.cancel();
  };

  return (
    <div className="controls-section">
      {!isActive ? (
        <button className="start-button" onClick={handleStart}>
          <span className="button-icon">🎙️</span>
          <span className="button-text">Start Conversation</span>
        </button>
      ) : (
        <>
          <div className="status-bar">
            <div className={`mic-indicator ${isListening ? 'active' : ''}`}>
              {isListening ? '🎤 Listening...' : isSpeaking ? '🔊 Speaking...' : '⌨️ Hold Space to Talk'}
            </div>
            <div className="timer-badge">{timeLeft}s</div>
            <button className="stop-button" onClick={handleEnd}>Stop</button>
          </div>

          <div className="messages-container">
            {messages.map((msg, index) => (
              <div key={index} className={`message-bubble ${msg.type}`}>
                <div className="message-avatar">{msg.type === 'ai' ? '🤖' : '👤'}</div>
                <div className="message-content">
                  <div className="message-sender">{msg.sender}</div>
                  <div className="message-text">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default VoiceControls;

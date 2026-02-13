import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './VoiceControls.css';

const API_URL = 'http://localhost:3001/api';

function VoiceControls({ onToolCall, imageUrl }) {
  const [isActive, setIsActive] = useState(false);
  const [messages, setMessages] = useState([]);
  const [timeLeft, setTimeLeft] = useState(60);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userInput, setUserInput] = useState('');

  const sessionId = useRef(Date.now().toString());
  const inputRef = useRef(null);

  const speak = useCallback((text) => {
    return new Promise(async (resolve) => {
      try {
        setIsSpeaking(true);

        const response = await axios.post(
          `${API_URL}/text-to-speech`,
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
  }, []);

  const handleUserMessage = useCallback(
    async (userText) => {
      const text = userText.trim();
      if (!isActive || !text || isProcessing) return;

      setIsProcessing(true);
      setMessages((prev) => [
        ...prev,
        { sender: 'You', text, type: 'user' }
      ]);

      try {
        const response = await axios.post(`${API_URL}/chat`, {
          message: text,
          sessionId: sessionId.current,
          imageUrl: imageUrl,
        });

        const aiResponse = response.data.response;
        const toolCall = response.data.toolCall;

        setMessages((prev) => [
          ...prev,
          { sender: 'Story Buddy', text: aiResponse, type: 'ai' },
        ]);

        if (toolCall && onToolCall) {
          onToolCall(toolCall);
        }

        await speak(aiResponse);
      } catch (error) {
        console.error('Error:', error);
      } finally {
        setIsProcessing(false);
      }
    },
    [isActive, isProcessing, imageUrl, onToolCall, speak]
  );

  const sendCurrentInput = useCallback(() => {
    if (!userInput.trim()) return;
    const text = userInput;
    setUserInput('');
    handleUserMessage(text);
  }, [userInput, handleUserMessage]);

  useEffect(() => {
    if (isActive && timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
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

  useEffect(() => {
    if (!isActive) return;

    const handleKeyDown = (e) => {
      if (
        e.code === 'Space' &&
        !e.repeat &&
        document.activeElement !== inputRef.current
      ) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isActive]);

  const handleStart = async () => {
    setIsActive(true);
    setTimeLeft(60);
    setMessages([]);

    try {
      const response = await axios.post(`${API_URL}/start-conversation`, {
        sessionId: sessionId.current,
        imageUrl: imageUrl,
      });

      const aiMessage = response.data.message;
      setMessages([{ sender: 'Story Buddy', text: aiMessage, type: 'ai' }]);

      await speak(aiMessage);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    } catch (error) {
      console.error('Error starting:', error);
    }
  };

  const handleEnd = () => {
    setIsActive(false);
    setIsProcessing(false);
    window.speechSynthesis.cancel();
  };

  const statusText = !isActive
    ? ''
    : isSpeaking
    ? 'Your story buddy is talking...'
    : isProcessing
    ? 'Your story buddy is thinking...'
    : 'Press Space to start typing, then Enter to send';

  return (
    <div className="controls-section">
      {!isActive ? (
        <button className="start-button" onClick={handleStart}>
          <span className="button-text">Start Story</span>
        </button>
      ) : (
        <>
          <div className="status-bar">
            <div
              className={`mic-indicator ${
                isSpeaking || isProcessing ? 'active' : ''
              }`}
            >
              {statusText}
            </div>
            <div className="timer-badge">{timeLeft}s</div>
            <button className="stop-button" onClick={handleEnd}>
              End Story
            </button>
          </div>

          <div className="messages-container">
            {messages.map((msg, index) => (
              <div key={index} className={`message-bubble ${msg.type}`}>
                <div className="message-avatar">
                  {msg.type === 'ai' ? 'SB' : 'You'}
                </div>
                <div className="message-content">
                  <div className="message-sender">{msg.sender}</div>
                  <div className="message-text">{msg.text}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="input-row">
            <input
              ref={inputRef}
              className="user-input"
              type="text"
              placeholder="Press Space, type your answer, then press Enter"
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  sendCurrentInput();
                }
              }}
            />
            <button
              className="send-button"
              onClick={sendCurrentInput}
              disabled={!userInput.trim() || isProcessing || isSpeaking}
            >
              Send
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default VoiceControls;

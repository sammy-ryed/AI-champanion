import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './VoiceControls.css';

const API_URL = 'http://localhost:3001/api';

function VoiceControls({ onToolCall }) {
  const [isActive, setIsActive]         = useState(false);
  const [messages, setMessages]         = useState([]);
  const [timeLeft, setTimeLeft]         = useState(60);
  const [isSpeaking, setIsSpeaking]     = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [userInput, setUserInput]       = useState('');
  const [isListening, setIsListening]   = useState(false);
  const [liveText, setLiveText]         = useState('');
  const [sttError, setSttError]         = useState('');
  const [sttAvailable, setSttAvailable] = useState(false);

  const sessionId        = useRef(Date.now().toString());
  const inputRef         = useRef(null);
  const messagesEndRef   = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const micStreamRef     = useRef(null);
  const isListeningRef   = useRef(false);
  const isProcessingRef  = useRef(false);
  const isSpeakingRef    = useRef(false);

  useEffect(() => { isListeningRef.current  = isListening;  }, [isListening]);
  useEffect(() => { isProcessingRef.current = isProcessing; }, [isProcessing]);
  useEffect(() => { isSpeakingRef.current   = isSpeaking;   }, [isSpeaking]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, liveText, isProcessing]);

  // ── Check mic availability (MediaRecorder) ──────────────────────────────
  useEffect(() => {
    if (navigator.mediaDevices && window.MediaRecorder) {
      setSttAvailable(true);
    } else {
      setSttAvailable(false);
    }
    return () => {
      // Stop mic stream on unmount
      micStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  // ── ElevenLabs TTS (only) ────────────────────────────────────────────────
  const speak = useCallback((text) => {
    return new Promise(async (resolve) => {
      try {
        setIsSpeaking(true);
        const response = await axios.post(
          `${API_URL}/text-to-speech`, { text },
          { responseType: 'arraybuffer' }
        );
        const blob     = new Blob([response.data], { type: 'audio/mpeg' });
        const audioUrl = URL.createObjectURL(blob);
        const audio    = new Audio(audioUrl);
        audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); resolve(); };
        audio.onerror = () => { setIsSpeaking(false); URL.revokeObjectURL(audioUrl); resolve(); };
        audio.play();
      } catch (err) {
        console.error('TTS error:', err);
        setIsSpeaking(false);
        resolve();
      }
    });
  }, []);

  // ── Send message to AI ───────────────────────────────────────────────────
  const handleUserMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isProcessingRef.current || isSpeakingRef.current) return;

    setIsProcessing(true);
    setMessages(prev => [...prev, { sender: 'you', text: trimmed }]);

    try {
      const res = await axios.post(`${API_URL}/chat`, {
        message: trimmed,
        sessionId: sessionId.current,
      });
      const { response: aiText, toolCall } = res.data;
      setMessages(prev => [...prev, { sender: 'ai', text: aiText }]);
      if (toolCall && onToolCall) onToolCall(toolCall);
      await speak(aiText);
    } catch (err) {
      console.error('Chat error:', err);
      setMessages(prev => [...prev, { sender: 'ai', text: "Oops! Try again!" }]);
    } finally {
      setIsProcessing(false);
    }
  }, [onToolCall, speak]);

  const handleUserMessageRef = useRef(handleUserMessage);
  useEffect(() => { handleUserMessageRef.current = handleUserMessage; }, [handleUserMessage]);

  // ── Typed input send ─────────────────────────────────────────────────────
  const sendTyped = useCallback(() => {
    if (!userInput.trim()) return;
    const text = userInput;
    setUserInput('');
    handleUserMessage(text);
  }, [userInput, handleUserMessage]);

  // ── Hold-SPACE push-to-talk (MediaRecorder → Groq Whisper) ───────────────────
  useEffect(() => {
    if (!isActive) return;

    const onKeyDown = async (e) => {
      if (
        e.code !== 'Space' ||
        e.repeat ||
        isListeningRef.current ||
        isProcessingRef.current ||
        isSpeakingRef.current ||
        document.activeElement === inputRef.current
      ) return;
      e.preventDefault();

      if (!sttAvailable) { inputRef.current?.focus(); return; }

      setSttError('');
      setLiveText('');

      try {
        // Get mic stream (request permission first time)
        if (!micStreamRef.current || micStreamRef.current.getTracks().every(t => t.readyState === 'ended')) {
          micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        audioChunksRef.current = [];
        const rec = new MediaRecorder(micStreamRef.current);
        mediaRecorderRef.current = rec;

        rec.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };

        rec.start();
        setIsListening(true);
      } catch (err) {
        console.error('Mic error:', err);
        setSttError('Microphone access denied — type your answer below');
        setSttAvailable(false);
      }
    };

    const onKeyUp = (e) => {
      if (e.code !== 'Space' || !isListeningRef.current) return;
      e.preventDefault();

      const rec = mediaRecorderRef.current;
      if (!rec || rec.state === 'inactive') return;

      rec.onstop = async () => {
        setIsListening(false);
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        audioChunksRef.current = [];

        if (blob.size < 1000) return; // too short, ignore

        setLiveText('Transcribing…');
        try {
          const formData = new FormData();
          formData.append('audio', blob, 'recording.webm');
          const res = await axios.post(`${API_URL}/transcribe`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          });
          const text = res.data.text?.trim();
          setLiveText('');
          if (text) handleUserMessageRef.current(text);
        } catch (err) {
          console.error('Transcribe error:', err);
          setLiveText('');
          setSttError('Could not transcribe — type your answer below');
        }
      };

      rec.stop();
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup',   onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup',   onKeyUp);
    };
  }, [isActive, sttAvailable]);

  // ── 60-second timer ──────────────────────────────────────────────────────
  const handleEnd = useCallback(() => {
    setIsActive(false);
    setIsListening(false);
    setIsProcessing(false);
    setLiveText('');
    try { mediaRecorderRef.current?.stop(); } catch (_) {}
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current = null;
  }, []);

  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    const id = setInterval(() => {
      setTimeLeft(prev => { if (prev <= 1) { handleEnd(); return 0; } return prev - 1; });
    }, 1000);
    return () => clearInterval(id);
  }, [isActive, timeLeft, handleEnd]);

  // ── Start ────────────────────────────────────────────────────────────────
  const handleStart = async () => {
    setIsActive(true);
    setTimeLeft(60);
    setMessages([]);
    setSttError('');
    sessionId.current = Date.now().toString();

    try {
      const res = await axios.post(`${API_URL}/start-conversation`, {
        sessionId: sessionId.current,
      });
      const { message } = res.data;
      setMessages([{ sender: 'ai', text: message }]);
      await speak(message);
    } catch (err) {
      console.error('Start error:', err);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const timerPct   = (timeLeft / 60) * 100;
  const timerColor = timeLeft > 20 ? '#10b981' : timeLeft > 10 ? '#f59e0b' : '#ef4444';
  const statusText = isListening   ? 'Recording… release Space to send'
                   : isSpeaking    ? 'Speaking…'
                   : isProcessing  ? 'Thinking…'
                   : sttAvailable  ? 'Hold Space to speak'
                                   : 'Type your answer';

  return (
    <div className="vc-root">
      {!isActive ? (
        <div className="idle-screen">
          <p className="idle-hint">An adventure story, just for you</p>
          <button className="btn-start" onClick={handleStart}>Start Adventure</button>
        </div>
      ) : (
        <>
          {/* Top bar */}
          <div className="topbar">
            <span className="status-text">{statusText}</span>
            <div className="timer-ring">
              <svg width="40" height="40" viewBox="0 0 40 40">
                <circle cx="20" cy="20" r="16" fill="none" stroke="#e5e7eb" strokeWidth="3"/>
                <circle
                  cx="20" cy="20" r="16" fill="none"
                  stroke={timerColor} strokeWidth="3"
                  strokeDasharray={`${2 * Math.PI * 16}`}
                  strokeDashoffset={`${2 * Math.PI * 16 * (1 - timerPct / 100)}`}
                  strokeLinecap="round" transform="rotate(-90 20 20)"
                  style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.5s' }}
                />
              </svg>
              <span className="timer-num">{timeLeft}</span>
            </div>
            <button className="btn-end" onClick={handleEnd}>End</button>
          </div>

          {/* Messages */}
          <div className="messages">
            {messages.map((msg, i) => (
              <div key={i} className={`msg msg-${msg.sender}`}>
                <span className="msg-label">{msg.sender === 'ai' ? 'Cosmo' : 'You'}</span>
                <p className="msg-text">{msg.text}</p>
              </div>
            ))}
            {(isListening || liveText) && (
              <div className={`msg msg-you msg-live ${liveText === 'Transcribing\u2026' ? 'msg-transcribing' : ''}`}>
                <span className="msg-label">You</span>
                <p className="msg-text">{liveText || 'Recording\u2026'}</p>
              </div>
            )}
            {isProcessing && !isListening && (
              <div className="msg msg-ai">
                <span className="msg-label">Cosmo</span>
                <p className="msg-text thinking-dots"><span/><span/><span/></p>
              </div>
            )}
            <div ref={messagesEndRef}/>
          </div>

          {sttError && <p className="stt-error">{sttError}</p>}

          {/* Input row */}
          <div className="input-row">
            {sttAvailable && (
              <div className={`mic-btn ${isListening ? 'mic-active' : ''}`} title="Hold Space to speak">
                <MicIcon active={isListening}/>
              </div>
            )}
            <input
              ref={inputRef}
              className="text-input"
              type="text"
              placeholder={sttAvailable ? 'Or type here…' : 'Type your answer…'}
              value={userInput}
              onChange={e => setUserInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendTyped(); } }}
              disabled={isListening || isProcessing || isSpeaking}
            />
            <button
              className="btn-send"
              onClick={sendTyped}
              disabled={!userInput.trim() || isListening || isProcessing || isSpeaking}
            >Send</button>
          </div>
        </>
      )}
    </div>
  );
}

function MicIcon({ active }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
      stroke={active ? '#ef4444' : '#9ca3af'} strokeWidth="2"
      strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3"/>
      <path d="M5 10a7 7 0 0 0 14 0"/>
      <line x1="12" y1="19" x2="12" y2="22"/>
      <line x1="9" y1="22" x2="15" y2="22"/>
    </svg>
  );
}

export default VoiceControls;

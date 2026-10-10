import { useState, useEffect, useCallback } from 'react';

// Tarayıcı uyumluluğu için
const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

export function useVoice() {
  const [isListening, setIsListening] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recognition, setRecognition] = useState<any>(null);

  // STT Init
  useEffect(() => {
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = 'tr-TR'; // Türkçe
      setRecognition(rec);
    }
  }, []);

  const startListening = useCallback((onResult: (text: string, isFinal: boolean) => void) => {
    if (!recognition) {
      alert("Tarayıcınız ses tanıma özelliğini desteklemiyor.");
      return;
    }
    
    setIsListening(true);
    recognition.start();

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      onResult(finalTranscript || interimTranscript, !!finalTranscript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }, [recognition]);

  const stopListening = useCallback(() => {
    if (recognition) {
      recognition.stop();
      setIsListening(false);
    }
  }, [recognition]);

  // TTS Init
  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) {
      alert("Tarayıcınız metin okuma özelliğini desteklemiyor.");
      return;
    }

    // Eğer halihazırda konuşuyorsa iptal et
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'tr-TR'; // Türkçe
    utterance.rate = 1.0;     // Normal hız
    utterance.pitch = 1.0;    // Normal ton

    // Türkçe ses bulmaya çalış
    const voices = window.speechSynthesis.getVoices();
    const trVoice = voices.find(v => v.lang.includes('tr'));
    if (trVoice) {
      utterance.voice = trVoice;
    }

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = useCallback(() => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
    }
  }, []);

  return {
    isListening,
    isPlaying,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
    hasSupport: !!SpeechRecognition
  };
}

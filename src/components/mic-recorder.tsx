import * as React from 'react';
import { TranslationBundle } from '@jupyterlab/translation';

// Global references for Whisper to prevent multi-downloads and re-compilation
let globalTranscriber: any = null;

const loadWhisper = async (onProgress: (progress: number, status: string) => void): Promise<any> => {
  if (globalTranscriber) {
    return globalTranscriber;
  }

  onProgress(0, 'Loading Transformers library...');
  
  // Dynamic import with webpackIgnore comment and variable bypass to completely satisfy the TS compiler and bundler
  const cdnUrl = 'https://esm.sh/@xenova/transformers@2.17.2';
  const transformers: any = await import(/* webpackIgnore: true */ cdnUrl as any);
  
  // Disable local models looking so it fetches cleanly from HuggingFace
  transformers.env.allowLocalModels = false;

  onProgress(10, 'Downloading Whisper model (75MB)...');
  
  globalTranscriber = await transformers.pipeline(
    'automatic-speech-recognition',
    'Xenova/whisper-tiny.en',
    {
      progress_callback: (data: any) => {
        if (data.status === 'progress') {
          const progressVal = Math.round(data.progress);
          const filename = data.file ? data.file.split('/').pop() : '';
          onProgress(progressVal, `Downloading model weights: ${filename}`);
        } else if (data.status === 'ready') {
          onProgress(100, 'Whisper model is ready!');
        }
      }
    }
  );

  return globalTranscriber;
};

const transcribeAudio = async (audioBlob: Blob): Promise<string> => {
  if (!globalTranscriber) {
    throw new Error('Whisper transcriber not loaded');
  }

  // Convert blob to array buffer
  const arrayBuffer = await audioBlob.arrayBuffer();

  // Create AudioContext to decode and resample the audio to 16kHz float32 data
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  const audioCtx = new AudioContextClass({ sampleRate: 16000 });
  const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  const float32Data = audioBuffer.getChannelData(0);

  // Run the Whisper transcriber pipeline
  const response = await globalTranscriber(float32Data, {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: false
  });

  let text = response.text || '';
  
  // Clean Whisper placeholder output
  text = text.replace(/\[BLANK_AUDIO\]/gi, '');
  text = text.replace(/\s+/g, ' ').trim();

  return text;
};

export interface IMicRecorderProps {
  /**
   * The active mode: 'voice' to record audio, or 'dictation' for speech-to-text.
   */
  mode: 'voice' | 'dictation';
  /**
   * Callback triggered when speech is transcribed (dictation mode).
   */
  onTranscription?: (text: string) => void;
  /**
   * Callback triggered when audio recording is finalized (voice mode).
   */
  onAudioRecorded?: (blob: Blob) => void;
  /**
   * Callback triggered when user cancels recording.
   */
  onCancel: () => void;
  /**
   * Callback triggered when dictation is done (dictation mode).
   */
  onDone?: () => void;
  /**
   * The translation bundle.
   */
  trans: TranslationBundle;
}

export const MicRecorder: React.FC<IMicRecorderProps> = ({
  mode,
  onTranscription,
  onAudioRecorded,
  onCancel,
  onDone,
  trans
}) => {
  const [seconds, setSeconds] = React.useState(0);

  // Whisper engine states
  const [whisperEnabled, setWhisperEnabled] = React.useState(() => {
    return localStorage.getItem('jp-ai-use-whisper') === 'true';
  });
  const [downloadProgress, setDownloadProgress] = React.useState<number | null>(null);
  const [downloadStatus, setDownloadStatus] = React.useState<string>('');
  const [isWhisperLoading, setIsWhisperLoading] = React.useState(false);
  const [isTranscribing, setIsTranscribing] = React.useState(false);

  // Refs for MediaRecorder (Voice Memo Mode)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const streamRef = React.useRef<MediaStream | null>(null);
  const timerIntervalRef = React.useRef<number | null>(null);

  // Refs for SpeechRecognition (Dictation Mode)
  const speechRecognitionRef = React.useRef<any>(null);

  const isCapturingRef = React.useRef(false);
  const barRefs = React.useRef<HTMLDivElement[]>([]);
  const audioContextRef = React.useRef<AudioContext | null>(null);

  // Helper to format seconds into mm:ss
  const formatTime = (secs: number): string => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Start recording/dictating when mounted
  React.useEffect(() => {
    startCapture();

    return () => {
      stopAllCapture();
    };
  }, [mode, whisperEnabled]);

  // Hoisted capture control functions to prevent temporal dead zone and compile errors
  async function startCapture() {
    stopAllCapture();
    setSeconds(0);
    isCapturingRef.current = true;

    if (mode === 'voice' || (mode === 'dictation' && whisperEnabled)) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;
        audioChunksRef.current = [];

        // Set up real-time audio visualizer
        try {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          const audioCtx = new AudioContextClass();
          audioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 32;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          let lastTimestamp = 0;
          const throttleMs = 100; // 10 FPS
          const updateVisualizer = (timestamp: number) => {
            if (!isCapturingRef.current) {
              return;
            }
            requestAnimationFrame(updateVisualizer);

            if (timestamp - lastTimestamp < throttleMs) {
              return;
            }
            lastTimestamp = timestamp;

            analyser.getByteFrequencyData(dataArray);

            // Animate our 8 bar elements in real-time
            for (let i = 0; i < 8; i++) {
              const bar = barRefs.current[i];
              if (bar) {
                const value = dataArray[i] || 0;
                // Scale value between 15% and 100% height
                const heightPercent = Math.min(Math.max((value / 255) * 100, 15), 100);
                bar.style.height = `${heightPercent}%`;
              }
            }
          };
          requestAnimationFrame(updateVisualizer);
        } catch (visErr) {
          console.warn('Failed to initialize live visualizer:', visErr);
        }

        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
          if (mode === 'dictation' && whisperEnabled) {
            setIsTranscribing(true);
            try {
              // Ensure Whisper is loaded (should be instant and cached)
              await loadWhisper(() => {});
              const text = await transcribeAudio(audioBlob);
              if (onTranscription && text.trim()) {
                onTranscription(text);
              }
            } catch (err) {
              console.error('Whisper transcription failed:', err);
              alert(trans.__('Local Whisper transcription failed.'));
            } finally {
              setIsTranscribing(false);
              if (onDone) {
                onDone();
              }
            }
          } else {
            if (onAudioRecorded) {
              onAudioRecorded(audioBlob);
            }
          }
        };

        // Start recording
        mediaRecorder.start(250); // Get chunks every 250ms

        // Start timer
        timerIntervalRef.current = window.setInterval(() => {
          setSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Failed to capture audio stream:', err);
        alert(trans.__('Microphone access denied or not available.'));
        onCancel();
      }
    } else {
      // Dictation Mode (Speech to Text)
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (!SpeechRecognition) {
        // If not supported (e.g. Firefox), suggest Whisper automatically
        const wantWhisper = confirm(
          trans.__(
            'Speech recognition is not supported in this browser. Would you like to download and enable local accurate Whisper dictation (~75MB)?'
          )
        );
        if (wantWhisper) {
          handleWhisperToggle();
          return;
        }
        alert(trans.__('Speech recognition is not supported in this browser. Please enable Whisper or use a supported browser like Chrome.'));
        onCancel();
        return;
      }

      try {
        const recognition = new SpeechRecognition();
        speechRecognitionRef.current = recognition;
        recognition.continuous = true;
        recognition.interimResults = true;

        recognition.onresult = (event: any) => {
          let text = '';
          for (let i = 0; i < event.results.length; ++i) {
            text += event.results[i][0].transcript;
          }
          if (onTranscription && text.trim()) {
            onTranscription(text);
          }
        };

        recognition.onerror = (event: any) => {
          console.error('Speech recognition error:', event.error);
          if (event.error === 'not-allowed') {
            alert(trans.__('Microphone access denied.'));
            onCancel();
          }
        };

        recognition.onend = () => {
          // Restart if it terminates automatically but we are still recording
          if (isCapturingRef.current && speechRecognitionRef.current) {
            try {
              speechRecognitionRef.current.start();
            } catch (e) {
              // Ignore already started errors
            }
          }
        };

        recognition.start();

        // Start timer
        timerIntervalRef.current = window.setInterval(() => {
          setSeconds((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Failed to start speech recognition:', err);
        onCancel();
      }
    }
  }

  async function handleWhisperToggle() {
    if (whisperEnabled) {
      // Disable
      stopAllCapture();
      localStorage.setItem('jp-ai-use-whisper', 'false');
      setWhisperEnabled(false);
    } else {
      // Enable & Download Whisper
      stopAllCapture();
      setIsWhisperLoading(true);
      setDownloadProgress(0);
      setDownloadStatus(trans.__('Initializing local Whisper...'));

      try {
        await loadWhisper((progress, status) => {
          setDownloadProgress(progress);
          setDownloadStatus(trans.__(status));
        });

        localStorage.setItem('jp-ai-use-whisper', 'true');
        setWhisperEnabled(true);
      } catch (err) {
        console.error('Failed to download local Whisper:', err);
        alert(trans.__('Failed to download Whisper model.'));
      } finally {
        setIsWhisperLoading(false);
      }
    }
  }

  function stopAllCapture() {
    isCapturingRef.current = false;

    // Clear timer
    if (timerIntervalRef.current) {
      window.clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Stop and close AudioContext
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }
      } catch (e) {
        console.warn('Failed to close AudioContext:', e);
      }
      audioContextRef.current = null;
    }

    // Stop MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Ignore inactive errors
      }
      mediaRecorderRef.current = null;
    }

    // Stop all audio stream tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    // Stop Speech Recognition
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onend = null;
      try {
        speechRecognitionRef.current.stop();
      } catch (e) {
        // Ignore errors
      }
      speechRecognitionRef.current = null;
    }
  }

  function handleDone() {
    stopAllCapture();
    if (onDone) {
      onDone();
    }
  }

  function handleCancelClick() {
    stopAllCapture();
    onCancel();
  }

  return (
    <div className="jp-ai-inline-recorder" style={{ position: 'relative', width: '100%', height: '100%', minHeight: '34px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      {isWhisperLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%', gap: '4px', padding: '2px 8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', fontSize: '10px', fontWeight: 600, color: 'var(--jp-ui-font-color1)' }}>
            <span>{downloadStatus}</span>
            <span>{downloadProgress}%</span>
          </div>
          <div style={{ width: '100%', height: '4px', backgroundColor: 'var(--jp-border-color2)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: `${downloadProgress}%`, height: '100%', backgroundColor: 'var(--jp-brand-color1)', borderRadius: '2px', transition: 'width 0.15s ease' }} />
          </div>
        </div>
      ) : isTranscribing ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', gap: '8px', padding: '4px 0' }}>
          <div className="jp-ai-audio-play-btn jp-ai-mic-pulse" style={{ width: '16px', height: '16px', animationDuration: '1.2s' }} />
          <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--jp-brand-color1)' }}>
            {trans.__('Whisper is transcribing your voice...')}
          </span>
        </div>
      ) : (
        <>
          <div className="jp-ai-recorder-status">
            <button
              className="jp-ai-audio-play-btn jp-ai-mic-pulse"
              style={{ width: '28px', height: '28px', animationDuration: '1.2s' }}
              type="button"
              disabled
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
              </svg>
            </button>
            <span className="jp-ai-recorder-timer">
              {formatTime(seconds)}
            </span>
          </div>

          {/* Modern Waveform Visualizer */}
          <div className="jp-ai-wave-container" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {[...Array(8)].map((_, i) => (
              <div
                key={i}
                className={`jp-ai-wave-bar${mode === 'dictation' && !whisperEnabled ? ' jp-ai-animating' : ''}`}
                ref={(el) => {
                  if (el) {
                    barRefs.current[i] = el;
                  }
                }}
              />
            ))}

            {mode === 'dictation' && (
              <button
                className="jp-ai-whisper-toggle"
                onClick={handleWhisperToggle}
                type="button"
                title={trans.__('Toggle highly-accurate local Whisper dictation')}
                style={{
                  background: whisperEnabled ? 'var(--jp-brand-color1)' : 'var(--jp-layout-color2)',
                  color: whisperEnabled ? 'white' : 'var(--jp-ui-font-color1)',
                  border: '1px solid var(--jp-border-color1)',
                  borderRadius: '10px',
                  fontSize: '9px',
                  fontWeight: 600,
                  padding: '2px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                  height: '18px',
                  lineHeight: '1',
                  boxShadow: whisperEnabled ? '0 1px 3px rgba(0,0,0,0.15)' : 'none',
                  marginLeft: '4px',
                  opacity: 0.85,
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap',
                  outline: 'none'
                }}
              >
                <span>{whisperEnabled ? 'Whisper: ON' : 'Whisper: OFF'}</span>
              </button>
            )}
          </div>

          {/* Done & Cancel buttons */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="jp-ai-approval-btn jp-ai-approval-reject"
              onClick={handleCancelClick}
              title={trans.__('Cancel')}
              style={{ padding: '4px 8px', minWidth: '40px', display: 'flex', alignItems: 'center' }}
              type="button"
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
              </svg>
            </button>
            <button
              className="jp-ai-approval-btn jp-ai-approval-approve"
              onClick={handleDone}
              title={trans.__('Done')}
              style={{ padding: '4px 8px', minWidth: '40px', display: 'flex', alignItems: 'center' }}
              type="button"
            >
              <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ width: '16px', height: '16px', fill: 'currentColor' }}>
                <path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" />
              </svg>
            </button>
          </div>
        </>
      )}
    </div>
  );
};

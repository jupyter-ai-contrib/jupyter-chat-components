import * as React from 'react';
import { PageConfig, URLExt } from '@jupyterlab/coreutils';
import { TranslationBundle } from '@jupyterlab/translation';

export interface IAudioPlayerProps {
  /**
   * The path of the audio file in the workspace.
   */
  path: string;
  /**
   * Optional duration of the audio recording in seconds.
   */
  duration?: number;
  /**
   * The translation bundle.
   */
  trans: TranslationBundle;
}

export const AudioPlayer: React.FC<IAudioPlayerProps> = ({
  path,
  duration: initialDuration,
  trans
}) => {
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(initialDuration || 0);
  const [playbackRate, setPlaybackRate] = React.useState(1.0);

  const audioRef = React.useRef<HTMLAudioElement | null>(null);

  // Build static URL to fetch/stream the audio file from Jupyter Server
  const fileUrl = path.startsWith('data:')
    ? path
    : URLExt.join(PageConfig.getBaseUrl(), 'files', path);

  React.useEffect(() => {
    const audio = new Audio(fileUrl);
    audioRef.current = audio;
    audio.playbackRate = playbackRate;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const onDurationChange = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    // Event listeners
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('durationchange', onDurationChange);

    // Initial check if loaded metadata happened immediately
    if (audio.duration && !isNaN(audio.duration)) {
      setDuration(audio.duration);
    }

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('durationchange', onDurationChange);
      audioRef.current = null;
    };
  }, [fileUrl]);

  // Sync playback rate when state changes
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  const togglePlay = () => {
    if (!audioRef.current) {
      return;
    }
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.error('Playback failed:', err);
      });
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
  };

  const cycleSpeed = () => {
    const nextRates: { [key: number]: number } = {
      1.0: 1.5,
      1.5: 2.0,
      2.0: 1.0
    };
    setPlaybackRate(prev => nextRates[prev] || 1.0);
  };

  // Helper to format seconds into mm:ss
  const formatTime = (secs: number): string => {
    if (isNaN(secs) || secs === Infinity) {
      return '00:00';
    }
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Waveform heights for premium aesthetic representation
  const waveHeights = [8, 12, 6, 14, 10, 16, 8, 12, 14, 8, 10, 12, 16, 6, 10, 14, 8, 12, 6, 8];
  const progressPercent = duration ? (currentTime / duration) * 100 : 0;

  return (
    <div className="jp-ai-audio-player">
      <button
        className="jp-ai-audio-play-btn"
        onClick={togglePlay}
        title={isPlaying ? trans.__('Pause') : trans.__('Play')}
        type="button"
      >
        {isPlaying ? (
          // Pause Icon
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
          </svg>
        ) : (
          // Play Icon
          <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
      </button>

      <div className="jp-ai-audio-controls">
        {/* Dynamic Interactive Waveform SVG */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
          <svg viewBox="0 0 100 20" style={{ width: '120px', height: '18px' }} xmlns="http://www.w3.org/2000/svg">
            {waveHeights.map((h, i) => {
              const isActive = progressPercent >= (i / waveHeights.length) * 100;
              const xPos = i * 5 + 1;
              const yPos = (20 - h) / 2;
              return (
                <rect
                  key={i}
                  x={xPos}
                  y={yPos}
                  width="3"
                  height={h}
                  rx="1.5"
                  fill={isActive ? 'var(--jp-brand-color1, #2196F3)' : 'var(--jp-border-color2, #ccc)'}
                  style={{ transition: 'fill 0.15s ease' }}
                />
              );
            })}
          </svg>
          <button
            className="jp-ai-audio-speed"
            onClick={cycleSpeed}
            title={trans.__('Playback Speed')}
            type="button"
          >
            {playbackRate}x
          </button>
        </div>

        <div className="jp-ai-audio-slider-container">
          <input
            className="jp-ai-audio-slider"
            max={duration || 100}
            min={0}
            onChange={handleScrub}
            step={0.1}
            type="range"
            value={currentTime}
          />
        </div>

        <div className="jp-ai-audio-info">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
};

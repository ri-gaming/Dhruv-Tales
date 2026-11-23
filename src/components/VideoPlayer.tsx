import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Headphones,
  Loader2,
  Maximize,
  Minimize,
  Pause,
  PictureInPicture2,
  Play,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { PLAYBACK_SPEEDS, useAudioPlayer } from '../hooks/useAudioPlayer';
import { useLanguage } from '../hooks/useLanguage';
import { formatDuration } from '../services/access/episodeAccess';

interface VideoPlayerProps {
  /** Whether the full expanded player dialog is currently visible */
  isExpandedView?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ isExpandedView = true }) => {
  const compact = !isExpandedView;
  const { t } = useLanguage();
  const {
    currentStory,
    currentEpisode,
    activeVideoUrl,
    canSwitchFormat,
    isPlaying,
    isLoadingMedia,
    currentTime,
    duration,
    playbackRate,
    volume,
    isMuted,
    videoError,
    activeChoicePoint,
    attachVideoElement,
    togglePlayPause,
    seekTo,
    skipBy,
    setPlaybackRate,
    setVolume,
    toggleMute,
    switchFormat,
    retryVideoLoad,
    setIsExpanded,
  } = useAudioPlayer();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const [controlsVisible, setControlsVisible] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPiPActive, setIsPiPActive] = useState(false);

  const supportsPiP =
    typeof document !== 'undefined' &&
    'pictureInPictureEnabled' in document &&
    Boolean(document.pictureInPictureEnabled);

  const handleVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      localVideoRef.current = el;
      attachVideoElement(el);
    },
    [attachVideoElement]
  );

  const scheduleHideControls = useCallback(() => {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
    }
    setControlsVisible(true);
    if (isPlaying && !activeChoicePoint && !videoError) {
      hideTimerRef.current = window.setTimeout(() => {
        setControlsVisible(false);
      }, 3000);
    }
  }, [isPlaying, activeChoicePoint, videoError]);

  useEffect(() => {
    if (!isPlaying || activeChoicePoint || videoError) {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
      setControlsVisible(true);
    } else {
      scheduleHideControls();
    }
    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [isPlaying, activeChoicePoint, videoError, scheduleHideControls]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (container.requestFullscreen) {
        await container.requestFullscreen();
      }
    } catch {
      // Fullscreen may be restricted in embedded iframes
    }
  }, []);

  const togglePiP = useCallback(async () => {
    const video = localVideoRef.current;
    if (!video || !supportsPiP) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (typeof video.requestPictureInPicture === 'function') {
        await video.requestPictureInPicture();
      }
    } catch {
      // PiP may be blocked until user gesture or unsupported by stream
    }
  }, [supportsPiP]);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  useEffect(() => {
    const video = localVideoRef.current;
    if (!video) return;
    const onEnterPiP = () => setIsPiPActive(true);
    const onLeavePiP = () => setIsPiPActive(false);
    video.addEventListener('enterpictureinpicture', onEnterPiP);
    video.addEventListener('leavepictureinpicture', onLeavePiP);
    return () => {
      video.removeEventListener('enterpictureinpicture', onEnterPiP);
      video.removeEventListener('leavepictureinpicture', onLeavePiP);
    };
  }, [activeVideoUrl]);

  // Keyboard shortcuts when video player is expanded: Space, Left/Right arrows, F
  useEffect(() => {
    if (compact || activeChoicePoint) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        scheduleHideControls();
        void togglePlayPause();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        scheduleHideControls();
        skipBy(-15);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        scheduleHideControls();
        skipBy(15);
      } else if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        scheduleHideControls();
        void toggleFullscreen();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [compact, activeChoicePoint, scheduleHideControls, togglePlayPause, skipBy, toggleFullscreen]);

  const safeDuration = Math.max(1, duration || currentEpisode?.durationSec || 40);
  const progressPct = Math.min(100, (currentTime / safeDuration) * 100);

  return (
    <div
      ref={containerRef}
      onMouseMove={!compact ? scheduleHideControls : undefined}
      onTouchStart={!compact ? scheduleHideControls : undefined}
      onFocus={!compact ? scheduleHideControls : undefined}
      onMouseLeave={() => {
        if (!compact && isPlaying && !activeChoicePoint) {
          setControlsVisible(false);
        }
      }}
      className={
        compact
          ? 'relative w-16 h-11 rounded-lg overflow-hidden bg-black border border-white/15 shrink-0 cursor-pointer'
          : 'relative w-full aspect-video rounded-2xl overflow-hidden bg-black border border-white/10 shadow-2xl shadow-black/70 select-none group'
      }
      onClick={compact ? () => setIsExpanded(true) : undefined}
    >
      <video
        ref={handleVideoRef}
        src={activeVideoUrl ?? undefined}
        poster={currentStory?.backdropUrl || currentStory?.coverUrl}
        playsInline
        preload="metadata"
        onClick={
          !compact
            ? () => {
                scheduleHideControls();
                void togglePlayPause();
              }
            : undefined
        }
        className="w-full h-full object-contain bg-black"
        aria-label={currentEpisode ? `${currentEpisode.title} video player` : 'Video player'}
      />

      {/* Loading Spinner */}
      {isLoadingMedia && !videoError && (
        <div
          aria-live="polite"
          className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 backdrop-blur-[2px] pointer-events-none"
        >
          <Loader2
            className={`${compact ? 'w-4 h-4' : 'w-9 h-9'} text-[#E5A93C] animate-spin`}
            aria-hidden="true"
          />
          {!compact && (
            <span className="mt-2.5 text-xs font-medium text-[#F5F3EE]">
              {t('video.loading')}
            </span>
          )}
        </div>
      )}

      {/* Clean Error State with Retry & Switch to Audio */}
      {videoError && !compact && (
        <div
          role="alert"
          className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B0B0E]/92 p-6 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-300">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-semibold text-[#F5F3EE]">{t('video.errorTitle')}</h3>
            <p className="text-xs text-[#A39E93] leading-relaxed">{videoError}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => void retryVideoLoad()}
              className="min-h-[40px] px-4 rounded-xl bg-[#E5A93C] text-[#0B0B0E] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[#F3C669] transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              {t('video.retry')}
            </button>
            {canSwitchFormat && (
              <button
                type="button"
                onClick={() => void switchFormat('audio')}
                className="min-h-[40px] px-4 rounded-xl bg-[#1C1C22] border border-white/15 text-[#F5F3EE] text-xs font-medium inline-flex items-center gap-1.5 hover:border-[#E5A93C]/50 transition-colors"
              >
                <Headphones className="w-3.5 h-3.5 text-[#E5A93C]" aria-hidden="true" />
                {t('video.switchToAudio')}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Auto-Hiding Full Video Controls Overlay */}
      {!compact && !videoError && (
        <div
          className={`absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/55 to-transparent px-3 sm:px-5 pt-12 pb-3 sm:pb-4 transition-opacity duration-300 ${
            controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {/* Seek Bar */}
          <div className="mb-2.5">
            <label htmlFor="video-player-seek" className="sr-only">
              Seek video playback
            </label>
            <input
              id="video-player-seek"
              type="range"
              min={0}
              max={safeDuration}
              step={0.5}
              value={Math.min(safeDuration, currentTime)}
              onChange={(e) => seekTo(Number(e.target.value))}
              className="dt-range w-full"
              style={{
                background: `linear-gradient(to right, #E5A93C ${progressPct}%, rgba(255,255,255,0.22) ${progressPct}%)`,
              }}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            {/* Left Transport & Volume */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => void togglePlayPause()}
                aria-label={isPlaying ? t('player.pause') : t('player.play')}
                className="min-w-[38px] min-h-[38px] rounded-lg bg-[#E5A93C] text-[#0B0B0E] hover:bg-[#F3C669] flex items-center justify-center transition-colors"
              >
                {isPlaying ? (
                  <Pause className="w-4 h-4 fill-current" />
                ) : (
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={() => skipBy(-15)}
                aria-label={t('player.skipBack')}
                className="min-w-[36px] min-h-[36px] rounded-lg text-[#F5F3EE]/90 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => skipBy(15)}
                aria-label={t('player.skipForward')}
                className="min-w-[36px] min-h-[36px] rounded-lg text-[#F5F3EE]/90 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <RotateCw className="w-4 h-4" />
              </button>

              {/* Volume */}
              <div className="flex items-center gap-1.5 ml-1">
                <button
                  type="button"
                  onClick={toggleMute}
                  aria-label={isMuted ? t('video.unmute') : t('video.mute')}
                  className="min-w-[34px] min-h-[34px] rounded-lg text-[#F5F3EE]/90 hover:bg-white/10 flex items-center justify-center transition-colors"
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4" />
                  ) : (
                    <Volume2 className="w-4 h-4" />
                  )}
                </button>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={isMuted ? 0 : volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  aria-label={t('video.volume')}
                  className="hidden sm:block w-16 accent-[#E5A93C] cursor-pointer"
                />
              </div>

              <span className="text-[11px] font-mono-tabular text-[#F5F3EE]/90 ml-1 whitespace-nowrap">
                {formatDuration(currentTime)} / {formatDuration(safeDuration)}
              </span>
            </div>

            {/* Right Speed, PiP, Fullscreen */}
            <div className="flex items-center gap-1.5">
              <label htmlFor="video-speed-select" className="sr-only">
                {t('player.speed')}
              </label>
              <select
                id="video-speed-select"
                value={playbackRate}
                onChange={(e) => setPlaybackRate(Number(e.target.value))}
                className="h-8 px-2 rounded-lg bg-black/70 border border-white/15 text-[11px] font-mono-tabular text-[#F5F3EE] focus:outline-none focus:border-[#E5A93C]"
              >
                {PLAYBACK_SPEEDS.map((spd) => (
                  <option key={spd} value={spd}>
                    {spd}x
                  </option>
                ))}
              </select>

              {supportsPiP && (
                <button
                  type="button"
                  onClick={() => void togglePiP()}
                  aria-label={t('video.pip')}
                  aria-pressed={isPiPActive}
                  className={`min-w-[34px] min-h-[34px] rounded-lg flex items-center justify-center transition-colors ${
                    isPiPActive
                      ? 'bg-[#E5A93C]/25 text-[#F3C669]'
                      : 'text-[#F5F3EE]/90 hover:bg-white/10'
                  }`}
                >
                  <PictureInPicture2 className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => void toggleFullscreen()}
                aria-label={isFullscreen ? t('video.exitFullscreen') : t('video.fullscreen')}
                className="min-w-[34px] min-h-[34px] rounded-lg text-[#F5F3EE]/90 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                {isFullscreen ? (
                  <Minimize className="w-4 h-4" />
                ) : (
                  <Maximize className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <p className="hidden md:block text-[10px] text-white/50 mt-2">
            {t('video.shortcutsHint')}
          </p>
        </div>
      )}
    </div>
  );
};

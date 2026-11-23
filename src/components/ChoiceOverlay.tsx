import React, { useEffect } from 'react';
import { ArrowRight, RotateCcw, Sparkles } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import type { EpisodeChoicePoint, InteractiveChoiceOption } from '../types';

interface ChoiceOverlayProps {
  choicePoint: EpisodeChoicePoint;
  onSelectOption: (option: InteractiveChoiceOption) => void;
  onRewind: () => void;
}

/**
 * Countdown-free, no-pressure interactive story choice overlay.
 * Pauses playback cleanly and illuminates glowing option cards.
 */
export const ChoiceOverlay: React.FC<ChoiceOverlayProps> = ({
  choicePoint,
  onSelectOption,
  onRewind,
}) => {
  const { lang, t } = useLanguage();

  // Keyboard shortcuts 1, 2, 3 to pick a branch comfortably
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const idx = Number(e.key) - 1;
      if (idx >= 0 && idx < choicePoint.options.length) {
        e.preventDefault();
        onSelectOption(choicePoint.options[idx]);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [choicePoint, onSelectOption]);

  const promptText = lang === 'hi' ? choicePoint.promptHi : choicePoint.promptEn;

  return (
    <div
      role="region"
      aria-label={t('interactive.choiceMoment')}
      data-testid="choice-overlay"
      className="relative rounded-2xl bg-[#111116]/95 border border-[#E5A93C]/45 p-5 sm:p-7 shadow-[0_0_50px_-12px_rgba(229,169,60,0.4)] space-y-6 overflow-hidden"
    >
      {/* Subtle warm radial constellation glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-48 rounded-full bg-[#E5A93C]/15 blur-3xl"
      />

      <div className="relative space-y-2 text-center max-w-xl mx-auto">
        <p className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E5A93C] tracking-wide">
          <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
          {t('interactive.choiceMoment')}
        </p>
        <h3 className="font-display text-xl sm:text-2xl font-semibold text-[#F5F3EE] leading-snug text-balance">
          {promptText}
        </h3>
        <p className="text-xs text-[#A39E93]">{t('interactive.noPressureNote')}</p>
      </div>

      {/* Glowing Option Cards */}
      <div
        className={`relative grid gap-3 ${
          choicePoint.options.length === 3 ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {choicePoint.options.map((opt, idx) => {
          const label = lang === 'hi' ? opt.labelHi : opt.labelEn;
          const tagline = lang === 'hi' ? opt.taglineHi : opt.taglineEn;

          return (
            <button
              key={opt.id}
              type="button"
              data-testid={`choice-option-${opt.id}`}
              onClick={() => onSelectOption(opt)}
              className="group relative text-left rounded-xl p-4 sm:p-5 bg-[#17171E] border border-[#E5A93C]/30 hover:border-[#F3C669] hover:bg-[#1E1C19] shadow-[0_0_24px_-10px_rgba(229,169,60,0.45)] hover:shadow-[0_0_32px_-6px_rgba(243,198,105,0.65)] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E5A93C] flex flex-col justify-between gap-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono-tabular text-[11px] font-semibold text-[#E5A93C]">
                    {t('interactive.pathLabel')} 0{idx + 1}
                  </span>
                  <ArrowRight
                    className="w-4 h-4 text-[#E5A93C] opacity-70 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                    aria-hidden="true"
                  />
                </div>
                <p className="font-display text-base sm:text-lg font-semibold text-[#F5F3EE] group-hover:text-[#F3C669] transition-colors leading-snug">
                  {label}
                </p>
                {tagline && (
                  <p className="text-xs text-[#A39E93] leading-relaxed">{tagline}</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Calm Rewind option */}
      <div className="relative flex items-center justify-center pt-1">
        <button
          type="button"
          onClick={onRewind}
          className="min-h-[38px] px-4 rounded-xl text-xs font-medium text-[#A39E93] hover:text-[#F5F3EE] hover:bg-white/5 inline-flex items-center gap-1.5 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
          {t('interactive.rewindMoment')}
        </button>
      </div>
    </div>
  );
};

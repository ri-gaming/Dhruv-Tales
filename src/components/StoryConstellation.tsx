import React, { useMemo, useState } from 'react';
import { Compass, Play, RotateCcw, Sparkles } from 'lucide-react';
import { useLanguage } from '../hooks/useLanguage';
import { buildConstellationGraph } from '../services/interactive/storyGraph';
import type { Episode, Story, UserChoiceEntry } from '../types';

interface StoryConstellationProps {
  story: Story;
  episodes: Episode[];
  userChoices: UserChoiceEntry[];
  activeEpisodeId?: string | null;
  onPlayEpisode: (episode: Episode) => void;
  onReplayFromChoice: (episode: Episode) => void;
}

export const StoryConstellation: React.FC<StoryConstellationProps> = ({
  story,
  episodes,
  userChoices,
  activeEpisodeId,
  onPlayEpisode,
  onReplayFromChoice,
}) => {
  const { lang, t } = useLanguage();

  const storyChoices = useMemo(
    () => userChoices.filter((c) => c.storyId === story.id),
    [userChoices, story.id]
  );

  const graph = useMemo(
    () => buildConstellationGraph(episodes, storyChoices),
    [episodes, storyChoices]
  );

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  if (graph.nodes.length === 0) return null;

  const nodeMap = new Map(graph.nodes.map((n) => [n.episode.id, n]));
  const focusedNode =
    (selectedNodeId ? nodeMap.get(selectedNodeId) : undefined) ??
    graph.nodes.find((n) => n.isVisited && n.hasChoice && n.chosenOption) ??
    graph.nodes[0];

  const choicesMadeCount = storyChoices.length;
  const reachedEnding = graph.nodes.find((n) => Boolean(n.episode.isEnding) && n.isVisited);

  return (
    <section
      aria-label={t('interactive.constellationHeading')}
      data-testid="story-constellation"
      className="rounded-2xl bg-[#111116] border border-white/[0.08] p-5 sm:p-6 space-y-5 overflow-hidden"
    >
      {/* Section Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-xs font-medium text-[#E5A93C] inline-flex items-center gap-1.5">
            <Compass className="w-3.5 h-3.5" aria-hidden="true" />
            {t('interactive.constellationLabel')}
          </p>
          <h2 className="font-display text-2xl font-semibold text-[#F5F3EE]">
            {t('interactive.constellationHeading')}
          </h2>
          <p className="text-xs text-[#A39E93] max-w-2xl leading-relaxed">
            {t('interactive.constellationSubtitle')}
          </p>
        </div>

        <div className="text-xs text-[#A39E93] tabular-nums space-y-1 sm:text-right">
          <p>
            {t('interactive.choicesRecorded')}:{' '}
            <strong className="text-[#E5A93C]" data-testid="constellation-choices-count">
              {choicesMadeCount}
            </strong>
          </p>
          {reachedEnding && (
            <p className="text-[#F3C669] inline-flex items-center gap-1" data-testid="constellation-ending-reached">
              <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />
              {lang === 'hi' ? reachedEnding.episode.titleHi : reachedEnding.episode.title}
            </p>
          )}
        </div>
      </div>

      {/* Interactive SVG Star-Map */}
      <div className="relative rounded-xl bg-[#0B0B0E] border border-white/[0.07] p-3 sm:p-4 overflow-x-auto">
        <svg
          viewBox="0 0 800 320"
          className="w-full min-w-[540px] h-[250px] sm:h-[290px]"
          role="img"
          aria-label={t('interactive.constellationHeading')}
        >
          <defs>
            <filter id="dt-trail-glow" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="dt-star-bg" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E5A93C" stopOpacity="0.14" />
              <stop offset="100%" stopColor="#0B0B0E" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Ambient celestial backdrop */}
          <rect width="800" height="320" fill="url(#dt-star-bg)" />

          {/* Subtle ambient dust stars */}
          {[
            [62, 44],
            [185, 272],
            [312, 38],
            [448, 286],
            [590, 52],
            [718, 265],
            [240, 155],
            [525, 165],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="1.3" fill="#F5F3EE" opacity="0.22" />
          ))}

          {/* Unchosen edges first */}
          {graph.edges
            .filter((e) => !e.isChosenTrail)
            .map((edge) => {
              const from = nodeMap.get(edge.fromEpisodeId);
              const to = nodeMap.get(edge.toEpisodeId);
              if (!from || !to) return null;
              const x1 = (from.x / 100) * 800;
              const y1 = (from.y / 100) * 320;
              const x2 = (to.x / 100) * 800;
              const y2 = (to.y / 100) * 320;
              const midX = (x1 + x2) / 2;

              return (
                <path
                  key={`${edge.fromEpisodeId}-${edge.toEpisodeId}-${edge.optionId}`}
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke="rgba(255,255,255,0.14)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                />
              );
            })}

          {/* Illuminated user light trail edges */}
          {graph.edges
            .filter((e) => e.isChosenTrail)
            .map((edge) => {
              const from = nodeMap.get(edge.fromEpisodeId);
              const to = nodeMap.get(edge.toEpisodeId);
              if (!from || !to) return null;
              const x1 = (from.x / 100) * 800;
              const y1 = (from.y / 100) * 320;
              const x2 = (to.x / 100) * 800;
              const y2 = (to.y / 100) * 320;
              const midX = (x1 + x2) / 2;

              return (
                <g
                  key={`trail-${edge.fromEpisodeId}-${edge.toEpisodeId}`}
                  data-testid="constellation-light-trail"
                >
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#E5A93C"
                    strokeOpacity="0.35"
                    strokeWidth="6"
                    filter="url(#dt-trail-glow)"
                  />
                  <path
                    d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#F3C669"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

          {/* Constellation Star Nodes */}
          {graph.nodes.map((node) => {
            const cx = (node.x / 100) * 800;
            const cy = (node.y / 100) * 320;
            const isSelected = focusedNode?.episode.id === node.episode.id;
            const isActivePlaying = activeEpisodeId === node.episode.id;
            const isEnding = Boolean(node.episode.isEnding);
            const epLabel = `Ep ${node.episode.episodeNumber}`;

            return (
              <g
                key={node.episode.id}
                role="button"
                tabIndex={0}
                aria-label={`${epLabel}: ${lang === 'hi' ? node.episode.titleHi : node.episode.title}`}
                onClick={() => setSelectedNodeId(node.episode.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedNodeId(node.episode.id);
                  }
                }}
                className="cursor-pointer outline-none"
                data-testid={`constellation-node-${node.episode.id}`}
                data-on-trail={node.isVisited ? 'true' : 'false'}
              >
                {/* Outer aura for illuminated trail or selected node */}
                {(node.isVisited || isSelected || isActivePlaying) && (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 22 : 17}
                    fill={node.isVisited ? '#E5A93C' : '#F5F3EE'}
                    opacity={isSelected ? 0.24 : 0.14}
                    filter="url(#dt-trail-glow)"
                  />
                )}

                {/* Star Circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={isEnding ? 13 : 11}
                  fill={node.isVisited ? '#E5A93C' : '#18181F'}
                  stroke={
                    isSelected
                      ? '#FFFFFF'
                      : node.isVisited
                        ? '#F3C669'
                        : 'rgba(255,255,255,0.28)'
                  }
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />

                {/* Episode Number inside Node */}
                <text
                  x={cx}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fontSize="10"
                  fontWeight="700"
                  fill={node.isVisited ? '#0B0B0E' : '#A39E93'}
                  style={{ fontFamily: 'JetBrains Mono, monospace' }}
                >
                  {node.episode.episodeNumber}
                </text>

                {/* Short Title below Node */}
                <text
                  x={cx}
                  y={cy + 28}
                  textAnchor="middle"
                  fontSize="10.5"
                  fill={node.isVisited ? '#F5F3EE' : '#78736A'}
                  fontWeight={node.isVisited ? '600' : '400'}
                >
                  {isEnding ? `${t('interactive.endingTag')} ${node.episode.episodeNumber}` : epLabel}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Selected Node Inspector & "Replay from this choice" */}
      {focusedNode && (
        <div className="rounded-xl bg-[#18181F] border border-white/[0.08] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-mono-tabular text-[#E5A93C]">
                {t('common.episode')} {focusedNode.episode.episodeNumber}
              </span>
              {focusedNode.isVisited && (
                <>
                  <span aria-hidden="true" className="text-[#78736A]">·</span>
                  <span className="text-[#F3C669]">{t('interactive.onYourPath')}</span>
                </>
              )}
              {focusedNode.episode.isEnding && (
                <>
                  <span aria-hidden="true" className="text-[#78736A]">·</span>
                  <span className="text-emerald-400">{t('interactive.endingTag')}</span>
                </>
              )}
            </div>
            <h3 className="font-display text-lg font-semibold text-[#F5F3EE]">
              {lang === 'hi' ? focusedNode.episode.titleHi : focusedNode.episode.title}
            </h3>
            {focusedNode.chosenOption ? (
              <p className="text-xs text-[#D6D2C9]">
                {t('interactive.yourChoice')}:{' '}
                <strong className="text-[#F3C669]">
                  {lang === 'hi'
                    ? focusedNode.chosenOption.optionLabelHi
                    : focusedNode.chosenOption.optionLabelEn}
                </strong>
              </p>
            ) : (
              <p className="text-xs text-[#A39E93] line-clamp-2">
                {lang === 'hi'
                  ? focusedNode.episode.descriptionHi
                  : focusedNode.episode.description}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {focusedNode.hasChoice && focusedNode.chosenOption && (
              <button
                type="button"
                data-testid={`replay-choice-${focusedNode.episode.id}`}
                onClick={() => onReplayFromChoice(focusedNode.episode)}
                className="min-h-[40px] px-4 rounded-xl bg-[#E5A93C] text-[#0B0B0E] hover:bg-[#F3C669] text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                {t('interactive.replayFromChoice')}
              </button>
            )}

            <button
              type="button"
              onClick={() => onPlayEpisode(focusedNode.episode)}
              className="min-h-[40px] px-4 rounded-xl bg-[#111116] border border-white/15 text-[#F5F3EE] hover:border-[#E5A93C]/50 text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <Play className="w-3.5 h-3.5 fill-current text-[#E5A93C]" aria-hidden="true" />
              {t('interactive.playChapter')}
            </button>
          </div>
        </div>
      )}

      {/* Quick Trail Summary of Decisions Made */}
      {storyChoices.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="text-[11px] font-medium text-[#A39E93]">
            {t('interactive.yourTrailHeading')}
          </p>
          <div className="flex flex-wrap gap-2">
            {graph.nodes
              .filter((n) => n.isVisited && n.chosenOption)
              .map((n) => (
                <div
                  key={n.episode.id}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#18181F] border border-[#E5A93C]/25 px-3 py-2 text-xs"
                >
                  <span className="font-mono-tabular text-[#E5A93C]">
                    Ep {n.episode.episodeNumber}
                  </span>
                  <span className="text-[#F5F3EE] max-w-[200px] truncate">
                    {lang === 'hi'
                      ? n.chosenOption?.optionLabelHi
                      : n.chosenOption?.optionLabelEn}
                  </span>
                  <button
                    type="button"
                    data-testid={`trail-replay-${n.episode.id}`}
                    onClick={() => onReplayFromChoice(n.episode)}
                    className="text-[11px] font-semibold text-[#E5A93C] hover:text-[#F3C669] underline underline-offset-2 whitespace-nowrap ml-1"
                  >
                    {t('interactive.replayShort')}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}
    </section>
  );
};

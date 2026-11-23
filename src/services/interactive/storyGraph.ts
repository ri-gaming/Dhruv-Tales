import type { Episode, MediaRef, PlaybackFormat, UserChoiceEntry } from '../../types';

export interface EpisodeFormatAvailability {
  hasAudio: boolean;
  hasVideo: boolean;
  canSwitch: boolean;
  audioRef: MediaRef | null;
  videoRef: MediaRef | null;
}

/**
 * Inspects an episode's provider-agnostic MediaRefs to determine available formats.
 */
export function getEpisodeFormats(episode: Episode): EpisodeFormatAvailability {
  const audioRef =
    episode.audioRef ?? (episode.mediaRef.type === 'audio' ? episode.mediaRef : null);
  const videoRef =
    episode.videoMediaRef ?? (episode.mediaRef.type === 'video' ? episode.mediaRef : null);
  const hasAudio = Boolean(audioRef);
  const hasVideo = Boolean(videoRef);
  return {
    hasAudio,
    hasVideo,
    canSwitch: hasAudio && hasVideo,
    audioRef,
    videoRef,
  };
}

/**
 * Resolves the effective playback format based on what the episode supports
 * and the user's saved preferredFormat.
 */
export function resolveEffectiveFormat(
  episode: Episode,
  preferredFormat: PlaybackFormat = 'audio'
): PlaybackFormat {
  const { hasAudio, hasVideo } = getEpisodeFormats(episode);
  if (hasAudio && hasVideo) return preferredFormat;
  if (hasVideo) return 'video';
  return 'audio';
}

/**
 * Pure check for whether an episode's interactive choicePoint should trigger now.
 */
export function shouldTriggerChoicePoint(
  episode: Episode,
  currentTime: number,
  duration: number,
  alreadyTriggeredEpisodeId: string | null
): boolean {
  if (!episode.choicePoint || episode.choicePoint.options.length === 0) return false;
  if (alreadyTriggeredEpisodeId === episode.id) return false;

  const { triggerAtSec, triggerAtEnd } = episode.choicePoint;
  if (typeof triggerAtSec === 'number' && triggerAtSec > 0) {
    // Clamp trigger below actual media duration so short sample videos still trigger reliably
    const effectiveTrigger =
      duration > 0 ? Math.min(triggerAtSec, Math.max(2, duration - 1.5)) : triggerAtSec;
    return currentTime >= effectiveTrigger;
  }

  if (triggerAtEnd && duration > 0) {
    return currentTime >= Math.max(1, duration - 0.8);
  }

  return false;
}

export interface ConstellationNode {
  episode: Episode;
  depth: number;
  x: number; // normalized 0..100
  y: number; // normalized 0..100
  isVisited: boolean;
  isCurrentTip: boolean;
  hasChoice: boolean;
  chosenOption?: UserChoiceEntry;
}

export interface ConstellationEdge {
  fromEpisodeId: string;
  toEpisodeId: string;
  optionId: string;
  labelEn: string;
  labelHi: string;
  isChosenTrail: boolean;
}

export interface ConstellationGraph {
  nodes: ConstellationNode[];
  edges: ConstellationEdge[];
  activePathIds: string[];
}

/**
 * Computes a deterministic layered constellation layout for an interactive story
 * and highlights the user's chosen journey as a glowing light trail.
 */
export function buildConstellationGraph(
  episodes: Episode[],
  userChoices: UserChoiceEntry[]
): ConstellationGraph {
  if (episodes.length === 0) {
    return { nodes: [], edges: [], activePathIds: [] };
  }

  const sorted = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber);
  const byId = new Map<string, Episode>();
  sorted.forEach((e) => byId.set(e.id, e));

  const choiceByEpisodeId = new Map<string, UserChoiceEntry>();
  userChoices.forEach((c) => choiceByEpisodeId.set(c.episodeId, c));

  // BFS from Episode 1 to assign topological depth layers
  const depthMap = new Map<string, number>();
  const root = sorted[0];
  depthMap.set(root.id, 0);
  const queue: string[] = [root.id];

  while (queue.length > 0) {
    const currId = queue.shift()!;
    const currDepth = depthMap.get(currId) ?? 0;
    const ep = byId.get(currId);
    if (!ep?.choicePoint) continue;
    for (const opt of ep.choicePoint.options) {
      if (!byId.has(opt.nextEpisodeId)) continue;
      const existingDepth = depthMap.get(opt.nextEpisodeId);
      if (existingDepth === undefined || currDepth + 1 > existingDepth) {
        depthMap.set(opt.nextEpisodeId, currDepth + 1);
        queue.push(opt.nextEpisodeId);
      }
    }
  }

  // Fallback depth for any unlinked episodes
  sorted.forEach((ep, idx) => {
    if (!depthMap.has(ep.id)) {
      depthMap.set(ep.id, Math.min(idx, 3));
    }
  });

  // Trace the user's active light trail from root following saved UserChoiceEntry links
  const activePathIds: string[] = [root.id];
  const chosenEdgeKeys = new Set<string>();
  const visitedGuard = new Set<string>([root.id]);
  let cursorId = root.id;

  while (true) {
    const chosen = choiceByEpisodeId.get(cursorId);
    if (!chosen || !byId.has(chosen.nextEpisodeId) || visitedGuard.has(chosen.nextEpisodeId)) {
      break;
    }
    chosenEdgeKeys.add(`${cursorId}->${chosen.nextEpisodeId}:${chosen.optionId}`);
    activePathIds.push(chosen.nextEpisodeId);
    visitedGuard.add(chosen.nextEpisodeId);
    cursorId = chosen.nextEpisodeId;
  }

  // Group nodes by depth layer to calculate clean horizontal & vertical positions
  const layers = new Map<number, Episode[]>();
  let maxDepth = 0;
  for (const ep of sorted) {
    const d = depthMap.get(ep.id) ?? 0;
    maxDepth = Math.max(maxDepth, d);
    const list = layers.get(d) ?? [];
    list.push(ep);
    layers.set(d, list);
  }

  const activeSet = new Set(activePathIds);
  const currentTipId = activePathIds[activePathIds.length - 1];
  const nodes: ConstellationNode[] = [];

  for (let d = 0; d <= maxDepth; d++) {
    const layerEps = layers.get(d) ?? [];
    const x = maxDepth === 0 ? 50 : 12 + (d / maxDepth) * 76;
    layerEps.forEach((ep, idx) => {
      const y =
        layerEps.length === 1
          ? 50
          : 20 + (idx / (layerEps.length - 1)) * 60;
      nodes.push({
        episode: ep,
        depth: d,
        x,
        y,
        isVisited: activeSet.has(ep.id),
        isCurrentTip: ep.id === currentTipId,
        hasChoice: Boolean(ep.choicePoint && ep.choicePoint.options.length > 0),
        chosenOption: choiceByEpisodeId.get(ep.id),
      });
    });
  }

  const edges: ConstellationEdge[] = [];
  for (const ep of sorted) {
    if (!ep.choicePoint) continue;
    for (const opt of ep.choicePoint.options) {
      if (!byId.has(opt.nextEpisodeId)) continue;
      edges.push({
        fromEpisodeId: ep.id,
        toEpisodeId: opt.nextEpisodeId,
        optionId: opt.id,
        labelEn: opt.labelEn,
        labelHi: opt.labelHi,
        isChosenTrail: chosenEdgeKeys.has(`${ep.id}->${opt.nextEpisodeId}:${opt.id}`),
      });
    }
  }

  return { nodes, edges, activePathIds };
}

/**
 * Returns the IDs of UserChoiceEntry documents that lie at or downstream of
 * `fromEpisodeId` in the user's current trail, so "Replay from this choice"
 * cleanly lets the listener branch anew.
 */
export function getDownstreamChoiceIds(
  fromEpisodeId: string,
  episodes: Episode[],
  userChoices: UserChoiceEntry[]
): string[] {
  const byEp = new Map<string, UserChoiceEntry>();
  userChoices.forEach((c) => byEp.set(c.episodeId, c));

  const validEpIds = new Set(episodes.map((e) => e.id));
  const toRemove: string[] = [];
  const seen = new Set<string>();
  let cursor = fromEpisodeId;

  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const entry = byEp.get(cursor);
    if (!entry) break;
    toRemove.push(entry.id);
    cursor = validEpIds.has(entry.nextEpisodeId) ? entry.nextEpisodeId : '';
  }

  return toRemove;
}

import type {
  DailyUnlockEntry,
  Episode,
  EpisodeAccessResult,
  Story,
  UserProfile,
} from '../../types';

export const DAILY_FREE_UNLOCK_LIMIT = 2;

export function getTodayDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface EpisodeAccessContext {
  dailyUnlocks: DailyUnlockEntry[];
  todayDateKey?: string;
  dailyLimit?: number;
}

/**
 * Reusable, backend-ready access control evaluator for episode playback.
 * Mirrors RBAC, simulated subscription tier, and daily free-episode unlock rules.
 */
export function canAccessEpisode(
  user: UserProfile | null,
  episode: Episode,
  context: EpisodeAccessContext = { dailyUnlocks: [] }
): EpisodeAccessResult {
  const today = context.todayDateKey ?? getTodayDateKey();
  const limit = context.dailyLimit ?? DAILY_FREE_UNLOCK_LIMIT;

  // 1. Free episodes are universally playable
  if (episode.accessTier === 'free') {
    return {
      allowed: true,
      reason: 'free_episode',
      canUnlockToday: false,
    };
  }

  // 2. Admins and owning creators have full access
  if (user && (user.role === 'admin' || user.uid === episode.creatorOwnerUid)) {
    return {
      allowed: true,
      reason: 'admin_or_creator_owner',
      canUnlockToday: false,
    };
  }

  // 3. Active Premium subscribers (simulated in Phase 2) unlock all tiers
  if (user && user.subscriptionTier === 'premium') {
    return {
      allowed: true,
      reason: 'premium_subscription',
      canUnlockToday: false,
    };
  }

  // 4. Daily unlock tier: check if already unlocked or eligible today
  if (episode.accessTier === 'daily_unlock') {
    const alreadyUnlocked = context.dailyUnlocks.some(
      (entry) => entry.episodeId === episode.id
    );
    if (alreadyUnlocked) {
      return {
        allowed: true,
        reason: 'daily_unlock_claimed',
        canUnlockToday: false,
      };
    }

    const usedToday = context.dailyUnlocks.filter(
      (entry) => entry.unlockDate === today
    ).length;

    if (usedToday < limit) {
      return {
        allowed: false,
        reason: user ? 'eligible_for_daily_unlock' : 'requires_sign_in_for_daily_unlock',
        canUnlockToday: true,
      };
    }

    return {
      allowed: false,
      reason: 'daily_limit_reached',
      canUnlockToday: false,
    };
  }

  // 5. Strictly premium episodes require Premium subscription
  return {
    allowed: false,
    reason: 'requires_premium',
    canUnlockToday: false,
  };
}

export function getRemainingDailyUnlocks(
  dailyUnlocks: DailyUnlockEntry[],
  todayDateKey: string = getTodayDateKey(),
  dailyLimit: number = DAILY_FREE_UNLOCK_LIMIT
): number {
  const usedToday = dailyUnlocks.filter((u) => u.unlockDate === todayDateKey).length;
  return Math.max(0, dailyLimit - usedToday);
}

export function formatDuration(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatPlayCount(plays: number): string {
  if (plays >= 1_000_000) {
    return `${(plays / 1_000_000).toFixed(1)}M`;
  }
  if (plays >= 1_000) {
    return `${(plays / 1_000).toFixed(1)}K`;
  }
  return String(plays);
}

export interface StoryFilterOptions {
  query?: string;
  genreId?: string;
  language?: string;
  creatorId?: string;
  sortBy?: 'popular' | 'rating' | 'recent';
}

/**
 * Pure deterministic database-query-style story filtering & sorting (zero AI).
 */
export function filterAndSortStories(
  stories: Story[],
  options: StoryFilterOptions
): Story[] {
  const q = (options.query ?? '').trim().toLowerCase();
  const filtered = stories.filter((story) => {
    if (story.visibility !== 'published') return false;
    if (options.genreId && options.genreId !== 'all' && story.genreId !== options.genreId) {
      return false;
    }
    if (options.language && options.language !== 'all') {
      if (story.language !== options.language && story.language !== 'bilingual') {
        return false;
      }
    }
    if (options.creatorId && options.creatorId !== 'all' && story.creatorId !== options.creatorId) {
      return false;
    }
    if (q) {
      const haystack = `${story.title} ${story.titleHi} ${story.synopsis} ${story.synopsisHi} ${story.creatorName}`.toLowerCase();
      if (!haystack.includes(q)) {
        return false;
      }
    }
    return true;
  });

  const sorted = [...filtered];
  const sortBy = options.sortBy ?? 'popular';
  if (sortBy === 'rating') {
    sorted.sort((a, b) => b.rating - a.rating || b.totalPlays - a.totalPlays);
  } else if (sortBy === 'recent') {
    sorted.sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt));
  } else {
    sorted.sort((a, b) => b.totalPlays - a.totalPlays);
  }
  return sorted;
}

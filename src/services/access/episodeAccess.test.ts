import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canAccessEpisode,
  filterAndSortStories,
  formatDuration,
  formatPlayCount,
  getRemainingDailyUnlocks,
} from './episodeAccess';
import type { DailyUnlockEntry, Episode, Story, UserProfile } from '../../types';

const baseUser: UserProfile = {
  uid: 'user-1',
  email: 'listener@example.com',
  displayName: 'Aarav',
  preferredLanguage: 'en',
  role: 'user',
  subscriptionTier: 'free',
  avatarInitials: 'AA',
};

const makeEpisode = (tier: Episode['accessTier'], id = 'ep-1'): Episode => ({
  id,
  storyId: 'story-1',
  creatorOwnerUid: 'creator-owner-1',
  episodeNumber: 3,
  title: 'Episode 3',
  titleHi: 'एपिसोड 3',
  durationSec: 420,
  accessTier: tier,
  mediaRef: { provider: 'demo', id: 'demo-track-1', type: 'audio' },
  publishedAt: '2026-10-01T00:00:00Z',
});

test('canAccessEpisode allows free episodes for guests and signed-in users', () => {
  const freeEp = makeEpisode('free');
  assert.equal(canAccessEpisode(null, freeEp).allowed, true);
  assert.equal(canAccessEpisode(baseUser, freeEp).reason, 'free_episode');
});

test('canAccessEpisode allows premium users and admins on all tiers', () => {
  const premEp = makeEpisode('premium', 'ep-prem');
  const premUser: UserProfile = { ...baseUser, subscriptionTier: 'premium' };
  const adminUser: UserProfile = { ...baseUser, role: 'admin' };

  assert.equal(canAccessEpisode(baseUser, premEp).allowed, false);
  assert.equal(canAccessEpisode(baseUser, premEp).reason, 'requires_premium');
  assert.equal(canAccessEpisode(premUser, premEp).allowed, true);
  assert.equal(canAccessEpisode(premUser, premEp).reason, 'premium_subscription');
  assert.equal(canAccessEpisode(adminUser, premEp).allowed, true);
  assert.equal(canAccessEpisode(adminUser, premEp).reason, 'admin_or_creator_owner');
});

test('canAccessEpisode enforces daily free unlock quota and claimed state', () => {
  const dailyEp = makeEpisode('daily_unlock', 'ep-daily-1');
  const today = '2026-11-23';

  // Eligible when under daily quota
  const eligible = canAccessEpisode(baseUser, dailyEp, { dailyUnlocks: [], todayDateKey: today });
  assert.equal(eligible.allowed, false);
  assert.equal(eligible.canUnlockToday, true);
  assert.equal(eligible.reason, 'eligible_for_daily_unlock');

  // Claimed unlocks permanently allow playback
  const claimedUnlock: DailyUnlockEntry = {
    id: 'user-1_ep-daily-1',
    userId: 'user-1',
    storyId: 'story-1',
    episodeId: 'ep-daily-1',
    unlockDate: today,
    createdAt: Date.now(),
  };
  const unlockedRes = canAccessEpisode(baseUser, dailyEp, {
    dailyUnlocks: [claimedUnlock],
    todayDateKey: today,
  });
  assert.equal(unlockedRes.allowed, true);
  assert.equal(unlockedRes.reason, 'daily_unlock_claimed');

  // Quota reached blocks additional daily_unlock episodes today
  const twoUnlocks: DailyUnlockEntry[] = [
    { ...claimedUnlock, id: 'u1', episodeId: 'other-1' },
    { ...claimedUnlock, id: 'u2', episodeId: 'other-2' },
  ];
  assert.equal(getRemainingDailyUnlocks(twoUnlocks, today), 0);
  const blocked = canAccessEpisode(baseUser, dailyEp, {
    dailyUnlocks: twoUnlocks,
    todayDateKey: today,
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.canUnlockToday, false);
  assert.equal(blocked.reason, 'daily_limit_reached');
});

test('formatDuration and formatPlayCount format clean tabular strings', () => {
  assert.equal(formatDuration(75), '1:15');
  assert.equal(formatDuration(3665), '1:01:05');
  assert.equal(formatPlayCount(850), '850');
  assert.equal(formatPlayCount(14500), '14.5K');
  assert.equal(formatPlayCount(2400000), '2.4M');
});

test('filterAndSortStories filters by genre, language, query, and sort order', () => {
  const sampleStories: Story[] = [
    {
      id: 's1',
      slug: 'kaalchakra',
      title: 'Kaalchakra',
      titleHi: 'कालचक्र',
      synopsis: 'Ancient astrolabe mystery',
      synopsisHi: 'प्राचीन रहस्य',
      genreId: 'mythology',
      language: 'hi',
      creatorId: 'c1',
      creatorOwnerUid: 'o1',
      creatorName: 'Meera Studio',
      coverTheme: 'mythology-gold',
      rating: 4.9,
      totalPlays: 120000,
      episodeCount: 6,
      isTrending: true,
      isEditorsPick: true,
      isPopular: true,
      isFeatured: true,
      visibility: 'published',
      format: 'hybrid',
      isInteractive: false,
      publishedAt: '2026-11-10T00:00:00Z',
    },
    {
      id: 's2',
      slug: 'shimla-rain',
      title: 'Monsoon Letters',
      titleHi: 'मानसून के ख़त',
      synopsis: 'Letters found in Shimla',
      synopsisHi: 'शिमला में मिले ख़त',
      genreId: 'romance',
      language: 'en',
      creatorId: 'c2',
      creatorOwnerUid: 'o2',
      creatorName: 'Kabir Sen',
      coverTheme: 'romance-mist',
      rating: 4.7,
      totalPlays: 250000,
      episodeCount: 5,
      isTrending: true,
      isEditorsPick: false,
      isPopular: true,
      isFeatured: false,
      visibility: 'published',
      format: 'audio',
      isInteractive: false,
      publishedAt: '2026-11-20T00:00:00Z',
    },
  ];

  assert.equal(filterAndSortStories(sampleStories, { genreId: 'mythology' }).length, 1);
  assert.equal(filterAndSortStories(sampleStories, { query: 'shimla' })[0].id, 's2');
  assert.equal(filterAndSortStories(sampleStories, { sortBy: 'rating' })[0].id, 's1');
  assert.equal(filterAndSortStories(sampleStories, { sortBy: 'recent' })[0].id, 's2');
  assert.equal(filterAndSortStories(sampleStories, { sortBy: 'popular' })[0].id, 's2');
});

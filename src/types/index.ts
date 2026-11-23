export type LanguageCode = 'en' | 'hi';
export type ContentLanguage = 'en' | 'hi' | 'bilingual';
export type UserRole = 'user' | 'creator' | 'admin';
export type SubscriptionTier = 'free' | 'premium';
export type SubscriptionPlan = 'free' | 'premium_monthly' | 'premium_annual';
export type SubscriptionStatus = 'active' | 'cancelled';
export type EpisodeAccessTier = 'free' | 'daily_unlock' | 'premium';
export type StoryVisibility = 'published' | 'draft' | 'archived';
export type StoryFormat = 'audio' | 'video' | 'hybrid';
export type PlaybackFormat = 'audio' | 'video';
export type MediaProviderType = 'demo' | 'drive' | 'youtube' | 'gcs';
export type MediaAssetType = 'audio' | 'video';
export type BookmarkTargetType = 'story_bookmark' | 'story_favorite' | 'creator_follow';

export interface MediaRef {
  provider: MediaProviderType;
  id: string;
  type: MediaAssetType;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  bio?: string;
  preferredLanguage: LanguageCode;
  preferredFormat?: PlaybackFormat;
  role: UserRole;
  subscriptionTier: SubscriptionTier;
  avatarInitials: string;
  createdAt?: string | number;
  updatedAt?: string | number;
}

export interface Category {
  id: string;
  slug: string;
  nameEn: string;
  nameHi: string;
  descriptionEn?: string;
  descriptionHi?: string;
  accentHex?: string;
  sortOrder: number;
  isActive: boolean;
}

export interface Creator {
  id: string;
  ownerUid: string;
  name: string;
  handle: string;
  bioEn?: string;
  bioHi?: string;
  language: ContentLanguage;
  followersCount: number;
  storiesCount: number;
  verified: boolean;
  accentPalette?: string;
}

export type CoverTheme =
  | 'mythology-gold'
  | 'romance-mist'
  | 'thriller-noir'
  | 'horror-amber'
  | 'crime-deco'
  | 'kids-lantern'
  | 'motivation-dawn'
  | 'comedy-bazaar'
  | 'mystery-emerald'
  | 'folklore-crimson'
  | 'scifi-indigo'
  | 'drama-sepia';

export interface Story {
  id: string;
  slug: string;
  title: string;
  titleHi: string;
  synopsis: string;
  synopsisHi: string;
  genreId: string;
  language: ContentLanguage;
  creatorId: string;
  creatorOwnerUid: string;
  creatorName: string;
  coverUrl?: string;
  backdropUrl?: string;
  coverTheme: CoverTheme;
  rating: number;
  totalPlays: number;
  episodeCount: number;
  isTrending: boolean;
  isEditorsPick: boolean;
  isPopular: boolean;
  isFeatured: boolean;
  visibility: StoryVisibility;
  format: StoryFormat;
  isInteractive: boolean;
  publishedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InteractiveChoiceOption {
  id: string;
  labelEn: string;
  labelHi: string;
  taglineEn?: string;
  taglineHi?: string;
  nextEpisodeId: string;
}

export interface EpisodeChoicePoint {
  id: string;
  /** Timestamp in seconds to pause and show choices. If omitted or triggerAtEnd is true, triggers near episode end. */
  triggerAtSec?: number;
  triggerAtEnd?: boolean;
  promptEn: string;
  promptHi: string;
  options: InteractiveChoiceOption[];
}

export interface Episode {
  id: string;
  storyId: string;
  creatorOwnerUid: string;
  episodeNumber: number;
  title: string;
  titleHi: string;
  description?: string;
  descriptionHi?: string;
  durationSec: number;
  accessTier: EpisodeAccessTier;
  dailyUnlockOrder?: number;
  mediaRef: MediaRef;
  audioRef?: MediaRef;
  videoMediaRef?: MediaRef;
  choicePoint?: EpisodeChoicePoint;
  isEnding?: boolean;
  publishedAt: string;
  createdAt?: string;
}

export interface ListeningHistoryEntry {
  id: string;
  userId: string;
  storyId: string;
  episodeId: string;
  episodeNumber: number;
  positionSec: number;
  durationSec: number;
  completed: boolean;
  updatedAt: number;
}

export interface BookmarkEntry {
  id: string;
  userId: string;
  targetType: BookmarkTargetType;
  targetId: string;
  createdAt: number;
}

export interface DailyUnlockEntry {
  id: string;
  userId: string;
  storyId: string;
  episodeId: string;
  unlockDate: string; // YYYY-MM-DD
  createdAt: number;
}

export interface SubscriptionRecord {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  isSimulated: true;
  startedAt: number;
  updatedAt: number;
}

export interface InteractiveChoice {
  id: string;
  storyId: string;
  episodeId: string;
  promptEn: string;
  promptHi: string;
  options: InteractiveChoiceOption[];
  createdAt: string;
}

export interface UserChoiceEntry {
  id: string;
  userId: string;
  storyId: string;
  episodeId: string;
  choicePointId: string;
  optionId: string;
  optionLabelEn: string;
  optionLabelHi: string;
  nextEpisodeId: string;
  chosenAt: number;
}

export interface EpisodeAccessResult {
  allowed: boolean;
  reason:
    | 'free_episode'
    | 'premium_subscription'
    | 'admin_or_creator_owner'
    | 'daily_unlock_claimed'
    | 'eligible_for_daily_unlock'
    | 'daily_limit_reached'
    | 'requires_premium'
    | 'requires_sign_in_for_daily_unlock';
  canUnlockToday: boolean;
}

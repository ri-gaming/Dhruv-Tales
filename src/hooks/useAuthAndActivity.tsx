import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import type {
  BookmarkEntry,
  BookmarkTargetType,
  Category,
  Creator,
  DailyUnlockEntry,
  Episode,
  LanguageCode,
  ListeningHistoryEntry,
  PlaybackFormat,
  Story,
  SubscriptionPlan,
  SubscriptionRecord,
  UserChoiceEntry,
  UserProfile,
} from '../types';
import { getTodayDateKey } from '../services/access/episodeAccess';
import {
  deleteAccountAndData,
  resendVerificationEmail,
  signInWithEmail,
  signInWithGoogleAccount,
  signOutAccount,
  signUpWithEmail,
  syncUserProfile,
  updateUserPreferredFormat,
  updateUserProfileRecord,
} from '../services/firebase/authService';
import {
  fetchCatalog,
  seedFirestoreCatalog,
  type SeedResult,
} from '../services/firebase/catalogService';
import { auth } from '../services/firebase/config';
import {
  deleteUserChoicesFromFirestore,
  fetchUserActivity,
  loadGuestActivity,
  recordDailyUnlockInFirestore,
  saveGuestActivity,
  saveListeningProgressToFirestore,
  saveUserChoiceToFirestore,
  toggleBookmarkInFirestore,
  updateMockSubscriptionInFirestore,
} from '../services/firebase/userActivityService';
import { getDownstreamChoiceIds } from '../services/interactive/storyGraph';
import { useLanguage } from './useLanguage';

interface AppDataContextValue {
  // Auth
  firebaseUser: User | null;
  profile: UserProfile | null;
  authReady: boolean;
  isVerifiedUser: boolean;
  preferredFormat: PlaybackFormat;
  loginWithGoogle: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshVerificationStatus: () => Promise<boolean>;
  sendVerification: () => Promise<void>;
  updateProfile: (updates: {
    displayName: string;
    bio: string;
    preferredLanguage: LanguageCode;
    preferredFormat?: PlaybackFormat;
  }) => Promise<void>;
  setPreferredFormat: (format: PlaybackFormat) => Promise<void>;
  deleteAccount: () => Promise<void>;

  // Catalog
  categories: Category[];
  creators: Creator[];
  stories: Story[];
  episodes: Episode[];
  catalogSource: 'firestore' | 'seed-fallback';
  catalogLoading: boolean;
  refreshCatalog: () => Promise<void>;
  seedCatalog: () => Promise<SeedResult>;

  // User Activity
  history: ListeningHistoryEntry[];
  bookmarks: BookmarkEntry[];
  dailyUnlocks: DailyUnlockEntry[];
  userChoices: UserChoiceEntry[];
  subscription: SubscriptionRecord | null;
  saveProgress: (entry: Omit<ListeningHistoryEntry, 'id' | 'userId' | 'updatedAt'>) => Promise<void>;
  toggleBookmark: (targetType: BookmarkTargetType, targetId: string) => Promise<boolean>;
  isBookmarked: (targetType: BookmarkTargetType, targetId: string) => boolean;
  claimDailyUnlock: (storyId: string, episodeId: string) => Promise<DailyUnlockEntry>;
  recordUserChoice: (
    entry: Omit<UserChoiceEntry, 'id' | 'userId' | 'chosenAt'>
  ) => Promise<UserChoiceEntry>;
  pruneStoryChoicesFromEpisode: (storyId: string, fromEpisodeId: string) => Promise<void>;
  activateMockSubscription: (plan: SubscriptionPlan) => Promise<void>;
  cancelMockSubscription: () => Promise<void>;
}

const AppDataContext = createContext<AppDataContextValue | null>(null);

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { lang, setLang } = useLanguage();

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [creators, setCreators] = useState<Creator[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [catalogSource, setCatalogSource] = useState<'firestore' | 'seed-fallback'>('seed-fallback');
  const [catalogLoading, setCatalogLoading] = useState(true);

  const [history, setHistory] = useState<ListeningHistoryEntry[]>([]);
  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [dailyUnlocks, setDailyUnlocks] = useState<DailyUnlockEntry[]>([]);
  const [userChoices, setUserChoices] = useState<UserChoiceEntry[]>([]);
  const [preferredFormat, setPreferredFormatState] = useState<PlaybackFormat>('audio');
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);

  const isVerifiedUser = Boolean(firebaseUser && firebaseUser.emailVerified);

  const refreshCatalog = useCallback(async () => {
    setCatalogLoading(true);
    const bundle = await fetchCatalog();
    setCategories(bundle.categories);
    setCreators(bundle.creators);
    setStories(bundle.stories);
    setEpisodes(bundle.episodes);
    setCatalogSource(bundle.source);
    setCatalogLoading(false);
  }, []);

  useEffect(() => {
    void refreshCatalog();
  }, [refreshCatalog]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        try {
          const synced = await syncUserProfile(user, lang);
          setProfile(synced);
          if (synced.preferredLanguage) {
            setLang(synced.preferredLanguage);
          }
          setPreferredFormatState(synced.preferredFormat === 'video' ? 'video' : 'audio');
          const activity = await fetchUserActivity(user.uid);
          setHistory(activity.history);
          setBookmarks(activity.bookmarks);
          setDailyUnlocks(activity.dailyUnlocks);
          setUserChoices(activity.userChoices);
          setSubscription(activity.subscription);
        } catch (err) {
          console.error('Error hydrating authenticated user state:', err);
        }
      } else {
        setProfile(null);
        const guest = loadGuestActivity();
        setHistory(guest.history);
        setBookmarks(guest.bookmarks);
        setDailyUnlocks(guest.dailyUnlocks);
        setUserChoices(guest.userChoices);
        setPreferredFormatState(guest.preferredFormat);
        setSubscription(guest.subscription);
      }
      setAuthReady(true);
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const guestStateRef = useRef({
    history,
    bookmarks,
    dailyUnlocks,
    userChoices,
    preferredFormat,
    subscription,
  });

  useEffect(() => {
    guestStateRef.current = {
      history,
      bookmarks,
      dailyUnlocks,
      userChoices,
      preferredFormat,
      subscription,
    };
  }, [history, bookmarks, dailyUnlocks, userChoices, preferredFormat, subscription]);

  // Persist guest activity automatically when signed out without stale-closure overwrites
  const syncGuest = useCallback(
    (overrides?: {
      history?: ListeningHistoryEntry[];
      bookmarks?: BookmarkEntry[];
      dailyUnlocks?: DailyUnlockEntry[];
      userChoices?: UserChoiceEntry[];
      preferredFormat?: PlaybackFormat;
      subscription?: SubscriptionRecord | null;
    }) => {
      const merged = {
        history: overrides?.history ?? guestStateRef.current.history,
        bookmarks: overrides?.bookmarks ?? guestStateRef.current.bookmarks,
        dailyUnlocks: overrides?.dailyUnlocks ?? guestStateRef.current.dailyUnlocks,
        userChoices: overrides?.userChoices ?? guestStateRef.current.userChoices,
        preferredFormat: overrides?.preferredFormat ?? guestStateRef.current.preferredFormat,
        subscription:
          overrides && 'subscription' in overrides
            ? (overrides.subscription ?? null)
            : guestStateRef.current.subscription,
      };
      guestStateRef.current = merged;
      if (!firebaseUser) {
        saveGuestActivity(merged);
      }
    },
    [firebaseUser]
  );

  const loginWithGoogle = useCallback(async () => {
    await signInWithGoogleAccount();
  }, []);

  const loginWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmail(email, password);
  }, []);

  const registerWithEmail = useCallback(
    async (email: string, password: string, displayName: string) => {
      await signUpWithEmail(email, password, displayName);
    },
    []
  );

  const logout = useCallback(async () => {
    await signOutAccount();
  }, []);

  const sendVerification = useCallback(async () => {
    if (!firebaseUser) return;
    await resendVerificationEmail(firebaseUser);
  }, [firebaseUser]);

  const refreshVerificationStatus = useCallback(async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const refreshed = auth.currentUser;
    setFirebaseUser(refreshed);
    if (refreshed.emailVerified) {
      const synced = await syncUserProfile(refreshed, lang);
      setProfile(synced);
      setPreferredFormatState(synced.preferredFormat === 'video' ? 'video' : 'audio');
      const activity = await fetchUserActivity(refreshed.uid);
      setHistory(activity.history);
      setBookmarks(activity.bookmarks);
      setDailyUnlocks(activity.dailyUnlocks);
      setUserChoices(activity.userChoices);
      setSubscription(activity.subscription);
      return true;
    }
    return false;
  }, [lang]);

  const setPreferredFormat = useCallback(
    async (format: PlaybackFormat) => {
      setPreferredFormatState(format);
      setProfile((prev) => (prev ? { ...prev, preferredFormat: format } : prev));
      syncGuest({ preferredFormat: format });

      if (firebaseUser && firebaseUser.emailVerified) {
        try {
          await updateUserPreferredFormat(firebaseUser.uid, format);
        } catch (err) {
          console.warn('Could not persist preferredFormat to Firestore:', err);
        }
      }
    },
    [firebaseUser, syncGuest]
  );

  const updateProfile = useCallback(
    async (updates: {
      displayName: string;
      bio: string;
      preferredLanguage: LanguageCode;
      preferredFormat?: PlaybackFormat;
    }) => {
      if (!firebaseUser || !firebaseUser.emailVerified) {
        throw new Error('Please verify your email address before saving profile changes.');
      }
      await updateUserProfileRecord(firebaseUser.uid, updates);
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              displayName: updates.displayName.trim().slice(0, 80),
              bio: updates.bio.trim().slice(0, 300),
              preferredLanguage: updates.preferredLanguage,
              preferredFormat: updates.preferredFormat ?? prev.preferredFormat ?? 'audio',
            }
          : prev
      );
      if (updates.preferredFormat) {
        setPreferredFormatState(updates.preferredFormat);
      }
      setLang(updates.preferredLanguage);
    },
    [firebaseUser, setLang]
  );

  const deleteAccount = useCallback(async () => {
    if (!auth.currentUser) return;
    await deleteAccountAndData(auth.currentUser);
    setProfile(null);
    setHistory([]);
    setBookmarks([]);
    setDailyUnlocks([]);
    setUserChoices([]);
    setSubscription(null);
  }, []);

  const seedCatalog = useCallback(async () => {
    if (!firebaseUser || profile?.role !== 'admin') {
      throw new Error('Admin privileges required to seed Cloud Firestore.');
    }
    const res = await seedFirestoreCatalog(firebaseUser.uid);
    await refreshCatalog();
    return res;
  }, [firebaseUser, profile, refreshCatalog]);

  const saveProgress = useCallback(
    async (entry: Omit<ListeningHistoryEntry, 'id' | 'userId' | 'updatedAt'>) => {
      const uid = firebaseUser?.uid ?? 'guest';
      const id = `${uid}_${entry.episodeId}`;
      const optimistic: ListeningHistoryEntry = {
        id,
        userId: uid,
        ...entry,
        updatedAt: Date.now(),
      };

      setHistory((prev) => {
        const next = [optimistic, ...prev.filter((h) => h.episodeId !== entry.episodeId)];
        syncGuest({ history: next });
        return next;
      });

      if (firebaseUser && firebaseUser.emailVerified) {
        await saveListeningProgressToFirestore(firebaseUser.uid, entry);
      }
    },
    [firebaseUser, syncGuest]
  );

  const isBookmarked = useCallback(
    (targetType: BookmarkTargetType, targetId: string) =>
      bookmarks.some((b) => b.targetType === targetType && b.targetId === targetId),
    [bookmarks]
  );

  const toggleBookmark = useCallback(
    async (targetType: BookmarkTargetType, targetId: string) => {
      const currentlyActive = bookmarks.some(
        (b) => b.targetType === targetType && b.targetId === targetId
      );
      const uid = firebaseUser?.uid ?? 'guest';
      const id = `${uid}_${targetType}_${targetId}`;

      if (currentlyActive) {
        const next = bookmarks.filter(
          (b) => !(b.targetType === targetType && b.targetId === targetId)
        );
        setBookmarks(next);
        syncGuest({ bookmarks: next });
      } else {
        const created: BookmarkEntry = {
          id,
          userId: uid,
          targetType,
          targetId,
          createdAt: Date.now(),
        };
        const next = [created, ...bookmarks];
        setBookmarks(next);
        syncGuest({ bookmarks: next });
      }

      if (firebaseUser && firebaseUser.emailVerified) {
        await toggleBookmarkInFirestore(firebaseUser.uid, targetType, targetId, currentlyActive);
      }

      return !currentlyActive;
    },
    [bookmarks, firebaseUser, syncGuest]
  );

  const claimDailyUnlock = useCallback(
    async (storyId: string, episodeId: string) => {
      const uid = firebaseUser?.uid ?? 'guest';
      const unlockDate = getTodayDateKey();
      const entry: DailyUnlockEntry = {
        id: `${uid}_${episodeId}`,
        userId: uid,
        storyId,
        episodeId,
        unlockDate,
        createdAt: Date.now(),
      };

      const next = [entry, ...dailyUnlocks.filter((d) => d.episodeId !== episodeId)];
      setDailyUnlocks(next);
      syncGuest({ dailyUnlocks: next });

      if (firebaseUser && firebaseUser.emailVerified) {
        return recordDailyUnlockInFirestore(firebaseUser.uid, storyId, episodeId);
      }
      return entry;
    },
    [firebaseUser, dailyUnlocks, syncGuest]
  );

  const recordUserChoice = useCallback(
    async (entry: Omit<UserChoiceEntry, 'id' | 'userId' | 'chosenAt'>) => {
      const uid = firebaseUser?.uid ?? 'guest';
      const id = `${uid}_${entry.storyId}_${entry.episodeId}`;
      const optimistic: UserChoiceEntry = {
        id,
        userId: uid,
        ...entry,
        chosenAt: Date.now(),
      };

      setUserChoices((prev) => {
        const next = [
          ...prev.filter((c) => !(c.storyId === entry.storyId && c.episodeId === entry.episodeId)),
          optimistic,
        ];
        syncGuest({ userChoices: next });
        return next;
      });

      if (firebaseUser && firebaseUser.emailVerified) {
        return saveUserChoiceToFirestore(firebaseUser.uid, entry);
      }
      return optimistic;
    },
    [firebaseUser, syncGuest]
  );

  const pruneStoryChoicesFromEpisode = useCallback(
    async (storyId: string, fromEpisodeId: string) => {
      const storyEpisodes = episodes.filter((e) => e.storyId === storyId);
      const storyChoices = userChoices.filter((c) => c.storyId === storyId);
      const idsToDelete = getDownstreamChoiceIds(fromEpisodeId, storyEpisodes, storyChoices);

      if (idsToDelete.length === 0) return;
      const removeSet = new Set(idsToDelete);

      setUserChoices((prev) => {
        const next = prev.filter((c) => !removeSet.has(c.id));
        syncGuest({ userChoices: next });
        return next;
      });

      if (firebaseUser && firebaseUser.emailVerified) {
        await deleteUserChoicesFromFirestore(idsToDelete);
      }
    },
    [episodes, userChoices, firebaseUser, syncGuest]
  );

  const activateMockSubscription = useCallback(
    async (plan: SubscriptionPlan) => {
      if (!firebaseUser || !firebaseUser.emailVerified) {
        throw new Error('Sign in with a verified account to save your simulated subscription.');
      }
      const rec = await updateMockSubscriptionInFirestore(firebaseUser.uid, plan, 'active');
      setSubscription(rec);
      setProfile((prev) =>
        prev ? { ...prev, subscriptionTier: plan === 'free' ? 'free' : 'premium' } : prev
      );
    },
    [firebaseUser]
  );

  const cancelMockSubscription = useCallback(async () => {
    if (!firebaseUser || !firebaseUser.emailVerified) {
      throw new Error('Sign in with a verified account to manage subscription.');
    }
    const rec = await updateMockSubscriptionInFirestore(
      firebaseUser.uid,
      subscription?.plan ?? 'premium_monthly',
      'cancelled'
    );
    setSubscription(rec);
    setProfile((prev) => (prev ? { ...prev, subscriptionTier: 'free' } : prev));
  }, [firebaseUser, subscription]);

  return (
    <AppDataContext.Provider
      value={{
        firebaseUser,
        profile,
        authReady,
        isVerifiedUser,
        preferredFormat,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        refreshVerificationStatus,
        sendVerification,
        updateProfile,
        setPreferredFormat,
        deleteAccount,
        categories,
        creators,
        stories,
        episodes,
        catalogSource,
        catalogLoading,
        refreshCatalog,
        seedCatalog,
        history,
        bookmarks,
        dailyUnlocks,
        userChoices,
        subscription,
        saveProgress,
        toggleBookmark,
        isBookmarked,
        claimDailyUnlock,
        recordUserChoice,
        pruneStoryChoicesFromEpisode,
        activateMockSubscription,
        cancelMockSubscription,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export function useAppData(): AppDataContextValue {
  const ctx = useContext(AppDataContext);
  if (!ctx) {
    throw new Error('useAppData must be used within AppDataProvider');
  }
  return ctx;
}

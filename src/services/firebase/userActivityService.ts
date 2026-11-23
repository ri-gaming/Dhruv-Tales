import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type {
  BookmarkEntry,
  BookmarkTargetType,
  DailyUnlockEntry,
  ListeningHistoryEntry,
  PlaybackFormat,
  SubscriptionPlan,
  SubscriptionRecord,
  UserChoiceEntry,
} from '../../types';
import { getTodayDateKey } from '../access/episodeAccess';
import { db, handleFirestoreError, OperationType } from './config';

export interface UserActivityState {
  history: ListeningHistoryEntry[];
  bookmarks: BookmarkEntry[];
  dailyUnlocks: DailyUnlockEntry[];
  userChoices: UserChoiceEntry[];
  preferredFormat: PlaybackFormat;
  subscription: SubscriptionRecord | null;
}

const LOCAL_STORAGE_KEY = 'dhruv_tales_guest_activity_v1';

function tsToMillis(val: unknown): number {
  if (val instanceof Timestamp) return val.toMillis();
  if (typeof val === 'number') return val;
  return Date.now();
}

export function loadGuestActivity(): UserActivityState {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      return {
        history: [],
        bookmarks: [],
        dailyUnlocks: [],
        userChoices: [],
        preferredFormat: 'audio',
        subscription: null,
      };
    }
    const parsed = JSON.parse(raw) as Partial<UserActivityState>;
    return {
      history: Array.isArray(parsed.history) ? parsed.history : [],
      bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : [],
      dailyUnlocks: Array.isArray(parsed.dailyUnlocks) ? parsed.dailyUnlocks : [],
      userChoices: Array.isArray(parsed.userChoices) ? parsed.userChoices : [],
      preferredFormat: parsed.preferredFormat === 'video' ? 'video' : 'audio',
      subscription: parsed.subscription ?? null,
    };
  } catch {
    return {
      history: [],
      bookmarks: [],
      dailyUnlocks: [],
      userChoices: [],
      preferredFormat: 'audio',
      subscription: null,
    };
  }
}

export function saveGuestActivity(state: UserActivityState): void {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors in restricted frames
  }
}

export async function fetchUserActivity(uid: string): Promise<UserActivityState> {
  try {
    const [histSnap, bmSnap, unlockSnap, choiceSnap, subSnap] = await Promise.all([
      getDocs(query(collection(db, 'listeningHistory'), where('userId', '==', uid))),
      getDocs(query(collection(db, 'bookmarks'), where('userId', '==', uid))),
      getDocs(query(collection(db, 'dailyUnlocks'), where('userId', '==', uid))),
      getDocs(query(collection(db, 'userChoices'), where('userId', '==', uid))),
      getDoc(doc(db, 'subscriptions', uid)),
    ]);

    const history: ListeningHistoryEntry[] = histSnap.docs
      .map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id),
          userId: String(raw.userId),
          storyId: String(raw.storyId),
          episodeId: String(raw.episodeId),
          episodeNumber: Number(raw.episodeNumber),
          positionSec: Number(raw.positionSec),
          durationSec: Number(raw.durationSec),
          completed: Boolean(raw.completed),
          updatedAt: tsToMillis(raw.updatedAt),
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);

    const bookmarks: BookmarkEntry[] = bmSnap.docs
      .map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id),
          userId: String(raw.userId),
          targetType: raw.targetType as BookmarkTargetType,
          targetId: String(raw.targetId),
          createdAt: tsToMillis(raw.createdAt),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    const dailyUnlocks: DailyUnlockEntry[] = unlockSnap.docs
      .map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id),
          userId: String(raw.userId),
          storyId: String(raw.storyId),
          episodeId: String(raw.episodeId),
          unlockDate: String(raw.unlockDate),
          createdAt: tsToMillis(raw.createdAt),
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    const userChoices: UserChoiceEntry[] = choiceSnap.docs
      .map((d) => {
        const raw = d.data();
        return {
          id: String(raw.id),
          userId: String(raw.userId),
          storyId: String(raw.storyId),
          episodeId: String(raw.episodeId),
          choicePointId: String(raw.choicePointId),
          optionId: String(raw.optionId),
          optionLabelEn: String(raw.optionLabelEn),
          optionLabelHi: String(raw.optionLabelHi),
          nextEpisodeId: String(raw.nextEpisodeId),
          chosenAt: tsToMillis(raw.chosenAt),
        };
      })
      .sort((a, b) => a.chosenAt - b.chosenAt);

    let subscription: SubscriptionRecord | null = null;
    if (subSnap.exists()) {
      const raw = subSnap.data();
      subscription = {
        id: String(raw.id),
        userId: String(raw.userId),
        plan: raw.plan as SubscriptionPlan,
        status: raw.status as 'active' | 'cancelled',
        isSimulated: true,
        startedAt: tsToMillis(raw.startedAt),
        updatedAt: tsToMillis(raw.updatedAt),
      };
    }

    return {
      history,
      bookmarks,
      dailyUnlocks,
      userChoices,
      preferredFormat: 'audio',
      subscription,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `userActivity/${uid}`);
  }
}

export async function saveListeningProgressToFirestore(
  uid: string,
  entry: Omit<ListeningHistoryEntry, 'id' | 'userId' | 'updatedAt'>
): Promise<ListeningHistoryEntry> {
  const id = `${uid}_${entry.episodeId}`.slice(0, 128);
  const ref = doc(db, 'listeningHistory', id);
  const clampedPos = Math.max(0, Math.min(86400, Math.round(entry.positionSec)));
  const clampedDur = Math.max(1, Math.min(86400, Math.round(entry.durationSec)));

  try {
    await setDoc(ref, {
      id,
      userId: uid,
      storyId: entry.storyId,
      episodeId: entry.episodeId,
      episodeNumber: entry.episodeNumber,
      positionSec: clampedPos,
      durationSec: clampedDur,
      completed: entry.completed,
      updatedAt: serverTimestamp(),
    });
    return {
      id,
      userId: uid,
      ...entry,
      positionSec: clampedPos,
      durationSec: clampedDur,
      updatedAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `listeningHistory/${id}`);
  }
}

export async function toggleBookmarkInFirestore(
  uid: string,
  targetType: BookmarkTargetType,
  targetId: string,
  currentlyActive: boolean
): Promise<BookmarkEntry | null> {
  const id = `${uid}_${targetType}_${targetId}`.slice(0, 128);
  const ref = doc(db, 'bookmarks', id);

  try {
    if (currentlyActive) {
      await deleteDoc(ref);
      return null;
    }
    await setDoc(ref, {
      id,
      userId: uid,
      targetType,
      targetId,
      createdAt: serverTimestamp(),
    });
    return {
      id,
      userId: uid,
      targetType,
      targetId,
      createdAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(
      error,
      currentlyActive ? OperationType.DELETE : OperationType.CREATE,
      `bookmarks/${id}`
    );
  }
}

export async function recordDailyUnlockInFirestore(
  uid: string,
  storyId: string,
  episodeId: string
): Promise<DailyUnlockEntry> {
  const id = `${uid}_${episodeId}`.slice(0, 128);
  const unlockDate = getTodayDateKey();
  const ref = doc(db, 'dailyUnlocks', id);

  try {
    await setDoc(ref, {
      id,
      userId: uid,
      storyId,
      episodeId,
      unlockDate,
      createdAt: serverTimestamp(),
    });
    return {
      id,
      userId: uid,
      storyId,
      episodeId,
      unlockDate,
      createdAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `dailyUnlocks/${id}`);
  }
}

export async function saveUserChoiceToFirestore(
  uid: string,
  entry: Omit<UserChoiceEntry, 'id' | 'userId' | 'chosenAt'>
): Promise<UserChoiceEntry> {
  const id = `${uid}_${entry.storyId}_${entry.episodeId}`.slice(0, 128);
  const ref = doc(db, 'userChoices', id);

  try {
    await setDoc(ref, {
      id,
      userId: uid,
      storyId: entry.storyId,
      episodeId: entry.episodeId,
      choicePointId: entry.choicePointId,
      optionId: entry.optionId,
      optionLabelEn: entry.optionLabelEn.slice(0, 160),
      optionLabelHi: entry.optionLabelHi.slice(0, 160),
      nextEpisodeId: entry.nextEpisodeId,
      chosenAt: serverTimestamp(),
    });
    return {
      id,
      userId: uid,
      ...entry,
      chosenAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `userChoices/${id}`);
  }
}

export async function deleteUserChoicesFromFirestore(choiceIds: string[]): Promise<void> {
  if (choiceIds.length === 0) return;
  try {
    const batch = writeBatch(db);
    for (const id of choiceIds) {
      batch.delete(doc(db, 'userChoices', id));
    }
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `userChoices/${choiceIds.join(',')}`);
  }
}

/**
 * SIMULATED subscription workflow (mock checkout & one-click cancel).
 * Persists mock subscription record to Firestore and updates `users/{uid}.subscriptionTier`.
 */
export async function updateMockSubscriptionInFirestore(
  uid: string,
  plan: SubscriptionPlan,
  status: 'active' | 'cancelled'
): Promise<SubscriptionRecord> {
  const subRef = doc(db, 'subscriptions', uid);
  const userRef = doc(db, 'users', uid);
  const tier = status === 'active' && plan !== 'free' ? 'premium' : 'free';

  try {
    const existingSnap = await getDoc(subRef);
    if (existingSnap.exists()) {
      await updateDoc(subRef, {
        plan,
        status,
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(subRef, {
        id: uid,
        userId: uid,
        plan,
        status,
        isSimulated: true,
        startedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await updateDoc(userRef, {
        subscriptionTier: tier,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      id: uid,
      userId: uid,
      plan,
      status,
      isSimulated: true,
      startedAt: existingSnap.exists()
        ? tsToMillis(existingSnap.data().startedAt)
        : Date.now(),
      updatedAt: Date.now(),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `subscriptions/${uid}`);
  }
}

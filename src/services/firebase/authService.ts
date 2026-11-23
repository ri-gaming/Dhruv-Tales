import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { LanguageCode, PlaybackFormat, UserProfile } from '../../types';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from './config';

export const BOOTSTRAP_ADMIN_EMAIL = 'vaishushroff@gmail.com';

export function computeInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'DT';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export async function signInWithGoogleAccount(): Promise<User> {
  const cred = await signInWithPopup(auth, googleProvider);
  return cred.user;
}

export async function signInWithEmail(email: string, password: string): Promise<User> {
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  return cred.user;
}

export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<User> {
  const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
  const safeName = displayName.trim().slice(0, 80) || 'Listener';
  await updateProfile(cred.user, { displayName: safeName });
  try {
    await sendEmailVerification(cred.user);
  } catch (err) {
    console.warn('Verification email could not be dispatched:', err);
  }
  return cred.user;
}

export async function resendVerificationEmail(user: User): Promise<void> {
  await sendEmailVerification(user);
}

export async function signOutAccount(): Promise<void> {
  await signOut(auth);
}

/**
 * Fetches or creates the user's Firestore profile document (`users/{uid}`).
 * Only writes to Firestore when `user.emailVerified === true` to strictly honor
 * our hardened Firestore security rules.
 */
export async function syncUserProfile(
  user: User,
  defaultLanguage: LanguageCode
): Promise<UserProfile> {
  const displayName = (user.displayName || user.email?.split('@')[0] || 'Listener').slice(0, 80);
  const isBootstrapAdmin =
    user.emailVerified && user.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL;

  const fallbackProfile: UserProfile = {
    uid: user.uid,
    email: user.email || 'unknown@dhruvtales.app',
    displayName,
    bio: '',
    preferredLanguage: defaultLanguage,
    preferredFormat: 'audio',
    role: isBootstrapAdmin ? 'admin' : 'user',
    subscriptionTier: 'free',
    avatarInitials: computeInitials(displayName),
  };

  const userRef = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(userRef);
    if (snap.exists()) {
      const data = snap.data() as UserProfile;
      return {
        ...data,
        preferredFormat: data.preferredFormat === 'video' ? 'video' : 'audio',
        role: isBootstrapAdmin ? 'admin' : data.role,
      };
    }

    if (!user.emailVerified) {
      return fallbackProfile;
    }

    await setDoc(userRef, {
      uid: user.uid,
      email: fallbackProfile.email.slice(0, 200),
      displayName: fallbackProfile.displayName,
      bio: '',
      preferredLanguage: defaultLanguage,
      preferredFormat: 'audio',
      role: 'user',
      subscriptionTier: 'free',
      avatarInitials: fallbackProfile.avatarInitials,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return fallbackProfile;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}`);
  }
}

export async function updateUserProfileRecord(
  uid: string,
  updates: {
    displayName: string;
    bio: string;
    preferredLanguage: LanguageCode;
    preferredFormat?: PlaybackFormat;
  }
): Promise<void> {
  const safeName = updates.displayName.trim().slice(0, 80);
  const safeBio = updates.bio.trim().slice(0, 300);
  const avatarInitials = computeInitials(safeName);

  const userRef = doc(db, 'users', uid);
  try {
    const payload: Record<string, unknown> = {
      displayName: safeName,
      bio: safeBio,
      preferredLanguage: updates.preferredLanguage,
      avatarInitials,
      updatedAt: serverTimestamp(),
    };
    if (updates.preferredFormat === 'audio' || updates.preferredFormat === 'video') {
      payload.preferredFormat = updates.preferredFormat;
    }
    await updateDoc(userRef, payload);
    if (auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: safeName });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function updateUserPreferredFormat(
  uid: string,
  preferredFormat: PlaybackFormat
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  try {
    const snap = await getDoc(userRef);
    if (!snap.exists()) return;
    await updateDoc(userRef, {
      preferredFormat,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

/**
 * Deletes the user's personal Firestore records (profile, history, bookmarks,
 * daily unlocks, interactive choices, mock subscription) and removes their Firebase Auth account.
 */
export async function deleteAccountAndData(user: User): Promise<void> {
  const uid = user.uid;
  try {
    const userCollections = ['listeningHistory', 'bookmarks', 'dailyUnlocks', 'userChoices'];
    const batch = writeBatch(db);

    for (const colName of userCollections) {
      const snap = await getDocs(
        query(collection(db, colName), where('userId', '==', uid))
      );
      snap.docs.forEach((d) => batch.delete(d.ref));
    }

    const subRef = doc(db, 'subscriptions', uid);
    const subSnap = await getDoc(subRef);
    if (subSnap.exists()) {
      batch.delete(subRef);
    }

    await batch.commit();

    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      await deleteDoc(userRef);
    }

    await deleteUser(user);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `users/${uid}`);
  }
}

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import type { Category, Creator, Episode, Story } from '../../types';
import { db, handleFirestoreError, OperationType } from './config';
import {
  SEED_CATEGORIES,
  SEED_CREATORS,
  SEED_EPISODES,
  SEED_STORIES,
} from './seedData';

export interface CatalogBundle {
  categories: Category[];
  creators: Creator[];
  stories: Story[];
  episodes: Episode[];
  source: 'firestore' | 'seed-fallback';
}

function timestampToIso(val: unknown, fallback: string): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string') {
    return val;
  }
  return fallback;
}

/**
 * Loads the story catalog using plain Firestore queries (zero AI).
 * If Cloud Firestore has not been seeded yet, gracefully returns the local seed
 * catalog and tags `source: 'seed-fallback'` so the UI stays 100% functional
 * and transparent.
 */
export async function fetchCatalog(): Promise<CatalogBundle> {
  try {
    const [catSnap, creatorSnap, storySnap, epSnap] = await Promise.all([
      getDocs(query(collection(db, 'categories'), where('isActive', '==', true))),
      getDocs(query(collection(db, 'creators'), where('followersCount', '>=', 0))),
      getDocs(query(collection(db, 'stories'), where('visibility', '==', 'published'))),
      getDocs(query(collection(db, 'episodes'), where('episodeNumber', '>=', 1))),
    ]);

    if (storySnap.empty) {
      return {
        categories: SEED_CATEGORIES,
        creators: SEED_CREATORS,
        stories: SEED_STORIES,
        episodes: SEED_EPISODES,
        source: 'seed-fallback',
      };
    }

    const categories: Category[] = catSnap.docs
      .map((d) => d.data() as Category)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const creators: Creator[] = creatorSnap.docs.map((d) => d.data() as Creator);

    const seedStoriesById = new Map(SEED_STORIES.map((s) => [s.id, s]));
    const seedEpisodesById = new Map(SEED_EPISODES.map((e) => [e.id, e]));

    const stories: Story[] = storySnap.docs.map((d) => {
      const raw = d.data() as Story;
      const seedMatch = seedStoriesById.get(raw.id);
      const base: Story = {
        ...raw,
        publishedAt: timestampToIso(raw.publishedAt, new Date().toISOString()),
        createdAt: timestampToIso(raw.createdAt, new Date().toISOString()),
        updatedAt: timestampToIso(raw.updatedAt, new Date().toISOString()),
      };
      if (seedMatch?.isInteractive) {
        return {
          ...base,
          format: seedMatch.format,
          isInteractive: true,
          episodeCount: Math.max(base.episodeCount, seedMatch.episodeCount),
        };
      }
      return base;
    });

    const firestoreEpisodeIds = new Set<string>();
    const episodes: Episode[] = epSnap.docs.map((d) => {
      const raw = d.data() as Episode;
      firestoreEpisodeIds.add(raw.id);
      const seedMatch = seedEpisodesById.get(raw.id);
      const base: Episode = {
        ...raw,
        publishedAt: timestampToIso(raw.publishedAt, new Date().toISOString()),
        createdAt: timestampToIso(raw.createdAt, new Date().toISOString()),
      };
      if (seedMatch && (seedMatch.choicePoint || seedMatch.isEnding || seedMatch.videoMediaRef)) {
        return {
          ...base,
          accessTier: seedMatch.accessTier,
          durationSec: base.choicePoint ? base.durationSec : seedMatch.durationSec,
          audioRef: base.audioRef ?? seedMatch.audioRef,
          videoMediaRef: base.videoMediaRef ?? seedMatch.videoMediaRef,
          choicePoint: base.choicePoint ?? seedMatch.choicePoint,
          isEnding: base.isEnding ?? seedMatch.isEnding,
        };
      }
      return base;
    });

    // Include newly added Phase 3 branching episodes for interactive seed stories if not yet re-seeded in Firestore
    for (const seedEp of SEED_EPISODES) {
      if (!firestoreEpisodeIds.has(seedEp.id) && seedStoriesById.get(seedEp.storyId)?.isInteractive) {
        episodes.push(seedEp);
      }
    }

    episodes.sort((a, b) => a.episodeNumber - b.episodeNumber);

    return {
      categories: categories.length > 0 ? categories : SEED_CATEGORIES,
      creators: creators.length > 0 ? creators : SEED_CREATORS,
      stories,
      episodes,
      source: 'firestore',
    };
  } catch (error) {
    console.warn('Firestore catalog read failed, falling back to local seed catalog:', error);
    return {
      categories: SEED_CATEGORIES,
      creators: SEED_CREATORS,
      stories: SEED_STORIES,
      episodes: SEED_EPISODES,
      source: 'seed-fallback',
    };
  }
}

export interface SeedResult {
  categoriesWritten: number;
  creatorsWritten: number;
  storiesWritten: number;
  episodesWritten: number;
  skippedExisting: number;
}

/**
 * Admin-only Firestore seeder.
 * Writes all 8 categories, 6 creators, 12 stories (including 2 interactive branching
 * stories), and 70 episodes into Cloud Firestore strictly respecting firestore.rules.
 * Re-running upgrades existing seed stories/episodes with Phase 3 interactive metadata.
 */
export async function seedFirestoreCatalog(adminUid: string): Promise<SeedResult> {
  const result: SeedResult = {
    categoriesWritten: 0,
    creatorsWritten: 0,
    storiesWritten: 0,
    episodesWritten: 0,
    skippedExisting: 0,
  };

  try {
    const batch = writeBatch(db);

    for (const cat of SEED_CATEGORIES) {
      const ref = doc(db, 'categories', cat.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        result.skippedExisting += 1;
        continue;
      }
      batch.set(ref, {
        id: cat.id,
        slug: cat.slug,
        nameEn: cat.nameEn,
        nameHi: cat.nameHi,
        descriptionEn: cat.descriptionEn ?? '',
        descriptionHi: cat.descriptionHi ?? '',
        accentHex: cat.accentHex ?? '#E5A93C',
        sortOrder: cat.sortOrder,
        isActive: cat.isActive,
      });
      result.categoriesWritten += 1;
    }

    for (const creator of SEED_CREATORS) {
      const ref = doc(db, 'creators', creator.id);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        result.skippedExisting += 1;
        continue;
      }
      batch.set(ref, {
        id: creator.id,
        ownerUid: adminUid,
        name: creator.name,
        handle: creator.handle,
        bioEn: creator.bioEn ?? '',
        bioHi: creator.bioHi ?? '',
        language: creator.language,
        followersCount: creator.followersCount,
        storiesCount: creator.storiesCount,
        verified: creator.verified,
        accentPalette: creator.accentPalette ?? '#E5A93C',
      });
      result.creatorsWritten += 1;
    }

    for (const story of SEED_STORIES) {
      const ref = doc(db, 'stories', story.id);
      const snap = await getDoc(ref);
      const existingData = snap.exists() ? snap.data() : null;
      const needsInteractiveUpgrade =
        existingData &&
        (existingData.episodeCount !== story.episodeCount ||
          existingData.format !== story.format ||
          existingData.isInteractive !== story.isInteractive);

      if (existingData && !needsInteractiveUpgrade) {
        result.skippedExisting += 1;
        continue;
      }

      const payload: Record<string, unknown> = {
        id: story.id,
        slug: story.slug,
        title: story.title,
        titleHi: story.titleHi,
        synopsis: story.synopsis,
        synopsisHi: story.synopsisHi,
        genreId: story.genreId,
        language: story.language,
        creatorId: story.creatorId,
        creatorOwnerUid: existingData?.creatorOwnerUid ?? adminUid,
        creatorName: story.creatorName,
        coverTheme: story.coverTheme,
        rating: story.rating,
        totalPlays: story.totalPlays,
        episodeCount: story.episodeCount,
        isTrending: story.isTrending,
        isEditorsPick: story.isEditorsPick,
        isPopular: story.isPopular,
        isFeatured: story.isFeatured,
        visibility: story.visibility,
        format: story.format,
        isInteractive: story.isInteractive,
        publishedAt: Timestamp.fromDate(new Date(story.publishedAt)),
        createdAt: existingData?.createdAt ?? serverTimestamp(),
        updatedAt: serverTimestamp(),
      };
      if (story.coverUrl) payload.coverUrl = story.coverUrl;
      if (story.backdropUrl) payload.backdropUrl = story.backdropUrl;
      batch.set(ref, payload);
      result.storiesWritten += 1;
    }

    for (const ep of SEED_EPISODES) {
      const ref = doc(db, 'episodes', ep.id);
      const snap = await getDoc(ref);
      const existingData = snap.exists() ? snap.data() : null;
      const needsPhase3Upgrade =
        existingData &&
        ((ep.choicePoint && !existingData.choicePoint) ||
          (ep.videoMediaRef && !existingData.videoMediaRef) ||
          (ep.isEnding && !existingData.isEnding) ||
          existingData.accessTier !== ep.accessTier);

      if (existingData && !needsPhase3Upgrade) {
        result.skippedExisting += 1;
        continue;
      }

      const payload: Record<string, unknown> = {
        id: ep.id,
        storyId: ep.storyId,
        creatorOwnerUid: existingData?.creatorOwnerUid ?? adminUid,
        episodeNumber: ep.episodeNumber,
        title: ep.title,
        titleHi: ep.titleHi,
        description: ep.description ?? '',
        descriptionHi: ep.descriptionHi ?? '',
        durationSec: ep.durationSec,
        accessTier: ep.accessTier,
        dailyUnlockOrder: ep.dailyUnlockOrder ?? 0,
        mediaRef: ep.mediaRef,
        publishedAt: Timestamp.fromDate(new Date(ep.publishedAt)),
        createdAt: existingData?.createdAt ?? serverTimestamp(),
      };
      if (ep.audioRef) {
        payload.audioRef = ep.audioRef;
      }
      if (ep.videoMediaRef) {
        payload.videoMediaRef = ep.videoMediaRef;
      }
      if (ep.choicePoint) {
        payload.choicePoint = ep.choicePoint;
      }
      if (typeof ep.isEnding === 'boolean') {
        payload.isEnding = ep.isEnding;
      }
      batch.set(ref, payload);
      result.episodesWritten += 1;
    }

    await batch.commit();
    return result;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'stories/episodes/categories/creators');
  }
}

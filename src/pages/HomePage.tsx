import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, Sparkles } from 'lucide-react';
import { StoryArtwork } from '../components/StoryArtwork';
import { StoryCarousel } from '../components/StoryCarousel';
import { useAudioPlayer } from '../hooks/useAudioPlayer';
import { useAppData } from '../hooks/useAuthAndActivity';
import { useLanguage } from '../hooks/useLanguage';
import { formatPlayCount } from '../services/access/episodeAccess';
import type { Category, ListeningHistoryEntry } from '../types';

const HomeSkeleton: React.FC = () => (
  <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-12 animate-pulse">
    <div className="h-[360px] sm:h-[440px] rounded-2xl bg-[#141418] border border-white/5" />
    <div className="space-y-4">
      <div className="h-7 w-48 rounded bg-[#1C1C22]" />
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div key={idx} className="space-y-3">
            <div className="aspect-[3/4] rounded-xl bg-[#141418]" />
            <div className="h-4 w-3/4 rounded bg-[#1C1C22]" />
            <div className="h-3 w-1/2 rounded bg-[#141418]" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

export const HomePage: React.FC = () => {
  const { lang, t } = useLanguage();
  const {
    categories,
    stories,
    episodes,
    history,
    catalogSource,
    catalogLoading,
  } = useAppData();
  const { playEpisode } = useAudioPlayer();

  const categoriesById = useMemo(() => {
    const map: Record<string, Category> = {};
    categories.forEach((c) => {
      map[c.id] = c;
    });
    return map;
  }, [categories]);

  const progressByStoryId = useMemo(() => {
    const map: Record<string, ListeningHistoryEntry> = {};
    // history is already sorted by updatedAt desc
    for (const item of history) {
      if (!map[item.storyId]) {
        map[item.storyId] = item;
      }
    }
    return map;
  }, [history]);

  const featuredStory = useMemo(
    () => stories.find((s) => s.isFeatured) ?? stories[0] ?? null,
    [stories]
  );

  const continueListeningStories = useMemo(() => {
    const seen = new Set<string>();
    const list = [];
    for (const item of history) {
      if (seen.has(item.storyId)) continue;
      const story = stories.find((s) => s.id === item.storyId);
      if (story) {
        seen.add(story.id);
        list.push(story);
      }
    }
    return list;
  }, [history, stories]);

  const trendingStories = useMemo(() => stories.filter((s) => s.isTrending), [stories]);
  const editorsPicks = useMemo(() => stories.filter((s) => s.isEditorsPick), [stories]);
  const popularStories = useMemo(
    () => [...stories].sort((a, b) => b.totalPlays - a.totalPlays).slice(0, 8),
    [stories]
  );
  const recentStories = useMemo(
    () =>
      [...stories]
        .sort((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt))
        .slice(0, 8),
    [stories]
  );

  if (catalogLoading && stories.length === 0) {
    return <HomeSkeleton />;
  }

  const handlePlayFeatured = () => {
    if (!featuredStory) return;
    const saved = progressByStoryId[featuredStory.id];
    const storyEps = episodes
      .filter((e) => e.storyId === featuredStory.id)
      .sort((a, b) => a.episodeNumber - b.episodeNumber);
    const targetEp =
      (saved && storyEps.find((e) => e.id === saved.episodeId)) || storyEps[0];
    if (targetEp) {
      void playEpisode(featuredStory, targetEp);
    }
  };

  const featuredGenre = featuredStory ? categoriesById[featuredStory.genreId] : undefined;
  const featuredProgress = featuredStory ? progressByStoryId[featuredStory.id] : undefined;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-12 sm:space-y-14">
      {/* Hero Banner for Featured Story */}
      {featuredStory && (
        <section
          aria-label={t('home.featuredLabel')}
          className="relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#141418] min-h-[380px] sm:min-h-[450px] flex items-end"
        >
          <div className="absolute inset-0">
            <StoryArtwork
              story={featuredStory}
              aspect="landscape"
              useBackdrop
              className="w-full h-full aspect-auto"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0B0B0E] via-[#0B0B0E]/65 to-[#0B0B0E]/20 sm:bg-gradient-to-r sm:from-[#0B0B0E] sm:via-[#0B0B0E]/82 sm:to-transparent" />
          </div>

          <div className="relative z-10 w-full max-w-2xl p-6 sm:p-10 lg:p-12 space-y-4">
            <p className="text-xs font-medium text-[#E5A93C] tracking-wide">
              {t('home.featuredLabel')} ·{' '}
              {featuredGenre
                ? lang === 'hi'
                  ? featuredGenre.nameHi
                  : featuredGenre.nameEn
                : featuredStory.genreId}
            </p>

            <h1 className="font-display text-3xl sm:text-5xl font-semibold text-[#F5F3EE] leading-[1.1] text-balance">
              {lang === 'hi' ? featuredStory.titleHi : featuredStory.title}
            </h1>

            <p className="text-sm sm:text-base text-[#D6D2C9] leading-relaxed line-clamp-3 max-w-xl">
              {lang === 'hi' ? featuredStory.synopsisHi : featuredStory.synopsis}
            </p>

            {/* Unboxed metadata row */}
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#A39E93] tabular-nums">
              <span className="text-[#F5F3EE] font-medium">{featuredStory.creatorName}</span>
              <span aria-hidden="true">·</span>
              <span>
                {featuredStory.language === 'hi'
                  ? t('common.hindi')
                  : featuredStory.language === 'en'
                    ? t('common.english')
                    : t('common.bilingual')}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                {featuredStory.episodeCount} {t('common.episodes')}
              </span>
              <span aria-hidden="true">·</span>
              <span>★ {featuredStory.rating.toFixed(1)}</span>
              <span aria-hidden="true">·</span>
              <span>
                {formatPlayCount(featuredStory.totalPlays)} {t('common.plays')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handlePlayFeatured}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-[#E5A93C] text-[#0B0B0E] text-sm font-semibold hover:bg-[#F3C669] transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                <Play className="w-4 h-4 fill-current" aria-hidden="true" />
                {featuredProgress
                  ? `${t('home.resumeListening')} ${featuredProgress.episodeNumber}`
                  : t('home.listenNow')}
              </button>

              <Link
                to={`/story/${featuredStory.id}`}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#141418]/85 border border-white/15 text-sm font-medium text-[#F5F3EE] hover:border-white/35 transition-colors inline-flex items-center gap-2 whitespace-nowrap"
              >
                {t('home.viewDetails')}
                <ArrowRight className="w-4 h-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Continue Listening (shown when listening history exists) */}
      {continueListeningStories.length > 0 && (
        <StoryCarousel
          title={t('home.continueListening')}
          stories={continueListeningStories}
          categoriesById={categoriesById}
          progressByStoryId={progressByStoryId}
          seeAllTo="/library"
        />
      )}

      {/* Genres Row */}
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-[#F5F3EE]">
            {t('home.browseGenres')}
          </h2>
          <Link
            to="/search"
            className="text-xs font-medium text-[#E5A93C] hover:text-[#F3C669] transition-colors whitespace-nowrap"
          >
            {t('common.seeAll')}
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
          {categories.map((cat) => {
            const count = stories.filter((s) => s.genreId === cat.id).length;
            return (
              <Link
                key={cat.id}
                to={`/search?genre=${cat.id}`}
                className="group min-h-[68px] p-3.5 rounded-xl bg-[#141418] border border-white/[0.08] hover:border-[#E5A93C]/45 transition-colors flex flex-col justify-between"
              >
                <span className="text-sm font-medium text-[#F5F3EE] group-hover:text-[#F3C669] transition-colors truncate">
                  {lang === 'hi' ? cat.nameHi : cat.nameEn}
                </span>
                <span className="text-[11px] text-[#8A857B] tabular-nums mt-1">
                  {count} {lang === 'hi' ? 'कहानियाँ' : 'series'}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Trending Now */}
      <StoryCarousel
        title={t('home.trendingNow')}
        stories={trendingStories}
        categoriesById={categoriesById}
        progressByStoryId={progressByStoryId}
        seeAllTo="/search?sort=popular"
      />

      {/* Editor's Picks */}
      <StoryCarousel
        title={t('home.editorsPicks')}
        stories={editorsPicks}
        categoriesById={categoriesById}
        progressByStoryId={progressByStoryId}
        seeAllTo="/search?sort=rating"
      />

      {/* Popular Stories */}
      <StoryCarousel
        title={t('home.popularStories')}
        stories={popularStories}
        categoriesById={categoriesById}
        progressByStoryId={progressByStoryId}
        seeAllTo="/search?sort=popular"
      />

      {/* Recently Added */}
      <StoryCarousel
        title={t('home.recentlyAdded')}
        stories={recentStories}
        categoriesById={categoriesById}
        progressByStoryId={progressByStoryId}
        seeAllTo="/search?sort=recent"
      />

      {/* Quiet Editorial Footer with Real vs Simulated Transparency */}
      <footer className="border-t border-white/[0.08] pt-8 pb-4 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div className="space-y-1.5 max-w-xl">
            <h2 className="font-display text-lg font-semibold text-[#F5F3EE]">
              {t('home.transparencyTitle')}
            </h2>
            <p className="text-xs text-[#A39E93] leading-relaxed">
              {t('home.transparencySubtitle')}
            </p>
            <p className="text-xs text-[#8A857B] pt-1">
              Catalog source:{' '}
              <span className="text-[#F5F3EE]">
                {catalogSource === 'firestore'
                  ? t('home.catalogSourceFirestore')
                  : t('home.catalogSourceLocal')}
              </span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs shrink-0">
            <div className="rounded-xl bg-[#141418] border border-white/[0.08] p-4 space-y-1.5">
              <p className="font-semibold text-[#E5A93C]">{t('common.realBadge')}</p>
              <p className="text-[#A39E93] leading-relaxed">
                Firebase Auth (Google + Email/Password), Cloud Firestore catalog, RBAC security rules, listening progress (saved every 10s &amp; on pause/exit), interactive story choices (userChoices), preferred Audio/Video format, bookmarks, follows, and daily unlocks.
              </p>
            </div>
            <div className="rounded-xl bg-[#141418] border border-white/[0.08] p-4 space-y-1.5">
              <p className="font-semibold text-[#A39E93] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#A39E93]" aria-hidden="true" />
                {t('common.simulatedBadge')}
              </p>
              <p className="text-[#A39E93] leading-relaxed">
                DemoMediaProvider audio &amp; video streams (in-browser WAV, public sample MP4s &amp; local files; Drive/YouTube/GCS adapters stubbed) and mock subscription checkout UI.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

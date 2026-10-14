import type { ImdbTitle, UserTitle } from '@/utils/imdb'
import { fetchUserTitles, fetchWatchlist } from '@/utils/imdb'
import type { TmdbIds } from '@/utils/wikidata'
import { fetchTmdbIdsByImdbId } from '@/utils/wikidata'
import type { ExportResult, OnStep } from './export'

export type Step = 'ratings' | 'watched' | 'watchlist' | 'tmdb'

/** The IMDb ID to look up on Wikidata: the series of an episode, the title itself otherwise. */
function lookupId(item: ImdbTitle) {
  return item.type === 'episode' ? item.seriesImdbId : item.imdbId
}

/** Whether Wikidata has the TMDB ID that `withTmdbId` adds. */
function hasTmdbId(item: ImdbTitle, tmdbIds: Map<string, TmdbIds>) {
  const ids = tmdbIds.get(lookupId(item))
  return item.type === 'episode' ? ids?.tv != null : ids?.movie != null || ids?.tv != null
}

/**
 * Adds the TMDB ID to a title, or the TMDB ID of its series to an episode as
 * `seriesTmdbId`. The ID is `null` when Wikidata does not have it.
 * `tmdbIdMatchedBy` is `imdbId` when it has, since that is the only lookup.
 */
function withTmdbId<T extends ImdbTitle>(item: T, tmdbIds: Map<string, TmdbIds>) {
  if (item.type === 'episode') {
    const seriesTmdbId = tmdbIds.get(item.seriesImdbId)?.tv ?? null
    return {
      ...item,
      seriesTmdbId,
      tmdbIdMatchedBy: seriesTmdbId != null ? ('imdbId' as const) : null,
    }
  }

  const ids = tmdbIds.get(item.imdbId)
  let type = item.type
  let tmdbId = type === 'series' ? ids?.tv : ids?.movie
  // Wikidata has the title only as the other type, so we use that type.
  if (tmdbId == null && ids?.movie != null) {
    type = 'film'
    tmdbId = ids.movie
  }
  if (tmdbId == null && ids?.tv != null) {
    type = 'series'
    tmdbId = ids.tv
  }
  return {
    ...item,
    type,
    tmdbId: tmdbId ?? null,
    tmdbIdMatchedBy: tmdbId != null ? ('imdbId' as const) : null,
  }
}

/** Fetches the library of the user from IMDb and the TMDB IDs from Wikidata. */
export async function exportLibrary(
  _account: string | null,
  onStep: OnStep<Step>,
  signal: AbortSignal
): Promise<ExportResult> {
  /** Starts a step and returns the function that shows its progress. */
  function startStep(step: Step) {
    onStep(step, 'active')
    return (itemCount: number, total: number) => onStep(step, 'active', `${itemCount} of ${total}`)
  }

  const rated = await fetchUserTitles('ratings', startStep('ratings'), signal)
  onStep('ratings', 'done', String(rated.length))

  const watched = await fetchUserTitles('watched', startStep('watched'), signal)
  onStep('watched', 'done', String(watched.length))

  const watchlist = await fetchWatchlist(startStep('watchlist'), signal)
  onStep('watchlist', 'done', String(watchlist.length))

  startStep('tmdb')
  // An episode stands for its series here, since the series is what gets a TMDB ID.
  const titles = new Map<string, ImdbTitle>(
    [...rated, ...watched, ...watchlist].map((item) => [lookupId(item), item])
  )
  const tmdbIds = await fetchTmdbIdsByImdbId([...titles.keys()], signal)

  // A rating marks the title as watched at the same moment, so the watch history repeats
  // the rating date. A title is seen on its own date only when it has no rating, or when
  // it was marked as watched at another time than it was rated.
  const userTitles = new Map<string, UserTitle>(
    [...rated, ...watched].map((item) => [item.imdbId, item])
  )
  const seen = [...userTitles.values()].filter(
    (item) => item.firstWatched != null && item.firstWatched !== item.ratingDate
  )

  const toRecord = ({ rating, ratingDate, firstWatched, ...item }: UserTitle) => item
  return {
    library: {
      ratings: rated.map((item) =>
        withTmdbId({ ...toRecord(item), date: item.ratingDate, rating: item.rating }, tmdbIds)
      ),
      seen: seen.map((item) => withTmdbId({ ...toRecord(item), date: item.firstWatched }, tmdbIds)),
      watchlist: watchlist.map((item) => withTmdbId(item, tmdbIds)),
    },
    missing: [...titles.values()]
      .filter((item) => !hasTmdbId(item, tmdbIds))
      .map((item) =>
        item.type === 'episode'
          ? { title: item.seriesTitle, year: null }
          : { title: item.originalTitle ?? item.title, year: item.year }
      ),
  }
}

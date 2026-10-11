import type { DiaryEntry, LetterboxdFilm, TmdbFilmPageId } from '@/utils/letterboxd'
import {
  fetchList,
  fetchTmdbIdFromFilmPage,
  fetchUsername,
  fetchWatchlistDates,
  parseDiaryPage,
  parseWatchedPage,
  parseWatchlistPage,
} from '@/utils/letterboxd'
import { fetchTmdbIdsByLetterboxdSlug } from '@/utils/wikidata'
import type { ExportResult, OnStep } from './export'

export type Step = 'diary' | 'films' | 'watchlist' | 'tmdb'

/**
 * Adds the TMDB ID to a film. `tmdbId` is `null` when neither Wikidata nor the
 * film page has it. `tmdbIdMatchedBy` is where it is from: `letterboxdSlug`
 * for Wikidata, `filmPage` for the film page on Letterboxd.
 */
function withTmdbId<T extends LetterboxdFilm>(
  item: T,
  tmdbIds: Map<string, TmdbFilmPageId & { fromFilmPage?: boolean }>
) {
  const ids = tmdbIds.get(item.letterboxdSlug)
  const tmdbId = ids?.movie ?? ids?.tv ?? null
  let tmdbIdMatchedBy: 'letterboxdSlug' | 'filmPage' | null = null
  if (tmdbId != null) tmdbIdMatchedBy = ids?.fromFilmPage ? 'filmPage' : 'letterboxdSlug'
  return {
    ...item,
    type: ids?.movie == null && ids?.tv != null ? ('series' as const) : ('film' as const),
    tmdbId,
    tmdbIdMatchedBy,
  }
}

/** Fetches the library of the user from Letterboxd and the TMDB IDs from Wikidata. */
export async function exportLibrary(
  username: string | null,
  onStep: OnStep<Step>,
  signal: AbortSignal
): Promise<ExportResult> {
  /** Starts a step and returns the function that shows its progress. */
  function startStep(step: Step) {
    onStep(step, 'active')
    return (page: number, pageCount: number) =>
      onStep(step, 'active', `page ${page} of ${pageCount}`)
  }

  const onDiaryProgress = startStep('diary')
  username ??= await fetchUsername(signal)
  const diary = await fetchList(username, 'diary/films/', parseDiaryPage, onDiaryProgress, signal)
  onStep('diary', 'done', String(diary.length))

  // The large grid shows the rating with the time it was set. The small grid has no time.
  const films = await fetchList(
    username,
    'films/size/large/',
    parseWatchedPage,
    startStep('films'),
    signal
  )
  onStep('films', 'done', String(films.length))

  const watchlistFilms = await fetchList(
    username,
    'watchlist/',
    parseWatchlistPage,
    startStep('watchlist'),
    signal
  )
  const watchlistDates = await fetchWatchlistDates(username, signal)
  onStep('watchlist', 'done', String(watchlistFilms.length))

  onStep('tmdb', 'active')
  const allFilms = new Map(
    [...diary, ...films, ...watchlistFilms].map((film) => [film.letterboxdSlug, film])
  )
  const tmdbIds: Map<string, TmdbFilmPageId & { fromFilmPage?: boolean }> =
    await fetchTmdbIdsByLetterboxdSlug([...allFilms.keys()], signal)

  const hasNoTmdbId = (film: LetterboxdFilm) => {
    const ids = tmdbIds.get(film.letterboxdSlug)
    return ids?.movie == null && ids?.tv == null
  }
  const filmsToLookUpOnPage = [...allFilms.values()].filter(hasNoTmdbId)
  for (const [index, film] of filmsToLookUpOnPage.entries()) {
    onStep('tmdb', 'active', `${index + 1} of ${filmsToLookUpOnPage.length} from film pages`)
    const ids = await fetchTmdbIdFromFilmPage(film.letterboxdSlug, signal)
    if (ids.movie != null || ids.tv != null) {
      tmdbIds.set(film.letterboxdSlug, { ...ids, fromFilmPage: true })
    }
  }

  // The diary is newest first, so the first entry of a film with a rating is its latest rating.
  const diarySlugs = new Set(diary.map((entry) => entry.letterboxdSlug))
  const latestDiaryRatings = new Map<string, number>()
  for (const entry of diary) {
    if (entry.rating != null && !latestDiaryRatings.has(entry.letterboxdSlug)) {
      latestDiaryRatings.set(entry.letterboxdSlug, entry.rating)
    }
  }

  // A rating that is not the latest one in the diary was set or changed outside the diary.
  const ratingsOutsideDiary = films.filter(
    (film) => film.rating != null && latestDiaryRatings.get(film.letterboxdSlug) !== film.rating
  )
  const seen = films.filter((film) => film.rating == null && !diarySlugs.has(film.letterboxdSlug))
  const ratedInDiary = (entry: DiaryEntry) => entry.rating != null

  return {
    library: {
      ratings: [...diary.filter(ratedInDiary), ...ratingsOutsideDiary].map((item) =>
        withTmdbId(item, tmdbIds)
      ),
      watches: diary
        .filter((entry) => !ratedInDiary(entry))
        .map(({ rating, ...entry }) => withTmdbId(entry, tmdbIds)),
      seen: seen.map(({ rating, ...film }) => withTmdbId({ ...film, date: null }, tmdbIds)),
      watchlist: watchlistFilms.map((film) =>
        withTmdbId({ ...film, date: watchlistDates.get(film.letterboxdId) ?? null }, tmdbIds)
      ),
    },
    missing: [...allFilms.values()]
      .filter(hasNoTmdbId)
      .map((film) => ({ title: film.title, year: film.year })),
  }
}

type BaseTitle = {
  /** The ID from the title's link: `tt0816692` for https://www.imdb.com/title/tt0816692/. */
  imdbId: string
  /** The title in the language of the IMDb account. */
  title: string
  originalTitle: string | null
  year: number | null
}

export type ImdbEpisode = BaseTitle & {
  type: 'episode'
  seriesImdbId: string
  seriesTitle: string
  /** `null` for an episode that IMDb has not put in a season. */
  seasonNumber: number | null
  episodeNumber: number | null
}

export type ImdbTitle = (BaseTitle & { type: 'film' | 'series' }) | ImdbEpisode

/** A title from the ratings or the watch history, with the user's data for it. */
export type UserTitle = ImdbTitle & {
  /** 1–10. `null` for a title with no rating. */
  rating: number | null
  /** When the title was rated, as an ISO timestamp. `null` when IMDb has no date for it. */
  ratingDate: string | null
  /** When the title was first marked as watched, or rated, as an ISO timestamp. */
  firstWatched: string | null
}

export type WatchlistTitle = ImdbTitle & {
  /** When the title was added to the watchlist, as an ISO timestamp. */
  date: string | null
}

type RawTitle = {
  id: string
  titleText: { text: string } | null
  originalTitleText: { text: string } | null
  titleType: { id: string; canHaveEpisodes: boolean } | null
  releaseYear: { year: number } | null
  series: {
    series: { id: string; titleText: { text: string } | null } | null
    episodeNumber: { seasonNumber: number | null; episodeNumber: number | null } | null
  } | null
  userRating: { value: number; date: string } | null
  userWatchedStatus: { isWatched: boolean; firstWatched: string | null } | null
}

type Connection<T> = {
  total: number
  pageInfo: { hasNextPage: boolean; endCursor: string | null }
  edges: T[]
}

type GraphQLError = { message: string; extensions?: { code?: string } }

const API = 'https://api.graphql.imdb.com/'
const PAGE_SIZE = 250
const REQUEST_DELAY_MS = 1500

/** Games and podcasts are not on TMDB, so they are left out. */
const SKIPPED_TYPES = new Set(['videoGame', 'podcastSeries', 'podcastEpisode'])

/**
 * IMDb gives `1970-01-01T01:01:01.001Z` as the date of old ratings it has no
 * date for, so a date on that day means no date.
 */
function toDate(date: string | null | undefined) {
  return date == null || date.startsWith('1970-01-01') ? null : date
}

const TITLE_FIELDS = `
  id
  titleText { text }
  originalTitleText { text }
  titleType { id canHaveEpisodes }
  releaseYear { year }
  series {
    series { id titleText { text } }
    episodeNumber { seasonNumber episodeNumber }
  }
  userRating { value date }
  userWatchedStatus { isWatched firstWatched }
`

function signInError() {
  return new Error('Open imdb.com and sign in, then try again.')
}

/** The API answers a signed-out request for the user's data with one of these errors. */
function isSignInError(error: GraphQLError) {
  return (
    error.extensions?.code === 'UNAUTHENTICATED' ||
    /customer(id)? required|unauthenticated use|authentication required/i.test(error.message)
  )
}

/** Sends a query to the GraphQL API of IMDb with the session cookies of imdb.com. */
async function query<T>(
  text: string,
  variables: Record<string, unknown>,
  signal: AbortSignal
): Promise<T> {
  let response: Response
  try {
    response = await fetch(API, {
      method: 'POST',
      credentials: 'include',
      // The API rejects requests that do not name a client.
      headers: { 'content-type': 'application/json', 'x-imdb-client-name': 'imdb-web-next' },
      body: JSON.stringify({ query: text, variables }),
      signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Could not reach imdb.com. Check your connection, then try again.')
  }

  let json: { data?: T | null; errors?: GraphQLError[] } | null = null
  try {
    json = await response.json()
  } catch {
    // Not JSON, handled below.
  }
  const errors = json?.errors ?? []
  if (errors.some(isSignInError)) throw signInError()
  if (!response.ok || errors.length > 0 || json?.data == null) {
    const detail = errors[0]?.message ?? `error ${response.status}`
    throw new Error(`IMDb returned ${detail}. The extension may need an update.`)
  }

  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
  signal.throwIfAborted()
  return json.data
}

/** `null` for a game or a podcast. */
function toTitle(raw: RawTitle): ImdbTitle | null {
  if (raw.titleType == null || SKIPPED_TYPES.has(raw.titleType.id)) return null
  const base: BaseTitle = {
    imdbId: raw.id,
    title: raw.titleText?.text ?? raw.originalTitleText?.text ?? raw.id,
    originalTitle: raw.originalTitleText?.text ?? null,
    year: raw.releaseYear?.year ?? null,
  }

  const series = raw.series?.series
  if (raw.titleType.id === 'tvEpisode' && series != null) {
    return {
      ...base,
      type: 'episode',
      seriesImdbId: series.id,
      seriesTitle: series.titleText?.text ?? series.id,
      seasonNumber: raw.series?.episodeNumber?.seasonNumber ?? null,
      episodeNumber: raw.series?.episodeNumber?.episodeNumber ?? null,
    }
  }
  return { ...base, type: raw.titleType.canHaveEpisodes ? 'series' : 'film' }
}

function toUserTitle(raw: RawTitle): UserTitle | null {
  const title = toTitle(raw)
  if (title == null) return null
  return {
    ...title,
    rating: raw.userRating?.value ?? null,
    ratingDate: toDate(raw.userRating?.date),
    firstWatched: toDate(raw.userWatchedStatus?.firstWatched),
  }
}

/** Returns the name of the signed-in user. */
export async function fetchUsername(signal: AbortSignal) {
  const data = await query<{
    user: {
      displayName: string | null
      profile: { username: { text: string } | null } | null
    } | null
  }>(`{ user { displayName profile { username { text } } } }`, {}, signal)
  if (data.user == null) throw signInError()
  return data.user.profile?.username?.text ?? data.user.displayName ?? 'your account'
}

/**
 * Fetches the pages of a list one by one until there is no next page.
 * `fetchPage` returns the connection of one page, from the cursor of the last one.
 */
async function fetchAllPages<Edge>(
  fetchPage: (after: string | null) => Promise<Connection<Edge>>,
  onProgress: (itemCount: number, total: number) => void
): Promise<Edge[]> {
  const edges: Edge[] = []
  let after: string | null = null
  for (;;) {
    const page: Connection<Edge> = await fetchPage(after)
    edges.push(...page.edges)
    onProgress(edges.length, Math.max(page.total, edges.length))
    if (!page.pageInfo.hasNextPage || page.edges.length === 0) return edges
    after = page.pageInfo.endCursor
  }
}

/** Fetches the titles the user rated (`ratings`) or marked as watched (`watched`). */
export async function fetchUserTitles(
  list: 'ratings' | 'watched',
  onProgress: (itemCount: number, total: number) => void,
  signal: AbortSignal
): Promise<UserTitle[]> {
  const [constraint, sortBy] =
    list === 'ratings'
      ? ['myRatingConstraint', 'MY_RATING_DATE']
      : ['myWatchedConstraint', 'MY_WATCHED_DATE']
  const edges = await fetchAllPages(async (after) => {
    const data = await query<{
      advancedTitleSearch: Connection<{ node: { title: RawTitle } }>
    }>(
      `query ($first: Int!, $after: String) {
        advancedTitleSearch(
          first: $first
          after: $after
          sort: { sortBy: ${sortBy}, sortOrder: DESC }
          constraints: {
            ${constraint}: { filterType: INCLUDE }
            explicitContentConstraint: { explicitContentFilter: INCLUDE_ADULT }
          }
        ) {
          total
          pageInfo { hasNextPage endCursor }
          edges { node { title { ${TITLE_FIELDS} } } }
        }
      }`,
      { first: PAGE_SIZE, after },
      signal
    )
    return data.advancedTitleSearch
  }, onProgress)
  return edges.map((edge) => toUserTitle(edge.node.title)).filter((title) => title != null)
}

/** Fetches the watchlist with the date each title was added. */
export async function fetchWatchlist(
  onProgress: (itemCount: number, total: number) => void,
  signal: AbortSignal
): Promise<WatchlistTitle[]> {
  const edges = await fetchAllPages(async (after) => {
    const data = await query<{
      predefinedList: {
        titleListItemSearch: Connection<{ node: { createdDate: string | null }; title: RawTitle }>
      } | null
    }>(
      `query ($first: Int!, $after: String) {
        predefinedList(classType: WATCH_LIST) {
          titleListItemSearch(first: $first, after: $after) {
            total
            pageInfo { hasNextPage endCursor }
            edges { node { createdDate } title { ${TITLE_FIELDS} } }
          }
        }
      }`,
      { first: PAGE_SIZE, after },
      signal
    )
    if (data.predefinedList == null) throw signInError()
    return data.predefinedList.titleListItemSearch
  }, onProgress)

  const titles: WatchlistTitle[] = []
  for (const edge of edges) {
    const title = toTitle(edge.title)
    if (title != null) titles.push({ ...title, date: toDate(edge.node.createdDate) })
  }
  return titles
}

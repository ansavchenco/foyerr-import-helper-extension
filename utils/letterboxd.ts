export type LetterboxdFilm = {
  letterboxdSlug: string
  /** The code of the film's short link: `JuhA` for https://boxd.it/JuhA. */
  letterboxdId: string
  title: string
  year: number | null
}

/** One viewing in the diary. A film watched twice has two entries. */
export type DiaryEntry = LetterboxdFilm & {
  /** The day the user watched the film: `2026-09-24`. */
  date: string
  /** 1–10, one point for half a star. `null` for a viewing with no rating. */
  rating: number | null
  rewatch: boolean
}

/** A film from the grid of watched films. */
export type WatchedFilm = LetterboxdFilm & {
  /** When the film was rated, as an ISO timestamp. `null` when the page shows no time. */
  date: string | null
  rating: number | null
}

export type WatchlistFilm = LetterboxdFilm & {
  /** When the film was added to the watchlist, from the watchlist CSV: `2026-10-04`. */
  date: string | null
}

type ParsedPage<T> = {
  items: T[]
  /** The number of pages in the whole list, from the page links. */
  pageCount: number
  hasNextPage: boolean
}

export type TmdbFilmPageId = { movie?: string; tv?: string }

const SITE = 'https://letterboxd.com'
const REQUEST_DELAY_MS = 1500

/** Reads the film from a poster, which has `data-item-slug` and `data-item-name`. */
function parseFilm(poster: Element): LetterboxdFilm | null {
  const slug = poster.getAttribute('data-item-slug')
  const identifier = poster.getAttribute('data-postered-identifier')
  if (slug == null || identifier == null) return null

  let letterboxdId: unknown
  try {
    letterboxdId = JSON.parse(identifier).lid
  } catch {
    return null
  }
  if (typeof letterboxdId !== 'string') return null

  // "Send Help (2026)" or a title with no year
  const name = poster.getAttribute('data-item-name') ?? ''
  const withYear = /^(.*) \((\d{4})\)$/.exec(name)
  return {
    letterboxdSlug: slug,
    letterboxdId,
    title: withYear?.[1] ?? name,
    year: withYear ? Number(withYear[2]) : null,
  }
}

/** Reads 7 from the `rated-7` class. `null` for no rating. */
function parseRatingClass(element: Element | null | undefined) {
  const rating = /\brated-(\d+)\b/.exec(element?.className ?? '')
  return rating ? toRating(Number(rating[1])) : null
}

function toRating(value: number) {
  return value >= 1 && value <= 10 ? value : null
}

function parsePaging(page: Document) {
  const pageNumbers = [...page.querySelectorAll('.paginate-page')].map((item) =>
    Number(item.textContent?.trim())
  )
  return {
    pageCount: Math.max(1, ...pageNumbers.filter(Number.isFinite)),
    hasNextPage: page.querySelector('.pagination a.next') != null,
  }
}

/** Parses one page of the diary. Throws on a row that has no film or no date. */
export function parseDiaryPage(page: Document): ParsedPage<DiaryEntry> {
  const items: DiaryEntry[] = []
  for (const row of page.querySelectorAll('tr.diary-entry-row')) {
    const film = parseFilm(row.querySelector('[data-item-slug]') ?? row)
    // The day links to the diary of that day: /user/diary/films/for/2026/09/24/
    const href = row.querySelector('a.daydate')?.getAttribute('href') ?? ''
    const day = /\/for\/(\d{4})\/(\d{2})\/(\d{2})\/$/.exec(href)
    if (film == null || day == null) {
      throw new Error('A diary row has no film or no date. The extension needs an update.')
    }

    // The owner of the diary sees an editable rating, 0 to 10. Others see stars.
    const input = row.querySelector<HTMLInputElement>('input.rateit-field')
    const rating =
      input != null
        ? toRating(Number(input.getAttribute('value')))
        : parseRatingClass(row.querySelector('.col-rating [class*="rated-"]'))

    items.push({
      ...film,
      date: `${day[1]}-${day[2]}-${day[3]}`,
      rating,
      rewatch: !row.querySelector('td.col-rewatch')?.classList.contains('icon-status-off'),
    })
  }
  return { items, ...parsePaging(page) }
}

/** Parses one page of the large grid of watched films. */
export function parseWatchedPage(page: Document): ParsedPage<WatchedFilm> {
  const items: WatchedFilm[] = []
  for (const item of page.querySelectorAll('li.griditem')) {
    const film = parseFilm(item.querySelector('[data-item-slug]') ?? item)
    if (film == null) continue
    const viewingData = item.querySelector('.poster-viewingdata')
    items.push({
      ...film,
      date: viewingData?.querySelector('time')?.getAttribute('datetime') ?? null,
      rating: parseRatingClass(viewingData?.querySelector('.rating')),
    })
  }
  return { items, ...parsePaging(page) }
}

/** Parses one page of the watchlist. The page has no dates. */
export function parseWatchlistPage(page: Document): ParsedPage<LetterboxdFilm> {
  const items: LetterboxdFilm[] = []
  for (const item of page.querySelectorAll('li.griditem')) {
    const film = parseFilm(item.querySelector('[data-item-slug]') ?? item)
    if (film != null) items.push(film)
  }
  return { items, ...parsePaging(page) }
}

/** Parses CSV with quoted fields, as Letterboxd writes it. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (char === '"') {
        quoted = false
      } else {
        field += char
      }
    } else if (char === '"') {
      quoted = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      rows.push(row)
      row = []
      field = ''
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/**
 * Reads the watchlist CSV into a map from the short link code of a film to the
 * date it was added. The CSV has `Date,Name,Year,Letterboxd URI`.
 */
export function parseWatchlistCsv(text: string): Map<string, string> {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''))
  const dateColumn = header?.indexOf('Date') ?? -1
  const uriColumn = header?.indexOf('Letterboxd URI') ?? -1
  if (dateColumn < 0 || uriColumn < 0) {
    throw new Error('The watchlist CSV has no Date or Letterboxd URI column.')
  }

  const dates = new Map<string, string>()
  for (const row of rows) {
    const code = /boxd\.it\/(\w+)/.exec(row[uriColumn] ?? '')?.[1]
    const date = row[dateColumn]
    if (code != null && date) dates.set(code, date)
  }
  return dates
}

async function fetchPage(url: string, signal: AbortSignal) {
  let response: Response
  try {
    response = await fetch(url, { credentials: 'include', signal })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Could not reach letterboxd.com. Check your connection, then try again.')
  }
  const text = await response.text()
  // Cloudflare answers with a "Just a moment..." page until the browser passes its check.
  if (
    response.headers.get('cf-mitigated') === 'challenge' ||
    (!response.ok && text.includes('challenges.cloudflare.com'))
  ) {
    throw new Error(
      'Letterboxd shows a "Just a moment" check. Open letterboxd.com, wait for the site to load, then try again.'
    )
  }
  if (!response.ok) {
    throw new Error(`Letterboxd returned error ${response.status}. Try again later.`)
  }
  await new Promise((resolve) => setTimeout(resolve, REQUEST_DELAY_MS))
  signal.throwIfAborted()
  return { response, text }
}

async function fetchDocument(url: string, signal: AbortSignal) {
  const { text } = await fetchPage(url, signal)
  return { page: new DOMParser().parseFromString(text, 'text/html'), html: text }
}

function signInError() {
  return new Error('Open letterboxd.com and sign in, then try again.')
}

/**
 * Reads the username of the signed-in user from a script that every page has:
 * `person.username = 'cheezydrizzle'`. `null` when the user is signed out.
 */
function signedInUsername(html: string) {
  if (!/person\.loggedIn\s*=\s*true/.test(html)) return null
  return /person\.username\s*=\s*['"]([\w-]+)['"]/.exec(html)?.[1] ?? ''
}

/** Returns the username of the signed-in user, from the home page. */
export async function fetchUsername(signal: AbortSignal) {
  const { text } = await fetchPage(`${SITE}/`, signal)
  const username = signedInUsername(text)
  if (username == null) throw signInError()
  if (username === '') {
    throw new Error(
      'Could not find your account on the Letterboxd page. The extension needs an update.'
    )
  }
  return username
}

/**
 * Fetches the pages of a list of the user one by one until there is no next
 * page. `path` is the path of the list after the username, like `diary/films/`.
 */
export async function fetchList<T>(
  username: string,
  path: string,
  parsePage: (page: Document) => ParsedPage<T>,
  onProgress: (page: number, pageCount: number) => void,
  signal: AbortSignal
): Promise<T[]> {
  const items: T[] = []
  for (let pageNumber = 1; ; pageNumber++) {
    const url = `${SITE}/${username}/${path}${pageNumber > 1 ? `page/${pageNumber}/` : ''}`
    const { page, html } = await fetchDocument(url, signal)
    // Signed out, the pages of a public profile still load, with no editable ratings.
    if (signedInUsername(html) !== username) throw signInError()

    const parsed = parsePage(page)
    items.push(...parsed.items)
    onProgress(pageNumber, Math.max(parsed.pageCount, pageNumber))
    if (!parsed.hasNextPage || parsed.items.length === 0) return items
  }
}

/** Fetches the watchlist CSV that the "Export watchlist" link of the watchlist page downloads. */
export async function fetchWatchlistDates(username: string, signal: AbortSignal) {
  const { response, text } = await fetchPage(`${SITE}/${username}/watchlist/export/`, signal)
  if (response.headers.get('content-type')?.includes('text/html')) {
    throw new Error(
      'Letterboxd returned a page instead of the watchlist CSV. The extension needs an update.'
    )
  }
  return parseWatchlistCsv(text)
}

/** Reads the TMDB ID from the film page, which has it on `<body>`. */
export async function fetchTmdbIdFromFilmPage(
  slug: string,
  signal: AbortSignal
): Promise<TmdbFilmPageId> {
  const { page } = await fetchDocument(`${SITE}/film/${slug}/`, signal)
  const id = page.body.dataset.tmdbId
  if (!id) return {}
  return page.body.dataset.tmdbType === 'tv' ? { tv: id } : { movie: id }
}

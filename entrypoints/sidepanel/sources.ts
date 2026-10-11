import {
  Calendar03Icon,
  Clock01Icon,
  FavouriteIcon,
  StarIcon,
  ViewIcon,
} from '@hugeicons/core-free-icons'
import { fetchUserId } from '@/utils/kinopoisk'
import { fetchUsername } from '@/utils/letterboxd'
import type { ExportResult, OnStep } from './export'
import type { IconData } from './Icon'
import * as kinopoisk from './kinopoisk-library'
import * as letterboxd from './letterboxd-library'

/** A site that the side panel exports a library from. */
export interface Source {
  name: string
  /** The host that error messages name, which the side panel turns into a link. */
  host: string
  url: string
  fileName: string
  /**
   * The steps of the export, named after the pages of the site. The ready view
   * lists the steps that have an icon, and the TMDB step has none.
   */
  steps: { step: string; label: string; icon?: IconData }[]
  /** The lists of the file that the done view counts. */
  stats: { key: string; label: string }[]
  /** Returns the account that `exportLibrary` takes, and the text that shows it. */
  checkAccount: (signal: AbortSignal) => Promise<{ account: string; text: string }>
  exportLibrary: (
    account: string | null,
    onStep: OnStep<string>,
    signal: AbortSignal
  ) => Promise<ExportResult>
}

export const SOURCES: Source[] = [
  {
    name: 'Letterboxd',
    host: 'letterboxd.com',
    url: 'https://letterboxd.com/',
    fileName: 'letterboxd-library.json',
    steps: [
      { step: 'diary', label: 'Diary', icon: Calendar03Icon },
      { step: 'films', label: 'Films', icon: ViewIcon },
      { step: 'watchlist', label: 'Watchlist', icon: Clock01Icon },
      { step: 'tmdb', label: 'TMDB IDs' },
    ],
    stats: [
      { key: 'ratings', label: 'Ratings' },
      { key: 'watches', label: 'Watches' },
      { key: 'seen', label: 'Seen' },
      { key: 'watchlist', label: 'Watchlist' },
    ],
    checkAccount: async (signal) => {
      const username = await fetchUsername(signal)
      return { account: username, text: `Signed in on letterboxd.com as ${username}` }
    },
    exportLibrary: letterboxd.exportLibrary,
  },
  {
    name: 'Kinopoisk',
    host: 'kinopoisk.ru',
    url: 'https://www.kinopoisk.ru/',
    fileName: 'kinopoisk-library.json',
    steps: [
      { step: 'watched', label: 'Watches', icon: ViewIcon },
      { step: 'ratings', label: 'Ratings', icon: StarIcon },
      { step: 'watchlist', label: 'Watchlist', icon: Clock01Icon },
      { step: 'favorites', label: 'Favorites', icon: FavouriteIcon },
      { step: 'tmdb', label: 'TMDB IDs' },
    ],
    stats: [
      { key: 'ratings', label: 'Ratings' },
      { key: 'seen', label: 'Seen' },
      { key: 'watchlist', label: 'Watchlist' },
      { key: 'favorites', label: 'Favorites' },
    ],
    checkAccount: async (signal) => ({
      account: await fetchUserId(signal),
      text: 'Signed in on kinopoisk.ru',
    }),
    exportLibrary: kinopoisk.exportLibrary,
  },
]

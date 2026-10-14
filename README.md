# Foyerr Import Helper

A browser extension that saves your Kinopoisk, Letterboxd or IMDb library to a JSON file in the format the [Foyerr](https://foyerr.app) import takes. It reads the same pages you see when signed in.

When I built this in October 2026, neither site gave you a file Foyerr could use. Kinopoisk had no export at all. Letterboxd had one, but its CSV files had no TMDB IDs and showed the day of the import for anything you imported.

The source is public so you can check what it does before you run it on your account.

## What it exports

### Kinopoisk

| Key         | Kinopoisk page          | Has                  |
| ----------- | ----------------------- | -------------------- |
| `ratings`   | Оценки                  | Your rating, 1 to 10 |
| `seen`      | Просмотры               | Watched, not rated   |
| `watchlist` | The Буду смотреть list  | Date added           |
| `favorites` | The Любимые фильмы list | Date added           |

Every title looks like this.

```json
{
  "kinopoiskId": "258687",
  "type": "film",
  "title": "Интерстеллар",
  "originalTitle": "Interstellar",
  "year": 2014,
  "date": "2022-02-21T17:55",
  "rating": 9,
  "tmdbId": "157336",
  "tmdbIdMatchedBy": "kinopoiskId"
}
```

`date` is the time shown on the page, with no time zone. Only `ratings` has `rating`.

### Letterboxd

| Key         | Letterboxd page                                    | `date`                            |
| ----------- | -------------------------------------------------- | --------------------------------- |
| `ratings`   | Diary entries with a rating                        | The day you watched it            |
| `ratings`   | Films, rated outside the diary                     | When you rated it, as a timestamp |
| `watches`   | Diary entries with no rating                       | The day you watched it            |
| `seen`      | Films that are not in the diary and have no rating | `null`                            |
| `watchlist` | Watchlist, with the watchlist CSV                  | The day it was added              |

Every diary entry is in the file, so a film you watched three times is in it three times. A rating from the Films page goes in only when it differs from the film's latest rated diary entry, which means you set or changed it outside the diary.

The watchlist pages have no dates. The extension downloads the CSV behind the "Export watchlist" link and takes the dates from there. For an imported watchlist, that is the day of the import.

```json
{
  "letterboxdSlug": "mother-2017",
  "letterboxdId": "dgRU",
  "title": "mother!",
  "year": 2017,
  "date": "2017-10-03",
  "rating": 10,
  "rewatch": false,
  "type": "film",
  "tmdbId": "381283",
  "tmdbIdMatchedBy": "letterboxdSlug"
}
```

`rating` is 1 to 10, a point for each half star, so ★★★★★ is 10. `letterboxdId` is the code of the film's boxd.it link. Only diary entries have `rewatch`.

### IMDb

| Key         | IMDb page                                                       | `date`                     |
| ----------- | --------------------------------------------------------------- | -------------------------- |
| `ratings`   | Your ratings                                                    | When you rated it          |
| `seen`      | Your watch history, titles with no rating                       | When you marked it watched |
| `seen`      | Your watch history, rated titles marked watched at another time | When you marked it watched |
| `watchlist` | Your Watchlist                                                  | When you added it          |

IMDb keeps one watched date per title, the first time you marked it. Rating a title marks it as watched at the same moment, so for most rated titles the watch history only repeats the rating date. Those titles are in `ratings` alone. A rated title goes in `seen` too when you marked it as watched before or after you rated it.

```json
{
  "imdbId": "tt0816692",
  "type": "film",
  "title": "Interstellar",
  "originalTitle": "Interstellar",
  "year": 2014,
  "date": "2025-02-22T21:15:58.970Z",
  "rating": 9,
  "tmdbId": "157336",
  "tmdbIdMatchedBy": "imdbId"
}
```

`date` is a timestamp in UTC, or `null` for an old rating that IMDb has no date for. `title` is the name IMDb shows you, which can differ from `originalTitle`. Only `ratings` has `rating`, 1 to 10.

Episodes are in `ratings` and `seen` like any other title, with `type` set to `episode`. IMDb has no seasons you can rate or mark as watched, so the file has none.

```json
{
  "imdbId": "tt0959621",
  "type": "episode",
  "title": "Pilot",
  "originalTitle": "Pilot",
  "year": 2008,
  "seriesImdbId": "tt0903747",
  "seriesTitle": "Breaking Bad",
  "seasonNumber": 1,
  "episodeNumber": 1,
  "date": "2025-03-02T19:40:12.511Z",
  "rating": 10,
  "seriesTmdbId": "1396",
  "tmdbIdMatchedBy": "imdbId"
}
```

An episode has `seriesTmdbId` in place of `tmdbId`. `seasonNumber` and `episodeNumber` are IMDb's numbers. They don't always match TMDB's, specials in particular, and either is `null` when IMDb has no number for the episode.

## What it sends and where

The extension talks to four hosts.

| Host                   | Request                                                                          |
| ---------------------- | -------------------------------------------------------------------------------- |
| `kinopoisk.ru`         | Your list pages, with your session cookies                                       |
| `letterboxd.com`       | Your diary, films and watchlist, the watchlist CSV, some film pages              |
| `api.graphql.imdb.com` | Queries for your ratings, watch history and watchlist, with your session cookies |
| `query.wikidata.org`   | Kinopoisk IDs, Letterboxd slugs or IMDb IDs, and titles with years for Kinopoisk |

IMDb's API answers every request with a note that its data is for limited, non-commercial use. The extension reads only your own library, into a file for you.

Nothing goes to [Foyerr](https://foyerr.app) or to me. The file is built in the side panel and saved through the browser's download.

The `sidePanel` permission lets the extension show its UI in the browser's side panel. A popup closes when you click outside it, and that would stop the export.

Requests to Kinopoisk, Letterboxd and IMDb go one at a time with a 1.5 second pause. IMDb sends up to 250 titles per request, so a library of 1,000 ratings takes four. If Kinopoisk shows a captcha or Letterboxd shows Cloudflare's "Just a moment" page, the export stops and tells you to open the site.

## TMDB IDs

For Kinopoisk, Wikidata is the only source. The lookup has two steps.

1. By Kinopoisk ID.
2. By title, for the rest. A title gets an ID only if exactly one Wikidata item has the same English name, a TMDB ID of the same type, no Kinopoisk ID, and the same year. A year that is one off passes if the Russian names match too.

Step 2 can pick another title with the same name and year. `tmdbIdMatchedBy` is `title` for those, so search the file for it and check them. It is `null` when nothing matched.

For Letterboxd, the extension looks up the film slugs on Wikidata first. A film Wikidata doesn't have costs one more request, to the film's page on Letterboxd, which has the TMDB ID. `tmdbIdMatchedBy` is `letterboxdSlug` or `filmPage`. Both are exact.

For IMDb, the extension looks up the IMDb IDs on Wikidata, and for an episode the IMDb ID of its series. That is the only step. `tmdbIdMatchedBy` is `imdbId`, or `null` when Wikidata doesn't have the title.

## Install

Install it from the [Chrome Web Store](https://chromewebstore.google.com/detail/kinopoisk-export/opbnlpoogbnecfiiaapddolciiadfhch).

### Build it yourself

To run the code from this repo instead, build it and load it unpacked.

```bash
pnpm install
```

```bash
pnpm build
```

Open `chrome://extensions`, turn on developer mode, click "Load unpacked" and pick `.output/chrome-mv3`.

`pnpm build:firefox` builds for Firefox. I haven't tested that one, and the icon click doesn't open the sidebar there.

## Development

`pnpm dev` opens a browser with the extension loaded. The profile is kept in `.wxt/chrome-data`, so you stay signed in between runs.

| Path                        | Is                                      |
| --------------------------- | --------------------------------------- |
| `entrypoints/sidepanel`     | The side panel, plain TypeScript        |
| `entrypoints/background.ts` | Opens the side panel on an icon click   |
| `utils/kinopoisk`           | Fetches and parses the Kinopoisk pages  |
| `utils/letterboxd`          | Fetches and parses the Letterboxd pages |
| `utils/imdb`                | Queries the IMDb GraphQL API            |
| `utils/wikidata`            | Looks up TMDB IDs with SPARQL           |

`pnpm compile` typechecks.

## When it breaks

The parsers depend on Kinopoisk's old profile pages and on the markup of Letterboxd's pages. For IMDb, the extension sends the GraphQL queries that imdb.com itself uses. IMDb doesn't document them and can change them at any time. If a page comes back in a shape the extension doesn't expect, the export stops and the side panel says which check failed.

## Known gaps

- The Kinopoisk watch later and favorites folders write "Dog Stars, The". The extension moves a trailing "The", "A" or "An" to the front. Articles in other languages stay where Kinopoisk put them.
- A title with no year on Kinopoisk never gets a TMDB ID from step 2.
- Custom Kinopoisk folders are not exported.
- Letterboxd likes, favorites, lists and reviews are not exported.
- A Letterboxd film you marked as watched without a rating or a diary entry has no date. Letterboxd doesn't show one.
- IMDb has one watched date per title, so a title you watched twice is in the file once.
- IMDb video games and podcasts are not exported. TMDB doesn't have them.
- IMDb lists other than the watchlist, and IMDb reviews, are not exported.

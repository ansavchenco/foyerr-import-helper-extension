# Foyerr Import Helper

A browser extension that saves your Kinopoisk or Letterboxd library to a JSON file in the format the [Foyerr](https://foyerr.app) import takes. It reads the same pages you see when signed in.

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

## What it sends and where

The extension talks to three hosts.

| Host                 | Request                                                                |
| -------------------- | ---------------------------------------------------------------------- |
| `kinopoisk.ru`       | Your list pages, with your session cookies                             |
| `letterboxd.com`     | Your diary, films and watchlist, the watchlist CSV, some film pages    |
| `query.wikidata.org` | Kinopoisk IDs or Letterboxd slugs, and titles with years for Kinopoisk |

Nothing goes to [Foyerr](https://foyerr.app) or to me. The file is built in the side panel and saved through the browser's download.

The `sidePanel` permission lets the extension show its UI in the browser's side panel. A popup closes when you click outside it, and that would stop the export.

Requests to Kinopoisk and Letterboxd go one at a time with a 1.5 second pause. If Kinopoisk shows a captcha or Letterboxd shows Cloudflare's "Just a moment" page, the export stops and tells you to open the site.

## TMDB IDs

For Kinopoisk, Wikidata is the only source. The lookup has two steps.

1. By Kinopoisk ID.
2. By title, for the rest. A title gets an ID only if exactly one Wikidata item has the same English name, a TMDB ID of the same type, no Kinopoisk ID, and the same year. A year that is one off passes if the Russian names match too.

Step 2 can pick another title with the same name and year. `tmdbIdMatchedBy` is `title` for those, so search the file for it and check them. It is `null` when nothing matched.

For Letterboxd, the extension looks up the film slugs on Wikidata first. A film Wikidata doesn't have costs one more request, to the film's page on Letterboxd, which has the TMDB ID. `tmdbIdMatchedBy` is `letterboxdSlug` or `filmPage`. Both are exact.

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
| `utils/wikidata`            | Looks up TMDB IDs with SPARQL           |

`pnpm compile` typechecks.

## When it breaks

The parsers depend on Kinopoisk's old profile pages and on the markup of Letterboxd's pages. If a page comes back in a shape the extension doesn't expect, the export stops and the side panel says which check failed.

## Known gaps

- The Kinopoisk watch later and favorites folders write "Dog Stars, The". The extension moves a trailing "The", "A" or "An" to the front. Articles in other languages stay where Kinopoisk put them.
- A title with no year on Kinopoisk never gets a TMDB ID from step 2.
- Custom Kinopoisk folders are not exported.
- Letterboxd likes, favorites, lists and reviews are not exported.
- A Letterboxd film you marked as watched without a rating or a diary entry has no date. Letterboxd doesn't show one.

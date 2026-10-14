# Privacy Policy for Foyerr Import Helper

Effective date: October 14, 2026

Foyerr Import Helper is a browser extension that exports a user’s Kinopoisk ratings, watched titles, watch later list, and favorites, a user’s Letterboxd diary, ratings, watched films, and watchlist, or a user’s IMDb ratings, watch history, and watchlist, to a JSON file.

## Data handled by the extension

To perform an export, the extension processes:

- the numeric identifier of the signed-in Kinopoisk account, the username of the signed-in Letterboxd account, or the username or display name of the signed-in IMDb account;
- the user’s Kinopoisk ratings, watched status, watch later list, favorites, and associated dates;
- the user’s Letterboxd diary entries, ratings, watched films, watchlist, and associated dates, including the watchlist CSV that Letterboxd offers on the watchlist page;
- the user’s IMDb ratings, watch history, watchlist, and associated dates;
- title information including names, years, media types, Kinopoisk IDs, Letterboxd film identifiers, and IMDb IDs;
- the user’s existing Kinopoisk, Letterboxd, or IMDb authentication session, which the browser automatically supplies to that site.

The extension does not ask for or read the user’s Kinopoisk, Letterboxd, or IMDb password. It does not inspect, copy, export, or store authentication cookie values.

## How the data is used

This information is used only to create the JSON export requested by the user and to find corresponding TMDB identifiers through Wikidata.

The extension does not use the information for advertising, analytics, profiling, tracking, creditworthiness, or lending.

## Data sharing and network services

The extension communicates with:

1. Kinopoisk at https://www.kinopoisk.ru

   Requests to Kinopoisk retrieve the user’s own library pages using the browser’s existing signed-in session.

2. Letterboxd at https://letterboxd.com

   Requests to Letterboxd retrieve the user’s own diary, films, and watchlist pages and the watchlist CSV using the browser’s existing signed-in session. For films that Wikidata does not identify, the extension also retrieves the public page of the film to read its TMDB ID.

3. IMDb at https://api.graphql.imdb.com

   Requests to IMDb retrieve the user’s own account name, ratings, watch history, and watchlist through the GraphQL API that the IMDb website uses, with the browser’s existing signed-in session.

4. Wikidata Query Service at https://query.wikidata.org

   The extension sends Kinopoisk title IDs, Letterboxd film identifiers, or IMDb IDs and, for Kinopoisk, when necessary, title names and years to find corresponding TMDB IDs. It does not send the user’s account ID or username, ratings, watched dates, list membership, or authentication cookies to Wikidata.

Network requests use HTTPS. The privacy practices of Kinopoisk, Letterboxd, IMDb, and the Wikimedia Foundation apply to information received by their respective services.

## Storage and retention

The extension has no developer-operated server and does not send the exported library to the developer.

Export data is held temporarily in the extension’s side panel while it is open. The most recently generated JSON remains in memory only so that the user can select “Download again.” Closing or reloading the panel clears that in-memory data.

The completed JSON file is saved to the user’s Downloads folder at the user’s request. The user controls that file and can delete it at any time.

The extension does not use Chrome storage for the exported library and does not include advertising, analytics, or tracking software.

## Sale and unrelated use of data

Foyerr Import Helper does not sell user data.

It does not use or transfer user data for purposes unrelated to its single purpose. It does not use or transfer user data to determine creditworthiness or for lending purposes.

Foyerr Import Helper’s use and transfer of information obtained through browser permissions complies with the Chrome Web Store User Data Policy, including its Limited Use requirements.

## User choices

Users may stop an export with the Cancel button, close the side panel, delete downloaded files, disable the extension, or uninstall it.

## Changes

This policy may be updated if the extension’s functionality or data practices change. The effective date at the top of this page will be updated when changes are made.

## Contact

Questions or concerns may be submitted at:

https://github.com/ansavchenco/kinopoisk-export-extension/issues

import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-solid'],
  vite: () => ({ plugins: [tailwindcss()] }),
  manifest: {
    name: 'Foyerr Import Helper',
    // With no popup, the manifest needs an empty `action` to show the toolbar icon.
    action: {},
    host_permissions: [
      'https://*.kinopoisk.ru/*',
      'https://letterboxd.com/*',
      'https://query.wikidata.org/*',
    ],
  },
  webExt: {
    // Keeps the profile of the dev browser (cookies, settings) between runs.
    chromiumArgs: ['--user-data-dir=./.wxt/chrome-data'],
  },
})

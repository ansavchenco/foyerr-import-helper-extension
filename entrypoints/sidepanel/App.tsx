import type { LucideIcon } from 'lucide-solid'
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Circle,
  LoaderCircle,
  TriangleAlert,
  X,
} from 'lucide-solid'
import type { JSX } from 'solid-js'
import { createSignal, For, onMount, Show } from 'solid-js'
import { createStore } from 'solid-js/store'
import { Dynamic } from 'solid-js/web'
import type { ExportResult } from './export'
import type { Source } from './sources'
import { SOURCES } from './sources'

type View = 'pick' | 'ready' | 'running' | 'done' | 'error'
type StepState = 'pending' | 'active' | 'done' | 'failed'

function viewText(view: View, source: Source): { heading: string; lead: string } {
  switch (view) {
    case 'pick':
      return {
        heading: 'Foyerr Import Helper',
        lead: "Pick the site your library is on. You'll get a file to import into Foyerr.",
      }
    case 'ready':
      return { heading: `${source.name} Export`, lead: '' }
    case 'running':
      return { heading: 'Exporting…', lead: 'Keep this panel open.' }
    case 'done':
      return { heading: 'Export saved', lead: `${source.fileName} is in your downloads.` }
    case 'error':
      return { heading: 'Export stopped', lead: '' }
  }
}

/** The missing titles that the done view shows before "Show more". */
const MISSING_PREVIEW_COUNT = 5

const ROW = 'flex items-center gap-2 border-t border-neutral-200 py-2 dark:border-neutral-700'
const MUTED = 'text-neutral-500 dark:text-neutral-400'

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

function download(json: string, fileName: string) {
  const link = document.createElement('a')
  link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }))
  link.download = fileName
  link.click()
  URL.revokeObjectURL(link.href)
}

const STATE_ICONS: Record<StepState, LucideIcon> = {
  pending: Circle,
  active: LoaderCircle,
  done: Check,
  failed: X,
}
const STATE_COLORS: Record<StepState, string> = {
  pending: '',
  active: 'animate-spin text-blue-600 dark:text-blue-400',
  done: 'text-green-600 dark:text-green-400',
  failed: 'text-red-700 dark:text-red-300',
}

function StateIcon(props: { state: StepState; failedIcon?: LucideIcon; class?: string }) {
  const icon = () =>
    props.state === 'failed' && props.failedIcon ? props.failedIcon : STATE_ICONS[props.state]
  return (
    <Dynamic
      component={icon()}
      class={`size-4.5 shrink-0 ${STATE_COLORS[props.state]} ${props.class ?? ''}`}
    />
  )
}

function Button(props: {
  primary?: boolean
  disabled?: boolean
  onClick: () => void
  children: JSX.Element
}) {
  return (
    <button
      class="cursor-pointer rounded-lg border px-3 py-2 disabled:cursor-default disabled:opacity-40"
      classList={{
        'border-neutral-900 bg-neutral-900 text-white enabled:hover:border-neutral-700 enabled:hover:bg-neutral-700 dark:border-neutral-100 dark:bg-neutral-100 dark:text-neutral-900 dark:enabled:hover:border-neutral-300 dark:enabled:hover:bg-neutral-300':
          props.primary,
        'border-neutral-200 enabled:hover:bg-neutral-100 dark:border-neutral-700 dark:enabled:hover:bg-neutral-800':
          !props.primary,
      }}
      disabled={props.disabled}
      onClick={() => props.onClick()}
    >
      {props.children}
    </button>
  )
}

/** Shows the text with each host of the site in it, like "kinopoisk.ru", as a link to the site. */
function LinkSite(props: { text: string; source: Source }) {
  return (
    <For each={props.text.split(props.source.host)}>
      {(part, index) => (
        <>
          <Show when={index() > 0}>
            <a
              href={props.source.url}
              target="_blank"
              class="font-medium underline underline-offset-2 hover:no-underline"
            >
              {props.source.host}
            </a>
          </Show>
          {part}
        </>
      )}
    </For>
  )
}

/** The result of the sign-in check, in the ready view. */
function Account(props: {
  state: 'active' | 'done' | 'failed'
  text: string
  source: Source
  onCheckAgain: () => void
}) {
  const failed = () => props.state === 'failed'
  return (
    <div
      class="flex gap-2 rounded-lg px-3 py-2.5"
      classList={{
        'bg-neutral-100 dark:bg-neutral-800': !failed(),
        'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300': failed(),
      }}
    >
      <StateIcon state={props.state} failedIcon={TriangleAlert} class="mt-px" />
      <div class="flex flex-1 flex-col gap-2">
        <span>
          <Show when={failed()} fallback={props.text}>
            <LinkSite text={props.text} source={props.source} />
          </Show>
        </span>
        <Show when={failed()}>
          <button
            class="cursor-pointer self-end rounded-md border border-red-200 bg-white px-2.5 py-1 font-medium hover:bg-red-100 dark:border-red-800 dark:bg-red-900 dark:hover:bg-red-800"
            onClick={() => props.onCheckAgain()}
          >
            Check again
          </button>
        </Show>
      </div>
    </div>
  )
}

/** Why the export stopped, in the error view. */
function ErrorBox(props: { text: string }) {
  return (
    <p class="flex gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-red-700 dark:bg-red-950 dark:text-red-300">
      <TriangleAlert class="mt-px size-4.5 shrink-0" />
      {props.text}
    </p>
  )
}

function Stat(props: { count: number; label: string }) {
  return (
    <div class="rounded-lg bg-neutral-100 px-2.5 py-2 dark:bg-neutral-800">
      <b class="block text-xl font-semibold text-neutral-900 dark:text-neutral-100">
        {props.count}
      </b>
      {props.label}
    </div>
  )
}

function MissingTitles(props: { titles: ExportResult['missing'] }) {
  const [showAll, setShowAll] = createSignal(false)
  const shown = () => (showAll() ? props.titles : props.titles.slice(0, MISSING_PREVIEW_COUNT))
  const hiddenCount = () => props.titles.length - shown().length

  return (
    <Show when={props.titles.length > 0}>
      <section>
        <p class="mb-1 text-amber-700 dark:text-amber-400">
          Could not find TMDB ID for {props.titles.length}{' '}
          {props.titles.length === 1 ? 'title' : 'titles'}
        </p>
        <ul>
          <For each={shown()}>
            {(title) => (
              <li class={ROW}>
                <span>{title.title}</span>
                <span class={`ml-auto tabular-nums ${MUTED}`}>{title.year ?? ''}</span>
              </li>
            )}
          </For>
        </ul>
        <Show when={hiddenCount() > 0}>
          <button
            class={`cursor-pointer py-2 ${MUTED} hover:text-neutral-900 dark:hover:text-neutral-100`}
            onClick={() => setShowAll(true)}
          >
            Show {hiddenCount()} more
          </button>
        </Show>
      </section>
    </Show>
  )
}

/** A site in the list of sites, which opens the ready view of the site. */
function SourceButton(props: { source: Source; onClick: () => void }) {
  return (
    <button
      class="flex cursor-pointer items-center gap-3 rounded-lg border border-neutral-200 px-3 py-2.5 text-left hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
      onClick={() => props.onClick()}
    >
      <span class="flex-1 font-medium">{props.source.name}</span>
      <ChevronRight class={`size-4.5 shrink-0 ${MUTED}`} />
    </button>
  )
}

export function App() {
  const [view, setView] = createSignal<View>('pick')
  const [source, setSource] = createSignal<Source>(SOURCES[0]!)
  const [account, setAccount] = createSignal({
    state: 'active' as 'active' | 'done' | 'failed',
    text: '',
  })
  const [steps, setSteps] = createStore<Record<string, { state: StepState; count: string }>>({})
  const [error, setError] = createSignal('')
  const [result, setResult] = createSignal<ExportResult>()

  let accountId: string | null = null
  let abortController = new AbortController()
  /** Aborts the sign-in check of the site that the user has left. */
  let accountCheck = new AbortController()
  /** The file of the last export, for "Download again". */
  let libraryJson = ''

  async function checkAccount() {
    accountCheck.abort()
    // Not `abortController`: Cancel aborts it, and the user can check again after that.
    accountCheck = new AbortController()
    const { signal } = accountCheck
    accountId = null
    setAccount({ state: 'active', text: 'Checking that you are signed in…' })
    try {
      const checked = await source().checkAccount(signal)
      if (signal.aborted) return
      accountId = checked.account
      setAccount({ state: 'done', text: checked.text })
    } catch (error) {
      if (signal.aborted) return
      setAccount({ state: 'failed', text: errorMessage(error) })
    }
  }

  function pick(picked: Source) {
    setSource(picked)
    setView('ready')
    void checkAccount()
  }

  function back() {
    accountCheck.abort()
    setView('pick')
  }

  async function start() {
    abortController = new AbortController()
    const { signal } = abortController
    const exporting = source()
    setSteps(
      Object.fromEntries(exporting.steps.map(({ step }) => [step, { state: 'pending', count: '' }]))
    )
    let activeStep = exporting.steps[0]!.step
    setView('running')

    try {
      const exported = await exporting.exportLibrary(
        accountId,
        (step, state, count = '') => {
          activeStep = step
          setSteps(step, { state, count })
        },
        signal
      )
      libraryJson = JSON.stringify(exported.library, null, 2)
      download(libraryJson, exporting.fileName)
      setResult(exported)
      setView('done')
    } catch (error) {
      if (signal.aborted) return
      // The saved account is of no use if the user has signed out.
      accountId = null
      setSteps(activeStep, 'state', 'failed')
      setError(errorMessage(error))
      setView('error')
    }
  }

  function cancel() {
    abortController.abort()
    setView('ready')
  }

  const text = () => viewText(view(), source())

  return (
    <main class="flex min-h-screen flex-col gap-3 p-4">
      <header class="flex items-center gap-1">
        <Show when={view() !== 'pick' && view() !== 'running'}>
          <button
            class={`-ml-1.5 cursor-pointer rounded-md p-1 ${MUTED} hover:bg-neutral-100 hover:text-neutral-900 dark:hover:bg-neutral-800 dark:hover:text-neutral-100`}
            aria-label="Back to the list of sites"
            onClick={back}
          >
            <ArrowLeft class="size-4.5" />
          </button>
        </Show>
        <h1 class="text-lg font-semibold">{text().heading}</h1>
      </header>
      <Show when={text().lead}>
        <p class={MUTED}>{text().lead}</p>
      </Show>

      <Show when={view() === 'pick'}>
        <div class="flex flex-col gap-2">
          <For each={SOURCES}>
            {(item) => <SourceButton source={item} onClick={() => pick(item)} />}
          </For>
        </div>
      </Show>

      <Show when={view() === 'ready'}>
        <Account
          state={account().state}
          text={account().text}
          source={source()}
          onCheckAgain={checkAccount}
        />
        <ul>
          <For each={source().steps.filter(({ icon }) => icon != null)}>
            {({ icon, label }) => (
              <li class={ROW}>
                <Dynamic component={icon} class="size-4.5 shrink-0" />
                {label}
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={view() === 'error'}>
        <ErrorBox text={error()} />
      </Show>

      <Show when={view() === 'running' || view() === 'error'}>
        <ul>
          <For each={source().steps}>
            {({ step, label }) => (
              <li class={ROW} classList={{ [MUTED]: steps[step]?.state === 'pending' }}>
                <StateIcon state={steps[step]?.state ?? 'pending'} />
                {label}
                <span class={`ml-auto tabular-nums ${MUTED}`}>{steps[step]?.count}</span>
              </li>
            )}
          </For>
        </ul>
      </Show>

      <Show when={view() === 'done' && result()}>
        {(done) => (
          <>
            <div class={`grid grid-cols-2 gap-2 text-xs min-[400px]:grid-cols-4 ${MUTED}`}>
              <For each={source().stats}>
                {({ key, label }) => (
                  <Stat count={done().library[key]?.length ?? 0} label={label} />
                )}
              </For>
            </div>
            <MissingTitles titles={done().missing} />
          </>
        )}
      </Show>

      <footer class="mt-auto flex flex-col gap-2">
        <Show when={view() === 'ready'}>
          <Button primary disabled={account().state !== 'done'} onClick={start}>
            Export library
          </Button>
        </Show>
        <Show when={view() === 'running'}>
          <Button onClick={cancel}>Cancel</Button>
        </Show>
        <Show when={view() === 'done'}>
          <Button primary onClick={() => download(libraryJson, source().fileName)}>
            Download again
          </Button>
          <Button onClick={() => setView('ready')}>Start over</Button>
        </Show>
        <Show when={view() === 'error'}>
          <Button onClick={() => browser.tabs.create({ url: source().url })}>
            Open {source().host}
          </Button>
          <Button primary onClick={start}>
            Try again
          </Button>
        </Show>
      </footer>
    </main>
  )
}

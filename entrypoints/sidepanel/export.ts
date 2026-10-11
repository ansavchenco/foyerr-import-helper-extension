/**
 * Tells the side panel how the export goes. `count` is "12 of 558" while a
 * step runs and the number of titles when it is done.
 */
export type OnStep<Step extends string> = (
  step: Step,
  state: 'active' | 'done',
  count?: string
) => void

export interface ExportResult {
  /** The file, with a list of titles under each key. */
  library: Record<string, unknown[]>
  /** The titles that have no TMDB ID. */
  missing: { title: string; year: number | null }[]
}

import { For } from 'solid-js'
import { Dynamic } from 'solid-js/web'

/** The elements of an icon from `@hugeicons/core-free-icons`, which doesn't export its type. */
export type IconData = readonly (readonly [string, Readonly<Record<string, string | number>>])[]

/** Turns `strokeWidth` into `stroke-width`. Hugeicons writes SVG attributes the React way. */
function toAttributes(attributes: Readonly<Record<string, string | number>>) {
  return Object.fromEntries(
    Object.entries(attributes)
      .filter(([name]) => name !== 'key')
      .map(([name, value]) => [
        name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
        value,
      ])
  )
}

/**
 * Draws a Hugeicons icon. Hugeicons has no Solid package, so this renders the
 * elements of `@hugeicons/core-free-icons` itself. Size it with a class, like `size-4.5`.
 */
export function Icon(props: { icon: IconData; class?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      class={props.class}
    >
      <For each={props.icon}>
        {([tag, attributes]) => <Dynamic component={tag} {...toAttributes(attributes)} />}
      </For>
    </svg>
  )
}

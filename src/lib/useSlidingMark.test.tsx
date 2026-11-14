import { expect, test } from 'vitest'
import { render } from '@testing-library/react'
import { useSlidingMark } from './useSlidingMark'

function List({ items, active }: { items: string[]; active: number }) {
  const { container, mark } = useSlidingMark<HTMLDivElement, HTMLSpanElement>(
    '[data-active="true"]',
    `${active}:${items.length}`,
  )
  return (
    <div ref={container}>
      <span ref={mark} data-testid="mark" />
      {items.map((item, i) => (
        <div key={item} data-active={i === active}>
          {item}
        </div>
      ))}
    </div>
  )
}

test('a mark with nothing to mark leaves no offset behind', () => {
  // Left far down a list that was then filtered short, it stretched what the list
  // scrolls, and the few options left sat above a blank, scrolled-to stretch.
  const view = render(<List items={['a', 'b', 'c']} active={2} />)
  const mark = view.getByTestId('mark')
  expect(mark.style.transform).not.toBe('')
  view.rerender(<List items={['a']} active={-1} />)
  expect(mark.dataset.shown).toBe('false')
  expect(mark.style.transform).toBe('')
})

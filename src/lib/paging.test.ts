import { expect, test } from 'vitest'
import { fit, paginate } from './paging'

test('a page holds what fits and the pager counts the rest', () => {
  const items = [1, 2, 3, 4, 5, 6, 7]
  expect(paginate(items, 3, 0)).toEqual({ items: [1, 2, 3], page: 0, pages: 3 })
  expect(paginate(items, 3, 2)).toEqual({ items: [7], page: 2, pages: 3 })
})

test('a page past the end lands on the last page', () => {
  expect(paginate([1, 2], 3, 5)).toEqual({ items: [1, 2], page: 0, pages: 1 })
  expect(paginate([], 0, 0)).toEqual({ items: [], page: 0, pages: 1 })
})

test('fit counts whole cells and never answers zero', () => {
  expect(fit(500, 230, 10)).toBe(2)
  expect(fit(730, 230, 10)).toBe(3)
  expect(fit(40, 230, 10)).toBe(1)
})

import { describe, expect, test } from 'vitest'
import {
  axisFrame,
  buildTree,
  childrenOf,
  describeTree,
  perpendicular,
  treeProblems,
  type CsgTree,
} from './tree'

describe('the graph is a DAG, and the representation has to admit it', () => {
  test('one node can be two nodes’ child, and stays one node', () => {
    const tree = buildTree((add) => {
      const sphere = add({ kind: 'sphere', radius: 1 })
      return add({ kind: 'union', children: [sphere, sphere] })
    })
    expect(Object.keys(tree.nodes)).toHaveLength(2)
    expect(treeProblems(tree)).toEqual([])
  })

  test('a diamond survives a round trip through JSON, which a nested tree would not', () => {
    // The concrete reason for a node table rather than object references: a command that
    // is saved or shared goes through `JSON.stringify`, which would write the shared node
    // out twice and quietly turn the graph into a tree — taking the sharing the compiler
    // is built around with it.
    const tree = buildTree((add) => {
      const sphere = add({ kind: 'sphere', radius: 1 })
      return add({ kind: 'union', children: [sphere, sphere] })
    })
    const revived = JSON.parse(JSON.stringify(tree)) as CsgTree
    expect(Object.keys(revived.nodes)).toHaveLength(2)
    expect(describeTree(revived)).toBe(describeTree(tree))
  })

  test('describeTree shows a repeat as a reference rather than expanding it', () => {
    const tree = buildTree((add) => {
      const sphere = add({ kind: 'sphere', radius: 1 })
      return add({ kind: 'union', children: [sphere, sphere] })
    })
    expect(describeTree(tree)).toBe('union(sphere(1),&n1)')
  })
})

describe('what treeProblems is and is not for', () => {
  test('a child that does not exist is a problem', () => {
    const tree: CsgTree = { nodes: { n1: { kind: 'invert', child: 'nope' } }, root: 'n1' }
    expect(treeProblems(tree)[0]).toContain('does not exist')
  })

  test('a node reachable from itself is a problem, and does not hang the check', () => {
    const tree: CsgTree = {
      nodes: {
        n1: { kind: 'invert', child: 'n2' },
        n2: { kind: 'invert', child: 'n1' },
      },
      root: 'n1',
    }
    expect(treeProblems(tree).some((p) => p.includes('reachable from itself'))).toBe(true)
  })

  test('an orphan is not a problem — an unwired node is a normal editor state', () => {
    const tree: CsgTree = {
      nodes: {
        n1: { kind: 'sphere', radius: 1 },
        n2: { kind: 'box', half: [1, 1, 1] },
      },
      root: 'n1',
    }
    expect(treeProblems(tree)).toEqual([])
  })

  test('a scale of zero is a problem, because a frame divides by it', () => {
    const tree = buildTree((add) =>
      add({ kind: 'scale', factor: [1, 1, 0], child: add({ kind: 'sphere', radius: 1 }) }),
    )
    expect(treeProblems(tree)[0]).toContain('factor of zero')
  })

  test('a parameter that is not a number is a problem', () => {
    const tree = buildTree((add) => add({ kind: 'sphere', radius: Number.NaN }))
    expect(treeProblems(tree)[0]).toContain('not a number')
  })

  test('a missing root is reported on its own, rather than alongside everything else', () => {
    expect(treeProblems({ nodes: {}, root: 'n1' })).toEqual([
      'the root n1 is not in the node table',
    ])
  })
})

describe('axes', () => {
  test('the perpendicular pair is cyclic for rotation and sorted for everything else', () => {
    // A rotation about y turns (z, x) — the handedness is the order, and swapping it
    // would turn the shape the wrong way. A torus about y uses z² + x², where the order
    // is only a spelling, so it reads as x² + z² like every reference does.
    expect(axisFrame('y')).toEqual({ u: 2, v: 0, w: 1 })
    expect(perpendicular('y')).toEqual([0, 2])
    expect(perpendicular('z')).toEqual([0, 1])
    expect(perpendicular('x')).toEqual([1, 2])
  })
})

describe('childrenOf', () => {
  test('reads a subtract in the order it is written', () => {
    expect(childrenOf({ kind: 'subtract', base: 'a', tools: ['b', 'c'] })).toEqual(['a', 'b', 'c'])
  })

  test('a primitive has none', () => {
    expect(childrenOf({ kind: 'sphere', radius: 1 })).toEqual([])
    expect(childrenOf({ kind: 'expression', source: 'x' })).toEqual([])
  })
})

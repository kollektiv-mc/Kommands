/**
 * Constructive solid geometry for `//generate`.
 *
 * Headless, like the expression evaluator beside it: a graph goes in and expression
 * source comes out, with no canvas and no browser anywhere in the path. The design is in
 * `docs/generate-editor.md`; the short version is that the editor's document is an
 * operation graph and the command is a projection of it.
 *
 * `reference.ts` is deliberately not exported. It is the differential oracle the
 * compiler is tested against, and its only consumers are those tests — exporting it
 * would invite someone to use the slow, deliberately naive path for real work.
 */

export { compileTree, type CsgCompilation, type CsgCompileOptions } from './compile'
export { simplify } from './simplify'
export {
  EMPTY_TREE,
  axisFrame,
  buildTree,
  childrenOf,
  describeTree,
  treeProblems,
  type Axis,
  type CsgNode,
  type CsgNodeKind,
  type CsgTree,
  type NodeId,
  type Vec3,
} from './tree'

import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

// Serializers must branch on version traits, never on version numbers
// (docs/minecraft-versions.md § Rules for serializer code).
//
// .claude/suite.json's `no version-number comparisons` invariant greps for
// `version === '1.21…'`, which only catches a literal comparison against an
// identifier spelled exactly `version`. These selectors catch the shapes a
// regex structurally cannot see — issue #16. Matching on `raw` rather than
// `value` keeps a numeric literal like `1.5` out of the net.
//
// Still not caught, and recorded in docs/health-checklist.md § Open backlog:
// a comparison against a named constant (`version === TARGET_VERSION`).
// Resolving that needs the constant's value, which no selector can reach.
const NO_VERSION_COMPARISONS = [
  {
    selector: 'BinaryExpression[operator=/^([=!]==?|[<>]=?)$/] > Literal[raw=/^[\'"]1\\.\\d/]',
    message:
      'Do not compare version numbers. Branch on a trait from SerializeContext instead — ' +
      'see docs/minecraft-versions.md § The trait matrix.',
  },
  {
    selector:
      'CallExpression[callee.property.name=/^(startsWith|includes|match)$/] > Literal[raw=/^[\'"]1\\.\\d/]',
    message:
      'Do not test a version string by prefix. Branch on a trait from SerializeContext instead — ' +
      'see docs/minecraft-versions.md § The trait matrix.',
  },
  {
    selector: 'ImportDeclaration[source.value=/^semver/]',
    message:
      'Do not order versions with a comparison library. The changes do not land together — ' +
      'attributes moved at 1.21.2, enchantments at 1.21.5 — so no ordering describes them. ' +
      'Branch on a trait; see docs/minecraft-versions.md.',
  },
]

// Static styling goes through Tailwind utilities backed by the generated token
// layer. An inlined value silently opts the element out of runtime theming, and
// the breakage only shows in a theme nobody is looking at while writing the code
// (.claude/rules/styling.md). Genuinely computed values are the sanctioned
// exception and carry a documented eslint-disable-next-line.
const NO_INLINE_STYLES = {
  selector: "JSXAttribute[name.name='style']",
  message:
    'Prefer Tailwind utilities backed by the token layer over inline style={{}}. ' +
    'Inline styles are only for dynamic/computed values — see docs/design-tokens.md.',
}

// Nothing published carries an em dash (kollektiv's docs/conventions.md
// § Public copy). That repo's check-copy.sh reads every page of both websites
// and this app's index.html, which between them hold one word of Kommands'
// copy: its title. Everything a user here reads is rendered from these files,
// so scanning only the HTML reported this repo clean without having read any
// of it.
//
// A rule rather than a grep, because a regex over a .tsx cannot tell a
// rendered string from a comment about one, and this tree comments heavily:
// 160 files carry an em dash and all but a handful are prose between people
// working on it. The parser already knows the difference. Comments are not
// nodes, so they are simply never seen, which is the same line check-copy.sh
// draws when it blanks out <!-- -->.
//
// Three node types carry copy: text between JSX tags, a string a component
// hands to a prop or holds in a lookup, and the literal half of a template.
const NO_EM_DASH_IN_COPY = [
  {
    selector: 'JSXText[value=/\u2014/]',
    message:
      'Published copy carries no em dash. Use a comma, a colon, or two sentences — ' +
      'see kollektiv docs/conventions.md § Public copy.',
  },
  {
    selector: 'Literal[value=/\u2014/]',
    message:
      'Published copy carries no em dash. Use a comma, a colon, or two sentences — ' +
      'see kollektiv docs/conventions.md § Public copy.',
  },
  {
    selector: 'TemplateElement[value.raw=/\u2014/]',
    message:
      'Published copy carries no em dash. Use a comma, a colon, or two sentences — ' +
      'see kollektiv docs/conventions.md § Public copy.',
  },
]

export default tseslint.config(
  // src/data/generated/** carries a DO-NOT-EDIT header and is the deriver's
  // output; linting it would report on a file nobody may edit.
  { ignores: ['dist', 'src/data/generated'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Codebase convention: prefix an intentionally-unused binding with `_`.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', destructuredArrayIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': ['error', ...NO_VERSION_COMPARISONS, NO_INLINE_STYLES],
    },
  },
  {
    // The copy rule on top of the two above, minus the files that are not
    // copy. A test names itself in prose a user never sees, and corpus.ts is
    // WorldEdit's own suite transcribed as data, read by two test files and
    // nothing else. Both are notes between people working here, the same
    // category as a comment.
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/**/*.test.{ts,tsx}', 'src/worldedit/expression/corpus.ts'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...NO_VERSION_COMPARISONS,
        NO_INLINE_STYLES,
        ...NO_EM_DASH_IN_COPY,
      ],
    },
  },
  {
    // The generators run in Node and legitimately handle version strings: the
    // mcmeta tag is pinned as `1.21.1-summary`, which is data, not a branch.
    files: ['scripts/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
)

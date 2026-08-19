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
    // The generators run in Node and legitimately handle version strings: the
    // mcmeta tag is pinned as `1.21.1-summary`, which is data, not a branch.
    files: ['scripts/**/*.ts', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
)

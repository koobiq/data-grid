# AGENTS.md

> Context file for AI agents working in this repository.

## Project Overview

Nx monorepo for `@koobiq/ag-grid-angular-theme` - an Angular theme package for AG Grid Community 34.x that integrates `@koobiq/design-tokens` and provides enhanced keyboard shortcuts.

## Getting Started

Use the Node.js version specified in [.nvmrc](.nvmrc).

Use yarn as the package manager. Install dependencies with:

```bash
yarn install
```

Setup git hooks:

```bash
yarn husky
```

## Common Commands

```bash
# Development
yarn run dev:theme                              # Serve dev app (port 4200)

# Building
yarn run build:theme                            # Build the publishable theme package
yarn run build                                  # Build all projects

# Lint (runs prettier, eslint, stylelint in parallel)
yarn run lint

# Auto-fix lint errors
yarn run lint:fix

# Unit Testing (Jest)
yarn run unit:theme                             # Run unit tests for the theme package
yarn run unit                                   # Run unit tests for all projects
npx jest <TEST_PATH_PATTERN>                    # Run specific unit tests (e.g., npx jest packages/ag-grid-angular-theme/tests/theme.ng.spec.ts)


# E2E Testing (Playwright)
yarn run e2e:setup                              # Install Playwright browsers
yarn run e2e:dev-ag-grid-angular                # Run E2E tests
npx playwright test <TEST_PATH_PATTERN>         # Run specific E2E tests (e.g., npx playwright test dev/ag-grid-angular/src/tests/theme.playwright-spec.ts)
npx playwright show-report                      # Show the last E2E test report

# Screenshots differ across operating systems — always use Docker to update snapshots:
yarn run e2e:docker                             # Run E2E tests in Docker (matches CI environment)
yarn run e2e:docker:update-snapshots            # Run E2E tests in Docker and update snapshots

# Clean
yarn run clean                                  # Reset Nx cache, clear Playwright cache, remove dist/tmp
```

## Repository Structure

This is a yarn monorepo managed with Nx.

```
packages/
└── ag-grid-angular-theme/                  # Published npm package
    ├── src/
    │   ├── theme.scss                      # AG Grid SCSS customization with @koobiq/design-tokens
    │   ├── state-store.ts                  # Generic store type shared by the state persistence directives
    │   ├── *.ng.ts                         # Theme component/directive
    │   └── module.ng.ts                    # Angular module
    ├── tests/
    │   └── *.spec.ts                       # Unit tests (jest)
    ├── _index.scss                         # SCSS entry point, forwards src/theme.scss
    └── index.ts                            # Public API exports

dev/
└── ag-grid-angular/                        # Demo app for development and E2E testing
    ├── public/olympic-winners.json         # Row data used by the demo and the E2E components
    ├── src/main.ts                         # Application entry point and /e2e/* routes (dev mode only)
    ├── src/overview.ng.ts                  # Showcase page (route /)
    └── src/tests/                          # Playwright E2E tests
        ├── __screenshots__/*.png           # E2E test screenshots
        ├── __snapshots__/*.txt             # E2E test snapshots
        ├── utils/*.ts                      # Utility functions for E2E tests
        ├── *.ng.ts                         # E2e test components
        └── *.playwright-spec.ts            # E2e test specs
```

## Architecture

### One Directive per Feature

Nearly every feature of `@koobiq/ag-grid-angular-theme` is a standalone attribute directive on the grid host (`selector: 'ag-grid-angular[kbqAgGrid...]'`) that calls `inject(AgGridAngular)` and either subscribes to grid outputs (`gridReady`, `firstDataRendered`, `cellKeyDown`, `cellClicked`, `cellMouseOver`) or sets grid options directly (`grid.theme`, `grid.tabToNextCell`, `grid.loadingOverlayComponent`). Directives compose freely on one `<ag-grid-angular>` element. `kbqAgGridTheme` is the base: it adds the `ag-theme-koobiq` host class (all package styles are scoped under it) and forces `grid.theme = 'legacy'`, because `theme.scss` uses AG Grid's legacy SCSS theming API and the AG Grid 33+ Theming API would conflict with it.

Feature families, all in `packages/ag-grid-angular-theme/src/`:

- Shortcuts (`select-rows-by-*`, `copy-by-ctrl-c`, `to-next-row-by-tab`): an `enabled` boolean input aliased to the selector, so `[kbqAgGridCopyByCtrlC]="false"` disables it.
- State persistence (`column-state`, `filter-state`, `quick-filter-state`, `external-filter-state`, `row-selection-state`, `row-focus-state`, plus the collapsed/selection stores inside `row-group`): see [State Persistence Pattern](#state-persistence-pattern).
- Host-component injection (`status-bar`, `row-actions`): the directive takes a component `Type` as input, instantiates it with `createComponent()` and an element injector that provides a `KBQ_AG_GRID_*_PARAMS` token (grid api, row node, ...), attaches it to `ApplicationRef`, and inserts its element into AG Grid's own DOM (`.ag-root-wrapper`, `.ag-row`).
- Renderers and Community-edition replacements for Enterprise features: `skeleton-cell-renderer`, `loading-overlay`, `infinite-selection` (inverse select-all for the infinite row model), `column-menu` (column management panel on CDK drag-drop), `row-group` (client-side row grouping). These ship their own components but still expose a host directive as the entry point and keep the components internal. `skeleton-cell-renderer` is the one exception in the package: it exports a standalone component only, with no directive, because the consumer wires it in through `cellRendererSelector` on a `ColDef`.

`shortcuts.ng.ts` (`KbqAgGridShortcuts` service) and `select-all-rows-by-ctrl-a.ng.ts` are deprecated and kept for backward compatibility only. Do not extend them; new behaviour is always a directive.

Cross-directive rules (see the comments in `theme.ng.ts` and `row-selection-state.ng.ts`):

- Several directives may write the same grid option (`selectionColumnDef` is touched by both `KbqAgGridTheme` and `KbqAgGridRowGroup`). Always read the current value with `api.getGridOption()` and merge; never overwrite.
- Subscribe to grid outputs in the directive constructor, not from inside a `gridReady` callback. `ag-grid-angular` only defers native events for outputs that already have a subscriber, so a `firstDataRendered` listener registered later can miss the event permanently.
- User-facing default strings are Russian (`KBQ_AG_GRID_COLUMN_MENU_LABELS_RU`, the row-group column header). English presets exist and are supplied through the `kbqAgGrid*Provider()` helpers.

### State Persistence Pattern

Each `*-state.ng.ts` file is self-contained and has the same shape. Copy `row-selection-state.ng.ts` when adding a new persisted state:

1. A `KbqAgGridXStateStore` type built on `KbqAgGridStateStore<T>` from `state-store.ts` (`getItem`/`setItem`/`removeItem`, each sync or Promise-returning).
2. Two built-in stores: `KbqAgGridXStateLocalStorageStore` (default) and `KbqAgGridXStateQueryParamsStore` (writes through `Router.navigate` with `queryParamsHandling: 'merge'` and `replaceUrl: true`).
3. A `KBQ_AG_GRID_X_STATE_STORE` injection token whose factory defaults to the localStorage store, plus a `kbqAgGridXStateStoreProvider(classOrInstance)` helper.
4. The directive: a required `key` input aliased to the selector, a `store` input defaulting to the injected token, `exportAs`, a public `reset()`, saving on grid events registered in `gridReady`, restoring on `gridReady` or `firstDataRendered`, and listener removal in `DestroyRef.onDestroy`. Restores must guard against the directive being destroyed while an async `getItem` is pending.

Directives that persist per-row state (selection, focus, group collapse) require the consumer to set `getRowId`; say so in the JSDoc.

### Styling

`src/theme.scss` is the entire visual layer. It configures AG Grid through `@include ag.grid-styles((theme: koobiq, --ag-*: var(--kbq-*)))` at the top, defines one private `_ag-<concern>()` mixin per concern, and includes them all inside the `.ag-theme-koobiq { ... }` block at the bottom.

- Colours, sizes and typography come only from `@koobiq/design-tokens` CSS variables (`--kbq-*`). Dark mode is the `.kbq-dark` ancestor class, targeted through the `_dark-theme` mixin.
- Angular components in the package carry no `styles`. They set `kbq-ag-grid-*` classes and their CSS lives in a `theme.scss` mixin marked with a `Based on KbqAgGrid...` comment. A new component needs a new mixin included in `.ag-theme-koobiq`.
- Theme-level modifiers are `ag-theme-koobiq_<modifier>` host classes toggled by `KbqAgGridTheme` (for example `_disable-cell-focus-styles`, `_pinned-left-cols-overflow`).
- Consumers get the SCSS through `package.json` `exports["."].sass`, which points at `_index.scss`; `ng-package.json` copies `_index.scss` and `src/theme.scss` as assets. Keep both in sync if files move.

### Dev App: Demo and E2E Harness in One

`dev/ag-grid-angular` consumes the package from source. There are no yarn workspaces and the package is not in `node_modules`: its `tsconfig.json` maps `@koobiq/ag-grid-angular-theme` to `packages/ag-grid-angular-theme/index` for TypeScript and to `_index.scss` for SCSS. No package build is needed to serve the app or run E2E tests.

- `/` loads `overview.ng.ts`, the public showcase deployed to https://data-grid-next.web.app by `deploy-next.yml` on every push to `main`. PRs get a temporary Firebase preview built with `--configuration=development` so that the E2E routes are included.
- `/e2e/<feature>` routes are added in `main.ts` only under `isDevMode()`. Each lazy-loads a `Dev<Feature>` component from `src/tests/<feature>.ng.ts`; one component per scenario (e.g. `DevColumnState` and `DevColumnStateQueryParams`), each with a minimal grid and `data-testid="e2eScreenshotTarget"` on the grid element.
- Row data is fetched over HTTP from `public/olympic-winners.json` through `devInjectRowData()`, so tests wait for `.ag-row[row-index]` before touching the grid.
- `src/tests/utils/api.ts` reaches the `GridApi` through Angular's dev-mode `window.ng.getComponent()`. It is the only way to drive grid state that has no Community-edition UI (hiding columns, applying column state).

## Adding a Feature

1. `packages/ag-grid-angular-theme/src/<feature>.ng.ts` with JSDoc and an `@example` block on the directive.
2. Export it from `packages/ag-grid-angular-theme/index.ts` and add it to `COMPONENTS` in `src/module.ng.ts` (`KbqAgGridThemeModule` serves NgModule consumers).
3. Styles as a mixin in `src/theme.scss`, included in `.ag-theme-koobiq`.
4. Unit test in `packages/ag-grid-angular-theme/tests/<feature>.ng.spec.ts`. Tests are not colocated; Jest only matches `tests/**/*.spec.ts`.
5. Dev component `dev/ag-grid-angular/src/tests/<feature>.ng.ts`, a route in `dev/ag-grid-angular/src/main.ts`, and `<feature>.playwright-spec.ts` next to the component.
6. Document it in `packages/ag-grid-angular-theme/README.md`. Shortcuts and state persistence each have a table there; the host-component and renderer families have no section yet, so add one rather than shipping the feature undocumented. Never edit `CHANGELOG.md`; `nx release` generates it from commits.

## Testing

Unit tests (Jest, `jest-preset-angular` with zone, `@testing-library/angular`'s `render()`):

- `test-setup.ts` enables `jest-fail-on-console`: any `console.*` output during a test fails it.
- Two established patterns. For directive logic, a stub `@Directive({ selector: 'ag-grid-angular', providers: [{ provide: AgGridAngular, useExisting: ... }] })` exposes `Subject`s for the grid outputs and a hand-rolled `GridApi` mock (`column-state.ng.spec.ts`). For behaviour that needs the real grid, use `AgGridModule` with `ModuleRegistry.registerModules([AllCommunityModule])` (`theme.ng.spec.ts`).

E2E tests (Playwright, `playwright.config.ts` at the repo root):

- The config starts `yarn run dev:theme` itself through `webServer` (reused if already running). Do not start a server manually. One Chromium project, 1200x720 viewport, `deviceScaleFactor: 2`, reduced motion, 15 s test timeout, 2 s expect timeout.
- `toHaveScreenshot('<feature>-<state>-<light|dark>.png')` writes to `__screenshots__/` with `threshold: 0`; `toMatchSnapshot('*.txt')` writes to `__snapshots__/`. Dark variants call `enableDarkTheme(page)` from `src/tests/utils/theme.ts`.
- Screenshots are only reproducible inside the Docker image in `tools/e2e` (`linux/arm64`, the same image CI uses on `ubuntu-24.04-arm`). Never commit screenshots generated on a host OS. Alternatively, comment `/approve-snapshots` on the PR and CI regenerates and commits them.

## Conventions Enforced by Tooling

- File suffixes select lint rule sets. `angular-eslint` rules and inline-template linting apply only to `**/*.ng.ts`; `*.spec.ts` gets the Jest rules, `*.playwright-spec.ts` the Playwright rules and `tsconfig.playwright-spec.json`. External Angular templates are `*.ng.html`.
- Naming prefixes are enforced by `@typescript-eslint/naming-convention`: exported symbols under `packages/` are `kbq...`, `Kbq...` or `KBQ_...`; under `dev/` they are `dev...`, `Dev...` or `DEV_...`. Selectors are `kbqAgGrid*` attributes and `kbq-*` elements in the package, `dev*` and `dev-*` in the dev app.
- `typescript-eslint`'s `all` preset is active. Use `type` aliases, not `interface`; prefix unused parameters with `_`; where AG Grid's untyped `row.data` forces a `no-unsafe-*` violation, add a targeted `eslint-disable-next-line` as the existing code does instead of loosening the config.
- Stylelint: class selectors must start with `kbq-`, `ag-` or `cdk-` (`dev-` is also allowed under `dev/`), nesting depth is limited to 2, mixins are kebab-case, and `@use` must be namespaced.
- Prettier: 4-space indent, 120 columns, single quotes, no trailing commas. Imports are sorted by `prettier-plugin-organize-imports`, so do not order them by hand.
- `lint-staged` runs prettier, `eslint --max-warnings=0` and `stylelint --max-warnings=0` on commit, and CI runs the same, so lint warnings are effectively errors.

## Commits, PRs and Releases

- Conventional Commits, checked by commitlint on each commit message and on the PR title (PRs are squash-merged, so the title becomes the commit on `main`). Allowed scopes: `ag-grid-angular-theme`, `deps`, `deps-dev`, `release`; header max 120 characters. Package changes look like `feat(ag-grid-angular-theme): added KbqAgGridX directive (#DS-1234)`, with the tracker ticket in parentheses.
- Releases are a maintainer action: `yarn run release:theme` runs `nx release` locally (independent versioning, tag `ag-grid-angular-theme@X.Y.Z`, changelog and GitHub release from the conventional commits). Pushing that tag triggers `publish.yml`, which publishes to npm with provenance. `yarn run release:theme:preview` is the dry run.
- The package major version tracks the supported AG Grid major (34.x pairs with `ag-grid-community@^34`). Older majors are maintained on `ag-grid-angular-theme-<major>.x` branches such as `ag-grid-angular-theme-33.0.x`.

## Best Practices

<!-- Based on Angular team recommendations: https://angular.dev/assets/context/best-practices.md -->

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

### TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain
- Prefer `readonly` where appropriate (e.g., signals, injections)
- Use `protected` for template bindings
- All public methods and properties MUST have a comment describing their purpose (JSDoc format is optional)

### Angular Best Practices

- Always use standalone components over NgModules
- This project is on Angular 18: set `standalone: true` explicitly on every component and directive (it only becomes the default in Angular 19)
- Use signals for state management
- Implement lazy loading for feature routes
- Do NOT use the `@HostBinding` and `@HostListener` decorators. Put host bindings inside the `host` object of the `@Component` or `@Directive` decorator instead
- Use `NgOptimizedImage` for all static images.
- `NgOptimizedImage` does not work for inline base64 images.

### Accessibility Requirements

- It MUST pass all AXE checks.
- It MUST follow all WCAG AA minimums, including focus management, color contrast, and ARIA attributes.

### Components

- Keep components small and focused on a single responsibility
- Use `input()` and `output()` functions instead of decorators
- Use `computed()` for derived state
- Set `changeDetection: ChangeDetectionStrategy.OnPush` in `@Component` decorator
- Prefer inline templates for small components
- Prefer Reactive forms instead of Template-driven ones
- Do NOT use `ngClass`, use `class` bindings instead
- Do NOT use `ngStyle`, use `style` bindings instead
- When using external templates/styles, use paths relative to the component TS file.

### State Management

- Use signals for local component state
- Use `computed()` for derived state
- Keep state transformations pure and predictable
- Do NOT use `mutate` on signals, use `update` or `set` instead

### Templates

- Keep templates simple and avoid complex logic
- Use native control flow (`@if`, `@for`, `@switch`) instead of `*ngIf`, `*ngFor`, `*ngSwitch`
- Use the async pipe to handle observables
- Do not assume globals like (`new Date()`) are available.
- Do not write arrow functions in templates (they are not supported).
- Do not use `as` aliases in `@else if (...)`, e.g. `@else if (bla(); as x)` is invalid.

### Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

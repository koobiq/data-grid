# @koobiq/ag-grid-angular-theme

[![NPM Version](https://img.shields.io/npm/v/%40koobiq%2Fag-grid-angular-theme?label=%40koobiq%2Fag-grid-angular-theme&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40koobiq%2Fag-grid-angular-theme)](https://www.npmjs.com/package/@koobiq/ag-grid-angular-theme)

The package provides a theme for the [ag-grid-angular@^34](https://www.ag-grid.com/archive/34.3.1/angular-data-grid/) (see [overview](https://data-grid-next.web.app/)).

Navigation:

- [Installation](#installation)
- [Usage](#usage)
- [Custom Keyboard Shortcuts](#custom-keyboard-shortcuts)
- [State Persistence](#state-persistence)
- [Development](#development)

## Installation

```bash
npm install @koobiq/ag-grid-angular-theme@^34 ag-grid-community@^34 ag-grid-angular@^34
```

## Usage

Setup your main [`styles.scss`](/dev/ag-grid-angular/src/styles.scss) file:

```scss
// Import theme
@use '@koobiq/ag-grid-angular-theme';

// Import @koobiq/icons
// https://github.com/koobiq/icons
@use '@koobiq/icons/fonts/kbq-icons';

// Import @koobiq/design-tokens
// https://github.com/koobiq/design-tokens
@use '@koobiq/design-tokens/web/css-tokens';
@use '@koobiq/design-tokens/web/css-tokens-light';
@use '@koobiq/design-tokens/web/css-tokens-dark';

// Import Inter font
// https://koobiq.io/en/main/typography/overview#installing-fonts
@import '@fontsource/inter/400.css';
@import '@fontsource/inter/500.css';
@import '@fontsource/inter/600.css';
@import '@fontsource/inter/700.css';
@import '@fontsource/inter/400-italic.css';
@import '@fontsource/inter/500-italic.css';
```

Apply the theme for `<ag-grid-angular>` in your template:

```ts
import { KbqAgGridTheme } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';

@Component({
    imports: [AgGridModule, KbqAgGridTheme],
    template: `<ag-grid-angular kbqAgGridTheme />`
})
```

### Custom keyboard shortcuts

You can apply custom keyboard shortcuts by adding the corresponding directives to your `<ag-grid-angular>` component.

| Key             | Action                        | Directive                         |
| --------------- | ----------------------------- | --------------------------------- |
| `Tab`           | Move focus to the next row    | `kbqAgGridToNextRowByTab`         |
| `Shift + ↓↑`    | Select multiple rows          | `kbqAgGridSelectRowsByShiftArrow` |
| `Ctrl + Click`  | Select row                    | `kbqAgGridSelectRowsByCtrlClick`  |
| `Ctrl + C`      | Copy selected rows            | `kbqAgGridCopyByCtrlC`            |
| `Shift + Click` | Select/deselect range of rows | `kbqAgGridSelectRowsByShiftClick` |

### State persistence

Directives for persisting and restoring grid state across page reloads.

#### Column state

`kbqAgGridColumnState` saves sort order, column order, visibility, and width.

```html
<ag-grid-angular kbqAgGridTheme kbqAgGridColumnState="my-grid" />
```

Use `#ref="kbqAgGridColumnState"` and call `ref.reset()` to clear the stored state.

#### Filter state

`kbqAgGridFilterState` saves column filter models (text, number, date filters).

```html
<ag-grid-angular kbqAgGridTheme kbqAgGridFilterState="my-grid-filters" />
```

Use `#ref="kbqAgGridFilterState"` and call `ref.reset()` to clear the stored state.

#### Quick filter state

`kbqAgGridQuickFilterState` saves the quick filter text input across page reloads.

Because the quick filter input lives outside the grid, the directive exposes a `value` signal
with the current filter text. Bind it to your search input's `[value]` so the input stays in
sync after state is restored.

```html
<input
    placeholder="Search..."
    [value]="qf.value()"
    (input)="api.setGridOption('quickFilterText', $event.target.value)"
/>
<ag-grid-angular kbqAgGridTheme #qf="kbqAgGridQuickFilterState" kbqAgGridQuickFilterState="my-grid-quick-filter" />
```

Use `qf.reset()` to clear both the stored state and the active filter.

#### Built-in stores

All three directives share the same store method shape (`getItem` / `setItem` / `removeItem`) but have type-specific value types (`ColumnState[]`, `FilterModel`, `string`). Built-in implementations:

| Store                    | Class                                                                                                                            | Description                                                                                                             |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `localStorage` (default) | `KbqAgGridColumnStateLocalStorageStore` / `KbqAgGridFilterStateLocalStorageStore` / `KbqAgGridQuickFilterStateLocalStorageStore` | Persists state in the browser's `localStorage`. Survives page reloads and browser restarts.                             |
| URL query params         | `KbqAgGridColumnStateQueryParamsStore` / `KbqAgGridFilterStateQueryParamsStore` / `KbqAgGridQuickFilterStateQueryParamsStore`    | Persists state as a URL query parameter. Shareable via URL. Uses `replaceUrl: true` to avoid polluting browser history. |

Override the default store using the provider helper:

```ts
// Column state
providers: [kbqAgGridColumnStateStoreProvider(KbqAgGridColumnStateQueryParamsStore)];

// Filter state
providers: [kbqAgGridFilterStateStoreProvider(KbqAgGridFilterStateQueryParamsStore)];

// Quick filter state
providers: [kbqAgGridQuickFilterStateStoreProvider(KbqAgGridQuickFilterStateQueryParamsStore)];
```

Pass a custom store instance by implementing the corresponding store interface:

```ts
class MyStore implements KbqAgGridFilterStateStore {
    getItem(key: string) { ... }
    setItem(key: string, value: FilterModel) { ... }
    removeItem(key: string) { ... }
}

providers: [kbqAgGridFilterStateStoreProvider(new MyStore())]
```

```ts
class MyQuickFilterStore implements KbqAgGridQuickFilterStateStore {
    getItem(key: string) { ... }
    setItem(key: string, value: string) { ... }
    removeItem(key: string) { ... }
}

providers: [kbqAgGridQuickFilterStateStoreProvider(new MyQuickFilterStore())]
```

---

## Development

### Setup Node.js

Make sure you have the [correct version](.nvmrc) of Node.js installed (we recommend use [nvm](https://github.com/nvm-sh/nvm)):

```bash
nvm use
```

### Install dependencies

```bash
yarn install
```

### Run dev application

```bash
yarn run dev:theme
```

Then open http://localhost:4200/

### Build package

```bash
yarn run build:theme
```

### Unit tests

```bash
yarn run unit:theme
```

### Create GitHub release and publish

```bash
yarn run release:theme
```

Once the GitHub release is created, the package is automatically published to NPM using GitHub [Publish Action](.github/workflows/publish.yml).

To preview the release process without actually publishing the package, run:

```bash
yarn run release:theme:preview X.X.X
```

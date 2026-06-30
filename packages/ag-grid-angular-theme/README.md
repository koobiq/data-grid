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
| `Ctrl + A`      | Select all rows               | `kbqAgGridInfiniteSelection`      |

### State persistence

Directives for persisting and restoring grid state across page reloads.

| Directive                      | Saves                                 | Built-in stores                                                                                           |
| ------------------------------ | ------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `kbqAgGridColumnState`         | Sort, column order, visibility, width | `KbqAgGridColumnStateLocalStorageStore` (default), `KbqAgGridColumnStateQueryParamsStore`                 |
| `kbqAgGridFilterState`         | Column filter models                  | `KbqAgGridFilterStateLocalStorageStore` (default), `KbqAgGridFilterStateQueryParamsStore`                 |
| `kbqAgGridQuickFilterState`    | Quick filter text                     | `KbqAgGridQuickFilterStateLocalStorageStore` (default), `KbqAgGridQuickFilterStateQueryParamsStore`       |
| `kbqAgGridExternalFilterState` | External filter value                 | `KbqAgGridExternalFilterStateLocalStorageStore` (default), `KbqAgGridExternalFilterStateQueryParamsStore` |

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

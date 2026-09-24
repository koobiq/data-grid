# @koobiq/ag-grid-angular-theme

[![NPM Version](https://img.shields.io/npm/v/%40koobiq%2Fag-grid-angular-theme?label=%40koobiq%2Fag-grid-angular-theme&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40koobiq%2Fag-grid-angular-theme)](https://www.npmjs.com/package/@koobiq/ag-grid-angular-theme)

The package provides a theme for the [ag-grid-angular@^34](https://www.ag-grid.com/archive/34.3.1/angular-data-grid/) (see [overview](https://data-grid-next.web.app/)).

Navigation:

- [Installation](#installation)
- [Usage](#usage)
- [Custom Keyboard Shortcuts](#custom-keyboard-shortcuts)
- [State Persistence](#state-persistence)
- [Loading and Load Failures](#loading-and-load-failures)
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
| `kbqAgGridRowSelectionState`   | Selected row ids                      | `KbqAgGridRowSelectionStateLocalStorageStore` (default), `KbqAgGridRowSelectionStateQueryParamsStore`     |
| `kbqAgGridRowFocusState`       | Focused cell (row id, column id)      | `KbqAgGridRowFocusStateLocalStorageStore` (default), `KbqAgGridRowFocusStateQueryParamsStore`             |

`kbqAgGridRowSelectionState` and `kbqAgGridRowFocusState` also need `getRowId` set on the grid, so that row identity survives a reload.

### Loading and load failures

While a page of the infinite row model is loading, its rows have no data. Render `KbqAgGridSkeletonCellRenderer` for them through `cellRendererSelector`. Bar widths vary from cell to cell so that the placeholder reads as text of differing length; the variation is derived from the cell's position, so it never changes between renders.

Add `kbqAgGridSkeletonSelection` to show a skeleton in the selection column as well, instead of a checkbox for a row that has no data yet. It merges into `selectionColumnDef`, so it composes with other directives that configure that column.

Two AG Grid options control how many skeleton rows appear, both defaulting to `1`:

| Option                    | Rows it governs                                                   |
| ------------------------- | ----------------------------------------------------------------- |
| `infiniteInitialRowCount` | Skeleton rows on the first load, before anything has arrived.     |
| `cacheOverflowSize`       | Skeleton rows trailing the loaded data while the next page loads. |

Before the grid exists at all, `kbqAgGridLoadingOverlay` puts a grid-shaped placeholder in its place — a header row plus `rows` rows of `cols` columns, the first of them a fixed `firstColWidth`:

```ts
providers: [kbqAgGridLoadingOverlayConfigProvider({ rows: 3, cols: 3, firstColWidth: '120px' })];
```

When a page fails to load, `kbqAgGridLoadError` replaces it with a full width error row carrying a retry link. The row scrolls vertically with the data, stays put during horizontal scrolling and spans the pinned columns. AG Grid's `failCallback()` leaves the rows of a failed block blank forever and raises no grid event, so the datasource has to report the failure to the directive itself:

```ts
@Component({
    imports: [AgGridModule, KbqAgGridTheme, KbqAgGridLoadError],
    template: `
        <ag-grid-angular
            kbqAgGridTheme
            kbqAgGridLoadError
            rowModelType="infinite"
            [datasource]="datasource"
            (kbqAgGridLoadErrorRetry)="onRetry()"
        />
    `
})
export class MyGrid {
    private readonly loadError = viewChild.required(KbqAgGridLoadError);

    protected readonly datasource: IDatasource = {
        getRows: (params: IGetRowsParams): void => {
            this.fetchPage(params.startRow, params.endRow).subscribe({
                next: ({ rows, lastRow }) => params.successCallback(rows, lastRow),
                error: () => {
                    params.failCallback();
                    this.loadError().fail(params.startRow);
                }
            });
        }
    };
}
```

| Member                     | Description                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------- |
| `fail(startRow)`           | Replaces the failed page with the error row and stops the grid requesting further blocks.   |
| `retry()`                  | Removes the error row and re-requests the failed page. Also bound to the retry link.        |
| `clear()`                  | Removes the error row without requesting anything. Call before reloading the grid yourself. |
| `failedAtRow`              | Signal holding the index of the error row, or `null`.                                       |
| `kbqAgGridLoadErrorRetry`  | Emitted after the cache has been refreshed.                                                 |
| `kbqAgGridLoadErrorLabels` | Overrides the labels for a single grid.                                                     |

Labels default to Russian. Supply English ones — or your own — through the provider:

```ts
providers: [kbqAgGridLoadErrorLabelsProvider(KBQ_AG_GRID_LOAD_ERROR_LABELS_EN)];
```

Retrying calls `refreshInfiniteCache()`, which marks **every** cached block for reload — Community has no per-block retry. Keep a cache of already fetched pages in your datasource and serve hits from it, so that only the failed page actually reaches the network.

The directive owns the `fullWidthCellRenderer` grid option, so it cannot be combined with custom full width rows.

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

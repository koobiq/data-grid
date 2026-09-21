# @koobiq/ag-grid-angular-theme

[![NPM Version](https://img.shields.io/npm/v/%40koobiq%2Fag-grid-angular-theme?label=%40koobiq%2Fag-grid-angular-theme&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40koobiq%2Fag-grid-angular-theme)](https://www.npmjs.com/package/@koobiq/ag-grid-angular-theme)

The package provides a theme for the [ag-grid-angular@^34](https://www.ag-grid.com/archive/34.3.1/angular-data-grid/) (see [overview](https://data-grid-next.web.app/)).

Navigation:

- [Installation](#installation)
- [Usage](#usage)
- [Expandable Rows](#expandable-rows)
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

### Expandable rows

`kbqAgGridRowDetail` expands a row to show your own component below its cells — a nested grid, a code block, plain text. It does not need AG Grid Enterprise's Master Detail: the expanded part belongs to the row itself, so row indexes, row counts, selection, sorting, filtering, pagination and CSV export stay exactly as they are without the directive.

```ts
import { KBQ_AG_GRID_ROW_DETAIL_PARAMS, KbqAgGridRowDetail, KbqAgGridTheme } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';

@Component({
    template: `
        <div>{{ athlete }}</div>
    `
})
export class MyRowDetail {
    private readonly params = inject(KBQ_AG_GRID_ROW_DETAIL_PARAMS);
}

@Component({
    imports: [AgGridModule, KbqAgGridTheme, KbqAgGridRowDetail],
    template: `
        <ag-grid-angular
            kbqAgGridTheme
            kbqAgGridRowDetail
            [getRowId]="getRowId"
            [kbqAgGridRowDetailComponent]="detailComponent"
        />
    `
})
export class MyGrid {
    protected readonly detailComponent = MyRowDetail;
    protected readonly getRowId: GetRowIdFunc = ({ data }) => data.id;
}
```

| Input                            | Description                                                                                                                                                                              |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `kbqAgGridRowDetailComponent`    | Component rendered in the expanded part, or a function picking one per row (`null` makes the row non-expandable)                                                                         |
| `kbqAgGridRowDetailSingleExpand` | Collapses the previously expanded row when another one is expanded. `false` by default                                                                                                   |
| `kbqAgGridRowDetailFilled`       | Fills an expanded row with `--kbq-background-contrast-less` and stops it from reacting to hover, active, selection and focus. Collapsed rows keep the default states. `false` by default |
| `kbqAgGridRowDetailToggleColumn` | `colId` of the column hosting the expand toggle. Defaults to the first non-pinned column                                                                                                 |
| `kbqAgGridRowDetailHeight`       | Fixed height (px) of the expanded part. By default the detail component's own host height is measured instead                                                                            |
| `kbqAgGridRowDetailExpanded`     | Ids of the expanded rows, supports two-way binding                                                                                                                                       |
| `kbqAgGridRowDetailLabels`       | Screen reader labels of the expand/collapse toggle. Russian by default, English preset is `KBQ_AG_GRID_ROW_DETAIL_LABELS_EN`                                                             |
| `kbqAgGridRowDetailState`        | Key under which the expanded rows are persisted (see [State persistence](#state-persistence))                                                                                            |

The component is created on expand and destroyed on collapse, and receives `{ api, node, data, rowIndex }` through the `KBQ_AG_GRID_ROW_DETAIL_PARAMS` token. Its own host element defines the height of the expanded part, so a component that grows while loading its data grows the row with it. Expanding and collapsing from your own UI goes through `#rowDetail="kbqAgGridRowDetail"`, which exposes `expand()`, `collapse()`, `toggle()` and `collapseAll()`.

Keep in mind:

- Set `getRowId` — expanded rows are tracked by row id.
- Not supported with the infinite row model, which gives every row the same height.
- The toggle column must not use `cellRendererSelector`: AG Grid gives it precedence over the `cellRenderer` the directive injects, so the toggle would not be rendered.
- With pinned columns the expanded part spans the center (non-pinned) section only; the pinned sections of the row stay empty.
- Not combinable with `kbqAgGridRowGroup`: that directive rebuilds `columnDefs` from its own snapshot of your definitions, so the injected toggle would be rewritten on every grouping change.

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

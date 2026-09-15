# @koobiq/ag-grid-angular-theme

[![NPM Version](https://img.shields.io/npm/v/%40koobiq%2Fag-grid-angular-theme?label=%40koobiq%2Fag-grid-angular-theme&link=https%3A%2F%2Fwww.npmjs.com%2Fpackage%2F%40koobiq%2Fag-grid-angular-theme)](https://www.npmjs.com/package/@koobiq/ag-grid-angular-theme)

The package provides a theme for the [ag-grid-angular@^34](https://www.ag-grid.com/archive/34.3.1/angular-data-grid/) (see [overview](https://data-grid-next.web.app/)).

Navigation:

- [Installation](#installation)
- [Usage](#usage)
- [Settings Menu](#settings-menu)
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

### Settings menu

`kbqAgGridSettingsMenu` adds a table settings button to the grid header. Nested levels open in place of the list,
with a back button in the header.

```ts
import { KbqAgGridSettingsMenu, KbqAgGridTheme } from '@koobiq/ag-grid-angular-theme';

@Component({
    imports: [AgGridModule, KbqAgGridTheme, KbqAgGridSettingsMenu],
    template: `<ag-grid-angular kbqAgGridTheme kbqAgGridSettingsMenu />`
})
```

By default the menu contains two items:

| Item      | Factory                              | Lets the user                                            |
| --------- | ------------------------------------ | -------------------------------------------------------- |
| `Columns` | `kbqAgGridSettingsMenuColumnsItem()` | Show, hide, pin and reorder columns                      |
| `Sorting` | `kbqAgGridSettingsMenuSortItem()`    | Sort by several columns, change direction and sort order |

- `Reset to default` restores the columns or the sorting from the column definitions.
- The sorting screen lists only sortable columns. A column whose `sortingOrder` has a single direction cannot change
  it, and with `suppressMultiSort` only one column can be sorted.
- Columns with an icon-only header are named after `headerTooltip`.

#### Custom items

Pass `kbqAgGridSettingsMenuItems` to reorder or drop the built-in items and add your own:

```ts
export class MyGrid {
    readonly density = signal<'compact' | 'normal'>('normal');

    readonly items: KbqAgGridSettingsMenuItems = [
        kbqAgGridSettingsMenuColumnsItem(),
        kbqAgGridSettingsMenuSortItem(),
        kbqAgGridSettingsMenuSeparator(),
        {
            id: 'density',
            label: 'Density',
            icon: 'kbq-bars-sort-center_16',
            mode: 'single',
            value: this.density,
            items: (['compact', 'normal'] as const).map((density) => ({
                id: density,
                label: density,
                checked: computed(() => this.density() === density),
                keepOpen: true,
                action: () => this.density.set(density)
            }))
        },
        {
            id: 'refresh',
            label: 'Refresh',
            icon: 'kbq-arrows-rotate_16',
            action: (api) => api.refreshCells({ force: true })
        }
    ];
}
```

| Property                        | Description                                                                               |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `id`, `label`, `icon`           | Identifier, title and a [@koobiq/icons](https://github.com/koobiq/icons) class            |
| `value`, `valueIcon`, `counter` | Value, icon and `+N` counter to the right of the title                                    |
| `items`, `mode`                 | Nested list; with `mode: 'single'` it becomes a single-value selector marked by `checked` |
| `screen`, `screenTitle`         | Nested level rendered by your component                                                   |
| `action`, `keepOpen`            | Handler of a leaf item; the menu closes after it unless `keepOpen` is set                 |
| `reset`                         | Handler of the `Reset to default` button of the nested level                              |
| `disabled`, `hidden`            | Item state                                                                                |

`label`, `screenTitle`, `value`, `valueIcon`, `counter`, `checked`, `disabled` and `hidden` accept a value, a signal or a
function `(api, labels) => value`. Functions are re-evaluated when the menu opens and when columns or sorting change; use
signals for other state.

The factories of the built-in items accept overrides of these properties, e.g.
`kbqAgGridSettingsMenuSortItem({ hidden: true })`.

If the menu has a single item with a nested level, the button opens that level directly. A menu of
`kbqAgGridSettingsMenuColumnsItem()` alone replaces the deprecated `kbqAgGridColumnMenu`, which will be removed in the
next major release.

#### Custom screen

A `screen` component receives `KBQ_AG_GRID_SETTINGS_MENU_PARAMS`: the grid `api`, `back()`, `close()` and
`setResetHandler()`, which shows the `Reset to default` button and returns a function that hides it.

```ts
@Component({
    selector: 'my-screen',
    standalone: true,
    template: '<button (click)="params.close()">Close</button>'
})
export class MyScreen {
    protected readonly params = inject(KBQ_AG_GRID_SETTINGS_MENU_PARAMS);

    constructor() {
        inject(DestroyRef).onDestroy(this.params.setResetHandler(() => this.params.api.resetColumnState()));
    }
}
```

The menu does not handle `←` and `Esc` in text fields or when the screen calls `event.preventDefault()`, and clicks
in CDK overlays opened from the screen do not close it.

#### Keyboard

| Key             | Action                                                   |
| --------------- | -------------------------------------------------------- |
| `↓` `↑`         | Move between items                                       |
| `Enter` `Space` | Activate the item                                        |
| `→`             | Open the nested level                                    |
| `←`             | Return to the previous level                             |
| `Esc`           | Return to the previous level, close the menu at the root |
| `Tab`           | Close the menu; move between controls in a screen        |

#### Labels

The default labels are Russian. Pass `KBQ_AG_GRID_SETTINGS_MENU_LABELS_EN` or your own strings to the
`kbqAgGridSettingsMenuLabels` input or `kbqAgGridSettingsMenuLabelsProvider()`. The columns screen takes its labels from
`kbqAgGridColumnMenuLabelsProvider()`.

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

# @koobiq/ag-grid-theme

The `@koobiq/ag-grid-theme` package provides a customizable theme for the AG Grid library.

## Installation

```bash
npm install @koobiq/ag-grid-theme ag-grid-community@^30
```

## Usage

Import theme into your main [`styles.scss`](/dev/angular-ag-grid/src/styles.scss):

```css
@use '@koobiq/ag-grid-theme';
```

Apply theme for `<ag-grid-angular>` into your template:

```ts
import { KbqAgGridTheme } from '@koobiq/ag-grid-theme';
import { AgGridModule } from 'ag-grid-angular';

@Component({
    imports: [AgGridModule, KbqAgGridTheme],
    template: `<ag-grid-angular kbqAgGridTheme />`
})
```

## Development

Install dependencies:

```bash
yarn install
```

Run dev server:

```bash
yarn run dev
```

Then open http://localhost:4200/

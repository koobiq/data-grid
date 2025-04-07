# @koobiq/ag-grid-theme

The package provides a theme for the AG Grid library.

## Installation

```bash
npm install @koobiq/ag-grid-theme ag-grid-community@^30
```

## Usage

Import theme into your main [`styles.scss`](/dev/angular-ag-grid/src/styles.scss) file:

```css
@use '@koobiq/ag-grid-theme';
```

Import [`@koobiq/icons`](https://github.com/koobiq/icons):

```css
@use '@koobiq/icons/fonts/kbq-icons';
```

Import [`@koobiq/design-tokens`](https://github.com/koobiq/design-tokens):

```css
@use '@koobiq/design-tokens/web/css-tokens';
@use '@koobiq/design-tokens/web/css-tokens-light';
@use '@koobiq/design-tokens/web/css-tokens-dark';
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

## Build

```bash
yarn run build:theme
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

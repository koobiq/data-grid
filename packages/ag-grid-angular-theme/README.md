# @koobiq/ag-grid-angular-theme

The package provides a theme for the AG Grid library (see [example](https://data-grid-next.web.app/)).

## Installation

```bash
npm install @koobiq/ag-grid-angular-theme ag-grid-community@^30
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

Apply theme for `<ag-grid-angular>` into your template:

```ts
import { KbqAgGridTheme } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';

@Component({
    imports: [AgGridModule, KbqAgGridTheme],
    template: `<ag-grid-angular kbqAgGridTheme />`
})
```

## Create GitHub Release and Publish

To create a new GitHub release, run the following command:

```bash
yarn run release:theme
```

Once the GitHub release is created, the package is automatically published to NPM using GitHub [Publish Action](.github/workflows/publish.yml).

## Development

Make sure you have the [correct version](.nvmrc) of Node.js installed (we recommend use [nvm](https://github.com/nvm-sh/nvm)):

```bash
nvm use
```

Install dependencies:

```bash
yarn install
```

Run dev server:

```bash
yarn run dev
```

Then open http://localhost:4200/

## Build

```bash
yarn run build:theme
```

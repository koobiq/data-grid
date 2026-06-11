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
yarn dev:theme                    # Serve dev app (port 4200)

# Building
yarn build:theme                  # Build the publishable theme package
yarn build                        # Build all projects

# Lint (runs prettier, eslint, stylelint in parallel)
npm run lint

# Auto-fix lint errors
npm run lint:fix

# Unit Testing (Jest)
yarn unit:theme                   # Run unit tests for the theme package
yarn unit                         # Run unit tests for all projects
yarn jest <TEST_PATH_PATTERN>     # Run specific unit tests (e.g., yarn jest packages/ag-grid-angular-theme/tests/theme.ng.spec.ts)


# E2E Testing (Playwright)
yarn e2e:setup                              # Install Playwright browsers
yarn e2e:dev-ag-grid-angular                # Run E2E tests
yarn playwright test <TEST_PATH_PATTERN>    # Run specific E2E tests (e.g., yarn playwright test dev/ag-grid-angular/src/tests/theme.playwright-spec.ts)

# Clean
yarn clean                        # Reset Nx cache, clear Playwright cache, remove dist/tmp
```

## Repository Structure

This is a yarn monorepo managed with Nx.

```
packages/
└── ag-grid-angular-theme/                  # Published npm package
    ├── src/
    │   ├── theme.scss                      # AG Grid SCSS customization with @koobiq/design-tokens
    │   ├── *.ng.ts                         # Theme component/directive
    │   └── module.ng.ts                    # Angular module
    ├── tests/
    │   └── *.spec.ts                       # Unit tests (jest)
    └── index.ts                            # Public API exports

dev/
└── ag-grid-angular/                        # Demo app for development and E2E testing
    ├── src/main.ts                         # Application entry point
    └── src/tests/                          # Playwright E2E tests
        ├── utils/*.ts                      # Utility functions for E2E tests
        ├── *.ng.ts                         # E2e test components
        └── *.playwright-spec.ts            # E2e test specs (playwright)
```

## Best Practices

<!-- Based on Angular team recommendations: https://angular.dev/assets/context/best-practices.md -->

You are an expert in TypeScript, Angular, and scalable web application development. You write functional, maintainable, performant, and accessible code following Angular and TypeScript best practices.

### TypeScript Best Practices

- Use strict type checking
- Prefer type inference when the type is obvious
- Avoid the `any` type; use `unknown` when type is uncertain
- Prefer `readonly` where appropriate (e.g., signals, injections)
- Use `protected` for template bindings
- All public methods and properties MUST have a JSDoc comment describing their purpose

### Angular Best Practices

- Always use standalone components over NgModules
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

### Services

- Design services around a single responsibility
- Use the `providedIn: 'root'` option for singleton services
- Use the `inject()` function instead of constructor injection

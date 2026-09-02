/**
 * `eslint-plugin-promise` does not ship type definitions.
 *
 * @see https://github.com/eslint-community/eslint-plugin-promise/issues/486
 */
declare module 'eslint-plugin-promise' {
    import type { Linter } from 'eslint';

    const plugin: { configs: Record<string, Linter.Config> };

    export default plugin;
}

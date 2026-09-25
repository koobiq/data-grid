import { ColDef, ColGroupDef } from 'ag-grid-community';

/**
 * Recursively walks a `(ColDef | ColGroupDef)[]` tree, applying `transform` to every leaf
 * `ColDef` — including ones nested under `ColGroupDef.children` — and returns a new tree.
 * `ColGroupDef` nodes are shallow-cloned with their `children` replaced; they have no
 * `field`/`comparator` of their own to transform.
 */
export function kbqMapColDefTree(
    defs: readonly (ColDef | ColGroupDef)[],
    transform: (def: ColDef) => ColDef
): (ColDef | ColGroupDef)[] {
    return defs.map((def) =>
        'children' in def ? { ...def, children: kbqMapColDefTree(def.children, transform) } : transform(def)
    );
}

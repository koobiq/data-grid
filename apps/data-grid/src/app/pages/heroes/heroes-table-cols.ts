import { TableGridUtils } from '@koobiq/ag-grid';

export type HeroesTableUtils = TableGridUtils<any>;

export function colID(util: HeroesTableUtils) {
    return util.colDef<string>({
        colId: 'id',
        headerValueGetter: () => 'Item ID',
        field: 'id'
    });
}

export function colDatePublished(util: HeroesTableUtils) {
    return util.colDef<number>({
        colId: 'date_published',
        headerValueGetter: () => 'Date Published',
        field: 'date_published'
    });
}

export function colTitle(util: HeroesTableUtils) {
    return util.colDef<string>({
        colId: 'description',
        headerValueGetter: () => 'Description',
        field: 'description',
        width: 400,
        valueFormatter: ({ value }) => value[1]
    });
}

export function colType(util: HeroesTableUtils) {
    return util.colDef<string>({
        colId: 'type',
        headerValueGetter: () => 'Type',
        field: 'type',
        valueFormatter: ({ value }) => value['display']
    });
}

export function colAuthor(util: HeroesTableUtils) {
    return util.colDef<string>({
        colId: 'author',
        headerValueGetter: () => 'Author',
        field: 'author',
        valueFormatter: ({ value }) => value['name']
    });
}

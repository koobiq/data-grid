import { TableGridUtils } from '@koobiq/ag-grid';

export type AgentsTableUtils = TableGridUtils<any>;

export function colName(util: AgentsTableUtils) {
    return util.colDef<string>({
        colId: 'agent',
        headerValueGetter: () => 'Name',
        field: 'agent',
        valueFormatter: ({ value }) => value['description']
    });
}

export function colIP(util: AgentsTableUtils) {
    return util.colDef<number>({
        colId: 'agent_info',
        headerValueGetter: () => 'IP',
        field: 'agent_info',
        valueFormatter: ({ value }) => value['ip']
    });
}

export function colNameGroup(util: AgentsTableUtils) {
    return util.colDef<string>({
        colId: 'agent_info',
        headerValueGetter: () => 'Group Name',
        field: 'agent_info',
        width: 100,
        valueFormatter: ({ value }) => value['net']['hostname']
    });
}

import { TableGridUtils } from '@koobiq/ag-grid';

export type AgentsTableUtils = TableGridUtils<any>;

export function colName(util: AgentsTableUtils) {
    return util.colDef<string>({
        colId: 'agent',
        headerValueGetter: () => 'Событие',
        field: 'agent',
        width: 300,
        valueFormatter: ({ value }) => value['description']
    });
}

export function colIP(util: AgentsTableUtils) {
    return util.colDef<number>({
        colId: 'agent_info',
        headerValueGetter: () => 'IP-адрес',
        field: 'agent_info',
        valueFormatter: ({ value }) => value['ip']
    });
}

export function colNameGroup(util: AgentsTableUtils) {
    return util.colDef<string>({
        colId: 'agent_info',
        headerValueGetter: () => 'Информация агента',
        field: 'agent_info',
        width: 100,
        valueFormatter: ({ value }) => value['net']['hostname'],
        flex: 1
    });
}

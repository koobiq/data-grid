import { ChangeDetectionStrategy, Component } from '@angular/core';
import { KbqAgGridThemeModule } from '@koobiq/ag-grid-angular-theme';
import { AgGridModule } from 'ag-grid-angular';
import { AllCommunityModule, ColDef, GridApi, GridReadyEvent, ModuleRegistry } from 'ag-grid-community';
import { jsPDF } from 'jspdf';
import { autoTable } from 'jspdf-autotable';
import { utils, writeFile } from 'xlsx';
import { devInjectRowData } from '../row-data';

ModuleRegistry.registerModules([AllCommunityModule]);

const COLUMN_DEFS: ColDef[] = [
    { field: 'athlete', headerName: 'Athlete' },
    { field: 'age', headerName: 'Age' },
    { field: 'country', headerName: 'Country' },
    { field: 'year', headerName: 'Year' },
    { field: 'date', headerName: 'Date' },
    { field: 'sport', headerName: 'Sport' },
    { field: 'gold', headerName: 'Gold' },
    { field: 'silver', headerName: 'Silver' },
    { field: 'bronze', headerName: 'Bronze' },
    { field: 'total', headerName: 'Total' }
];

type ExportTable = {
    headers: string[];
    rows: string[][];
};

@Component({
    standalone: true,
    imports: [AgGridModule, KbqAgGridThemeModule],
    selector: 'dev-export',
    template: `
        <div>
            <button type="button" data-testid="e2eDownloadCsvButton" (click)="downloadCsv()">Download CSV</button>
            <button type="button" data-testid="e2eDownloadXlsxButton" (click)="downloadXlsx()">Download XLSX</button>
            <button type="button" data-testid="e2eDownloadPdfButton" (click)="downloadPdf()">Download PDF</button>
        </div>

        <ag-grid-angular
            data-testid="e2eScreenshotTarget"
            kbqAgGridTheme
            animateRows="false"
            [rowData]="rowData()"
            [columnDefs]="columnDefs"
            (gridReady)="onGridReady($event)"
        />
    `,
    styles: `
        :host {
            display: flex;
            flex-direction: column;
            gap: var(--kbq-size-m);
            padding: var(--kbq-size-m);
        }

        ag-grid-angular {
            height: 500px;
            max-width: 2036px;
        }
    `,
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DevExport {
    protected readonly rowData = devInjectRowData();
    protected readonly columnDefs = COLUMN_DEFS;
    private api!: GridApi;
    private readonly filename = 'export';

    /** Stores the grid API once the grid finishes initializing. */
    protected onGridReady(event: GridReadyEvent): void {
        this.api = event.api;
    }

    /** Downloads the grid data as a .csv file. */
    protected downloadCsv(): void {
        this.api.exportDataAsCsv({ fileName: `${this.filename}.csv` });
    }

    /** Downloads the grid data as an .xlsx file. */
    protected downloadXlsx(): void {
        const table = this.getExportTable();
        if (!table) return;
        const worksheet = utils.aoa_to_sheet([table.headers, ...table.rows]);
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, worksheet, 'Export');
        writeFile(workbook, `${this.filename}.xlsx`);
    }

    /** Downloads the grid data as a .pdf file. */
    protected downloadPdf(): void {
        const table = this.getExportTable();
        if (!table) return;
        const pdf = new jsPDF({ orientation: 'landscape' });
        autoTable(pdf, { head: [table.headers], body: table.rows, theme: 'plain' });
        pdf.save(`${this.filename}.pdf`);
    }

    /** Reads the currently displayed columns and rows (respecting filter, sort and formatters). */
    private getExportTable(): ExportTable | null {
        const columns = this.api.getAllDisplayedColumns();
        const headers = columns.map((column) => column.getColDef().headerName ?? column.getColId());
        const rows: string[][] = [];

        this.api.forEachNodeAfterFilterAndSort((node) => {
            if (!node.data) return;

            rows.push(
                columns.map(
                    (column) => this.api.getCellValue({ rowNode: node, colKey: column, useFormatter: true }) ?? ''
                )
            );
        });

        return { headers, rows };
    }
}

import { ICellRendererParams } from 'ag-grid-community';
import { KbqAgGridSkeletonCellRenderer, kbqAgGridSkeletonCells } from '../src/skeleton-cell-renderer.ng';
import { KbqAgGridSkeletonSelectionCellComponent, kbqAgGridSkeletonCheckbox } from '../src/skeleton-selection.ng';

/** Both selectors only read `data`, so a bare object stands in for the full params. */
const paramsWithData = (data: unknown): ICellRendererParams =>
    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion
    ({ data }) as ICellRendererParams;

describe('kbqAgGridSkeletonCheckbox', () => {
    it('renders the skeleton square for a row that has not loaded', () => {
        expect(kbqAgGridSkeletonCheckbox()(paramsWithData(undefined))).toEqual({
            component: KbqAgGridSkeletonSelectionCellComponent
        });
    });

    it('leaves a loaded row to the checkbox AG Grid renders itself', () => {
        expect(kbqAgGridSkeletonCheckbox()(paramsWithData({ id: '1' }))).toBeUndefined();
    });
});

describe('kbqAgGridSkeletonCells', () => {
    it('renders the skeleton bar for a row that has not loaded', () => {
        expect(kbqAgGridSkeletonCells()(paramsWithData(undefined))).toEqual({
            component: KbqAgGridSkeletonCellRenderer
        });
    });

    it("leaves a loaded row to the column's own renderer", () => {
        expect(kbqAgGridSkeletonCells()(paramsWithData({ id: '1' }))).toBeUndefined();
    });
});

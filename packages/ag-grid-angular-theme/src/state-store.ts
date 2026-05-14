type AsyncLike<T> = T | Promise<T>;

/**
 * Generic storage interface for persisting and retrieving ag-grid state.
 *
 * Supports both synchronous and Promise-based implementations.
 */
export type KbqAgGridStateStore<T = unknown> = {
    getItem: (key: string) => AsyncLike<T | null>;
    setItem: (key: string, value: T) => AsyncLike<void>;
    removeItem: (key: string) => AsyncLike<void>;
};

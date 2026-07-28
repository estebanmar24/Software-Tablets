export type ColumnSortState = { key: string; dir: 'asc' | 'desc' } | null;

export const VACIO_FILTER_LABEL = '(Vacío)';

export function normalizeFilterCellValue(value: string | null | undefined): string {
    const v = String(value ?? '').trim();
    return v || VACIO_FILTER_LABEL;
}

export function getUniqueColumnValues<T>(
    rows: T[],
    getValue: (row: T) => string
): string[] {
    const set = new Set<string>();
    rows.forEach((row) => set.add(normalizeFilterCellValue(getValue(row))));
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base', numeric: true }));
}

export function applyColumnFilters<T>(
    rows: T[],
    filters: Record<string, string[] | null | undefined>,
    getFilterValue: (row: T, key: string) => string
): T[] {
    const activeKeys = Object.keys(filters).filter((k) => filters[k] != null);
    if (activeKeys.length === 0) return rows;

    return rows.filter((row) => {
        for (const key of activeKeys) {
            const selected = filters[key];
            if (!selected) continue;
            const val = normalizeFilterCellValue(getFilterValue(row, key));
            if (!selected.includes(val)) return false;
        }
        return true;
    });
}

export function applyColumnSort<T>(
    rows: T[],
    sort: ColumnSortState,
    getSortValue: (row: T, key: string) => string | number
): T[] {
    if (!sort) return rows;
    const copy = [...rows];
    copy.sort((a, b) => {
        const av = getSortValue(a, sort.key);
        const bv = getSortValue(b, sort.key);
        const cmp =
            typeof av === 'number' && typeof bv === 'number'
                ? av - bv
                : String(av).localeCompare(String(bv), 'es', { sensitivity: 'base', numeric: true });
        return sort.dir === 'asc' ? cmp : -cmp;
    });
    return copy;
}

export function columnFilterIsActive(filters: Record<string, string[] | null | undefined>, key: string): boolean {
    return filters[key] != null;
}

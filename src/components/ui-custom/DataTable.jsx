import React from 'react';
import { cn } from '@/lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, MoreHorizontal, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function DataTable({
  columns,
  data,
  loading = false,
  searchable = true,
  searchPlaceholder = 'Buscar...',
  emptyIcon: EmptyIcon,
  emptyTitle = 'Nenhum registro encontrado',
  emptyDescription = 'Não há dados para exibir no momento.',
  onRowClick,
  actions,
  rowActions,
  onBulkDelete,   // callback(ids[]) - se fornecido, habilita seleção em lote
  filterBar,      // elemento React extra (filtros) exibido ao lado do search
}) {
  const [search, setSearch] = React.useState('');
  const [sortColumn, setSortColumn] = React.useState(null);
  const [sortDirection, setSortDirection] = React.useState('asc');
  const [selectedIds, setSelectedIds] = React.useState(new Set());

  const handleSort = (column) => {
    if (!column.sortable) return;
    if (sortColumn === column.key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column.key);
      setSortDirection('asc');
    }
  };

  const filteredData = React.useMemo(() => {
    let result = [...data];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(row =>
        columns.some(col => {
          const value = row[col.key];
          return value && String(value).toLowerCase().includes(s);
        })
      );
    }
    if (sortColumn) {
      result.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];
        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return result;
  }, [data, search, sortColumn, sortDirection, columns]);

  // clear selection when data changes
  React.useEffect(() => { setSelectedIds(new Set()); }, [data]);

  const allVisibleIds = filteredData.map(r => r.id);
  const allSelected = allVisibleIds.length > 0 && allVisibleIds.every(id => selectedIds.has(id));
  const someSelected = allVisibleIds.some(id => selectedIds.has(id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allVisibleIds));
    }
  };

  const toggleRow = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDelete = () => {
    if (onBulkDelete) onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
  };

  const SortIcon = ({ column }) => {
    if (!column.sortable) return null;
    if (sortColumn !== column.key) return <ChevronsUpDown className="w-4 h-4 text-slate-400" />;
    return sortDirection === 'asc'
      ? <ChevronUp className="w-4 h-4" />
      : <ChevronDown className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <div className="h-10 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse w-64" />
        </div>
        <div className="divide-y divide-slate-200 dark:divide-slate-700">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="p-4 flex gap-4">
              {columns.map((_, j) => (
                <div key={j} className="h-5 bg-slate-100 dark:bg-slate-700 rounded animate-pulse flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      {/* Top bar: search + filters + actions */}
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          {searchable && (
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
              />
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {filterBar}
            {actions && <div className="flex gap-2">{actions}</div>}
          </div>
        </div>

        {/* Bulk action bar */}
        {onBulkDelete && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl px-4 py-2.5">
            <span className="text-sm font-medium text-red-700 dark:text-red-400">
              {selectedIds.size} {selectedIds.size === 1 ? 'item selecionado' : 'itens selecionados'}
            </span>
            <Button
              size="sm"
              variant="destructive"
              className="ml-auto gap-1.5"
              onClick={handleBulkDelete}
            >
              <Trash2 className="w-3.5 h-3.5" />
              Excluir selecionados
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelectedIds(new Set())}
              className="text-red-600"
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-900/50">
              {onBulkDelete && (
                <th className="w-10 px-4 py-3">
                  <Checkbox
                    checked={allSelected}
                    ref={el => { if (el) el.indeterminate = someSelected; }}
                    onCheckedChange={toggleAll}
                  />
                </th>
              )}
              {columns.map((column) => (
                <th
                  key={column.key}
                  onClick={() => handleSort(column)}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider',
                    column.sortable && 'cursor-pointer hover:text-slate-700 dark:hover:text-slate-300',
                    column.className
                  )}
                >
                  <div className="flex items-center gap-1">
                    {column.label}
                    <SortIcon column={column} />
                  </div>
                </th>
              ))}
              {rowActions && <th className="w-12" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (rowActions ? 1 : 0) + (onBulkDelete ? 1 : 0)} className="py-16">
                  <div className="flex flex-col items-center justify-center text-center">
                    {EmptyIcon && (
                      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-700 mb-4">
                        <EmptyIcon className="w-8 h-8 text-slate-400" />
                      </div>
                    )}
                    <p className="text-slate-800 dark:text-slate-200 font-medium">{emptyTitle}</p>
                    <p className="text-sm text-slate-500 mt-1 max-w-sm">{emptyDescription}</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((row, idx) => (
                <tr
                  key={row.id || idx}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50',
                    onBulkDelete && selectedIds.has(row.id) && 'bg-red-50/60 dark:bg-red-900/10'
                  )}
                >
                  {onBulkDelete && (
                    <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(row.id)}
                        onCheckedChange={() => toggleRow(row.id)}
                      />
                    </td>
                  )}
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-4 py-3.5', column.cellClassName)}>
                      {column.render ? column.render(row[column.key], row) : row[column.key]}
                    </td>
                  ))}
                  {rowActions && (
                    <td className="px-2" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {rowActions(row).map((action, i) => (
                            <DropdownMenuItem
                              key={i}
                              onClick={(e) => {
                                e.stopPropagation();
                                action.onClick();
                              }}
                              className={action.destructive ? 'text-red-600' : ''}
                            >
                              {action.icon && <action.icon className="w-4 h-4 mr-2" />}
                              {action.label}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
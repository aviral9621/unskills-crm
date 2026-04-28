import { useState } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type OnChangeFn,
} from '@tanstack/react-table'
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../lib/utils'

export interface ServerPagination {
  pageIndex: number
  pageSize: number
  totalRows: number
  onPageChange: (next: number) => void
  onPageSizeChange?: (size: number) => void
}

interface DataTableProps<T> {
  data: T[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  columns: ColumnDef<T, any>[]
  loading?: boolean
  searchValue?: string
  pageSize?: number
  emptyIcon?: React.ReactNode
  emptyMessage?: string
  onRowClick?: (row: T) => void
  showPageSizeSelector?: boolean
  /**
   * Optional server-side pagination control. When provided the table uses
   * the supplied page state instead of paginating the data itself —
   * required for datasets larger than what we want to ship to the
   * browser (e.g. thousands of students).
   */
  serverPagination?: ServerPagination
  /** Controlled sorting — emit changes back to parent for server-side ordering. */
  sorting?: SortingState
  onSortingChange?: OnChangeFn<SortingState>
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 200, 500]

function SkeletonRows({ cols, rows = 5 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-100">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <div className="skeleton h-4 w-full rounded" />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}

export default function DataTable<T>({
  data,
  columns,
  loading = false,
  searchValue = '',
  pageSize: initialPageSize = 10,
  emptyIcon,
  emptyMessage = 'No data found',
  onRowClick,
  showPageSizeSelector = true,
  serverPagination,
  sorting: controlledSorting,
  onSortingChange: controlledOnSortingChange,
}: DataTableProps<T>) {
  const isServer = !!serverPagination
  const [internalSorting, setInternalSorting] = useState<SortingState>([])
  const sorting = controlledSorting ?? internalSorting
  const setSorting = controlledOnSortingChange ?? setInternalSorting
  const [pageSizeLocal, setPageSizeLocal] = useState<number | 'all'>(initialPageSize)
  const effectivePageSize = isServer
    ? serverPagination!.pageSize
    : pageSizeLocal === 'all'
      ? Math.max(data.length, 1)
      : pageSizeLocal

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      globalFilter: isServer ? '' : searchValue,
      ...(isServer ? { pagination: { pageIndex: 0, pageSize: data.length || 1 } } : {}),
    },
    onSortingChange: setSorting,
    manualSorting: isServer,
    manualPagination: isServer,
    manualFiltering: isServer,
    pageCount: isServer
      ? Math.max(1, Math.ceil(serverPagination!.totalRows / Math.max(1, serverPagination!.pageSize)))
      : undefined,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: isServer ? undefined : getSortedRowModel(),
    getPaginationRowModel: isServer ? undefined : getPaginationRowModel(),
    getFilteredRowModel: isServer ? undefined : getFilteredRowModel(),
    initialState: isServer ? undefined : { pagination: { pageSize: effectivePageSize } },
  })

  // Keep client-mode pageSize in sync with the local selector
  if (!isServer && table.getState().pagination.pageSize !== effectivePageSize) {
    table.setPageSize(effectivePageSize)
  }

  const pageIndex = isServer ? serverPagination!.pageIndex : table.getState().pagination.pageIndex
  const totalPages = isServer
    ? Math.max(1, Math.ceil(serverPagination!.totalRows / Math.max(1, serverPagination!.pageSize)))
    : table.getPageCount()
  const totalRows = isServer ? serverPagination!.totalRows : table.getFilteredRowModel().rows.length

  function goToPage(next: number) {
    if (isServer) serverPagination!.onPageChange(Math.max(0, Math.min(next, totalPages - 1)))
    else table.setPageIndex(next)
  }
  function nextPage() {
    if (isServer) serverPagination!.onPageChange(Math.min(pageIndex + 1, totalPages - 1))
    else table.nextPage()
  }
  function prevPage() {
    if (isServer) serverPagination!.onPageChange(Math.max(pageIndex - 1, 0))
    else table.previousPage()
  }
  const canPrev = isServer ? pageIndex > 0 : table.getCanPreviousPage()
  const canNext = isServer ? pageIndex < totalPages - 1 : table.getCanNextPage()

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="bg-gray-50 border-b border-gray-200">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap',
                      header.column.getCanSort() && 'cursor-pointer select-none hover:text-gray-700'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-gray-300">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp size={14} className="text-gray-600" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown size={14} className="text-gray-600" />
                          ) : (
                            <ChevronsUpDown size={14} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {loading ? (
              <SkeletonRows cols={columns.length} />
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    {emptyIcon}
                    <p className="text-sm">{emptyMessage}</p>
                  </div>
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-gray-100 transition-colors',
                    onRowClick ? 'cursor-pointer hover:bg-red-50/40' : 'hover:bg-gray-50/60'
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && totalRows > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-4 px-1">
          <div className="flex items-center gap-3 text-xs text-gray-500">
            {showPageSizeSelector && (
              <div className="flex items-center gap-1.5">
                <span>Show</span>
                <select
                  value={isServer ? String(effectivePageSize) : (pageSizeLocal === 'all' ? 'all' : String(pageSizeLocal))}
                  onChange={(e) => {
                    if (isServer) {
                      serverPagination!.onPageSizeChange?.(Number(e.target.value))
                    } else {
                      setPageSizeLocal(e.target.value === 'all' ? 'all' : Number(e.target.value))
                    }
                  }}
                  className="px-2 py-1 rounded-md border border-gray-300 text-xs text-gray-700 bg-white focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                  {!isServer && <option value="all">All</option>}
                </select>
              </div>
            )}
            <span>
              {!isServer && pageSizeLocal === 'all' ? (
                <>Showing all <b>{totalRows}</b></>
              ) : (
                <>Showing <b>{pageIndex * effectivePageSize + 1}</b>–<b>{Math.min((pageIndex + 1) * effectivePageSize, totalRows)}</b> of <b>{totalRows}</b></>
              )}
            </span>
          </div>
          {(isServer || pageSizeLocal !== 'all') && totalPages > 1 && (
            <div className="flex items-center gap-1">
              <button
                onClick={prevPage}
                disabled={!canPrev}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }).map((_, i) => {
                let pageNum = i
                if (totalPages > 7) {
                  if (pageIndex < 4) pageNum = i
                  else if (pageIndex > totalPages - 5) pageNum = totalPages - 7 + i
                  else pageNum = pageIndex - 3 + i
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => goToPage(pageNum)}
                    className={cn(
                      'h-8 w-8 rounded-lg text-xs font-medium transition-colors',
                      pageNum === pageIndex ? 'bg-red-600 text-white' : 'text-gray-600 hover:bg-gray-100'
                    )}
                  >
                    {pageNum + 1}
                  </button>
                )
              })}
              <button
                onClick={nextPage}
                disabled={!canNext}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

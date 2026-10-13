import React from 'react'

export interface Column<T> {
  key: string
  title: string
  width?: string
  align?: 'left' | 'center' | 'right'
  render?: (row: T) => React.ReactNode
}

/** 统一数据表格 */
export function DataTable<T extends { id?: string | number }>({ columns, rows, keyOf, emptyText = '暂无数据' }: {
  columns: Column<T>[]
  rows: T[]
  keyOf?: (row: T, index: number) => string | number
  emptyText?: string
}) {
  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted">{emptyText}</div>
    )
  }
  return (
    <div className="overflow-x-auto -mx-5 px-5">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {columns.map(col => (
              <th
                key={col.key}
                className={`py-2.5 pr-4 font-medium text-muted text-xs whitespace-nowrap ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                style={col.width ? { width: col.width } : undefined}
              >
                {col.title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={keyOf ? keyOf(row, i) : (row.id ?? i)} className="border-b border-border/50 last:border-0 hover:bg-white/[0.02]">
              {columns.map(col => (
                <td
                  key={col.key}
                  className={`py-2.5 pr-4 text-on-surface ${col.align === 'center' ? 'text-center' : col.align === 'right' ? 'text-right' : 'text-left'}`}
                >
                  {col.render ? col.render(row) : String((row as any)[col.key] ?? '--')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

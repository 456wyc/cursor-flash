import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import type { FilterPayload } from './api'

interface FilterState {
  categories: string[]
  composerIds: string[]
  olderThanMs: number | null
  setCategories: (cats: string[]) => void
  toggleCategory: (cat: string) => void
  setComposerIds: (ids: string[]) => void
  toggleComposerId: (id: string) => void
  setOlderThanMs: (ms: number | null) => void
  clearAll: () => void
  hasCriteria: boolean
  toPayload: () => FilterPayload
}

const FilterContext = createContext<FilterState | null>(null)

export function FilterProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<string[]>([])
  const [composerIds, setComposerIds] = useState<string[]>([])
  const [olderThanMs, setOlderThanMs] = useState<number | null>(null)

  const hasCriteria =
    categories.length > 0 || composerIds.length > 0 || olderThanMs !== null

  const value = useMemo<FilterState>(
    () => ({
      categories,
      composerIds,
      olderThanMs,
      hasCriteria,
      setCategories,
      setComposerIds,
      setOlderThanMs,
      clearAll: () => {
        setCategories([])
        setComposerIds([])
        setOlderThanMs(null)
      },
      toggleCategory: (cat) =>
        setCategories((prev) =>
          prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
        ),
      toggleComposerId: (id) =>
        setComposerIds((prev) =>
          prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id],
        ),
      toPayload: () => ({
        categories,
        composer_ids: composerIds,
        older_than_ms: olderThanMs,
      }),
    }),
    [categories, composerIds, olderThanMs, hasCriteria],
  )

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>
}

export function useFilter(): FilterState {
  const ctx = useContext(FilterContext)
  if (!ctx) throw new Error('useFilter must be used within FilterProvider')
  return ctx
}

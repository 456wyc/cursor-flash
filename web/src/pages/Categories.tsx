import { useEffect, useState } from 'react'
import { formatBytes, getCategories, type CategoryStat } from '../api'
import { useFilter } from '../FilterContext'

export default function Categories() {
  const { categories: selected, toggleCategory, setCategories } = useFilter()
  const [stats, setStats] = useState<CategoryStat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCategories()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  function selectAll() {
    setCategories(stats.map((s) => s.category))
  }

  function clearAll() {
    setCategories([])
  }

  return (
    <div>
      <h2>Categories</h2>
      <p className="muted">Select categories to include in the clean filter.</p>
      {error && <div className="error">{error}</div>}

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button onClick={selectAll} disabled={loading || stats.length === 0}>
          Select all
        </button>
        <button onClick={clearAll} disabled={loading}>
          Clear
        </button>
        <span className="muted">{selected.length} selected</span>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : stats.length === 0 ? (
        <p className="muted">No categories found. Run a scan from Overview first.</p>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <th>Category</th>
              <th>Rows</th>
              <th>Size</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.category}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(s.category)}
                    onChange={() => toggleCategory(s.category)}
                  />
                </td>
                <td>{s.category}</td>
                <td>{s.row_count.toLocaleString()}</td>
                <td>{formatBytes(s.total_bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

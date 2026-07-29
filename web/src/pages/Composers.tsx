import { useEffect, useState } from 'react'
import { formatBytes, getComposers, type ComposerStat } from '../api'
import { useFilter } from '../FilterContext'

export default function Composers() {
  const { composerIds: selected, toggleComposerId, setComposerIds } = useFilter()
  const [stats, setStats] = useState<ComposerStat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getComposers()
      .then(setStats)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [])

  function selectAll() {
    setComposerIds(stats.map((s) => s.composer_id))
  }

  function clearAll() {
    setComposerIds([])
  }

  return (
    <div>
      <h2>Composers</h2>
      <p className="muted">Select composer IDs to include in the clean filter.</p>
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
        <p className="muted">No composers found. Run a scan from Overview first.</p>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <th>Composer ID</th>
              <th>Rows</th>
              <th>Size</th>
              <th>Last updated</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.composer_id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selected.includes(s.composer_id)}
                    onChange={() => toggleComposerId(s.composer_id)}
                  />
                </td>
                <td>{s.composer_id}</td>
                <td>{s.row_count.toLocaleString()}</td>
                <td>{formatBytes(s.total_bytes)}</td>
                <td>
                  {s.last_updated_ms
                    ? new Date(s.last_updated_ms).toLocaleString()
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

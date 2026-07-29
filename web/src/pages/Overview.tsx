import { useCallback, useEffect, useState } from 'react'
import {
  formatBytes,
  getCategories,
  getStatus,
  pollJob,
  startScan,
  type CategoryStat,
  type DbStatus,
  type Job,
} from '../api'

export default function Overview() {
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [job, setJob] = useState<Job | null>(null)

  const loadStatus = useCallback(async () => {
    try {
      setError(null)
      const s = await getStatus()
      setStatus(s)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const loadCategories = useCallback(async () => {
    try {
      const cats = await getCategories()
      setCategories(cats)
    } catch {
      setCategories([])
    }
  }, [])

  useEffect(() => {
    loadStatus()
  }, [loadStatus])

  async function handleScan() {
    setScanning(true)
    setError(null)
    setJob(null)
    try {
      const { job_id } = await startScan()
      const finished = await pollJob(job_id, setJob)
      if (finished.status === 'error') {
        throw new Error(finished.error ?? 'Scan failed')
      }
      await loadStatus()
      await loadCategories()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  const sizeGb = status ? (status.size_bytes / 1024 ** 3).toFixed(2) : '—'

  return (
    <div>
      <h2>Overview</h2>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <dl>
          <dt>Database size</dt>
          <dd>{sizeGb} GB</dd>
          <dt>Cursor running</dt>
          <dd>
            {status === null ? (
              '…'
            ) : status.cursor_running ? (
              <span className="badge badge-warn">Yes</span>
            ) : (
              <span className="badge badge-ok">No</span>
            )}
          </dd>
          <dt>Index stale</dt>
          <dd>
            {status === null ? (
              '…'
            ) : status.index_stale ? (
              <span className="badge badge-warn">Yes — scan recommended</span>
            ) : (
              <span className="badge badge-ok">No</span>
            )}
          </dd>
        </dl>
        <div className="actions">
          <button className="primary" onClick={handleScan} disabled={scanning}>
            {scanning ? 'Scanning…' : 'Scan Index'}
          </button>
          <button onClick={loadStatus} disabled={scanning}>
            Refresh
          </button>
        </div>
        {scanning && job && (
          <div className="progress">
            {job.message || job.status} ({Math.round(job.progress)}%)
          </div>
        )}
      </div>

      {categories.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Categories summary</h3>
          <div className="summary-grid">
            {categories.map((c) => (
              <div key={c.category} className="summary-item">
                <strong>{c.category}</strong>
                <span>
                  {c.row_count.toLocaleString()} rows · {formatBytes(c.total_bytes)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {categories.length === 0 && status && !status.index_stale && status.index_path && (
        <p className="muted">Run scan to refresh category summary, or index may be empty.</p>
      )}
    </div>
  )
}

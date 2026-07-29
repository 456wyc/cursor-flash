import { useEffect, useState } from 'react'
import { getStatus, type DbStatus } from '../api'

export default function Settings() {
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div>
      <h2>Settings</h2>
      <p className="muted">Read-only path and safety configuration (v1).</p>

      {error && <div className="error">{error}</div>}

      {status && (
        <div className="card">
          <dl>
            <dt>Database path</dt>
            <dd>{status.db_path}</dd>
            <dt>Index path</dt>
            <dd>{status.index_path ?? '(none)'}</dd>
            <dt>Safety level</dt>
            <dd>
              <span className="badge badge-warn">Level {status.safety_level}</span>
            </dd>
            <dt>Database exists</dt>
            <dd>{status.exists ? 'Yes' : 'No'}</dd>
          </dl>
        </div>
      )}

      {!status && !error && <p>Loading…</p>}
    </div>
  )
}

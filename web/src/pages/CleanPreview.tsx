import { useState } from 'react'
import {
  formatBytes,
  pollJob,
  previewClean,
  startRebuild,
  type Job,
  type PreviewResult,
} from '../api'
import { useFilter } from '../FilterContext'

const DEFAULT_DEST = 'E:/cursor-vscdb-tool/new-state.vscdb'

export default function CleanPreview() {
  const { toPayload } = useFilter()
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [destDb, setDestDb] = useState(DEFAULT_DEST)
  const [replaceOriginal, setReplaceOriginal] = useState(false)
  const [doBackup, setDoBackup] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [job, setJob] = useState<Job | null>(null)

  async function handlePreview() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    setPreview(null)
    try {
      const result = await previewClean(toPayload())
      setPreview(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleRebuild() {
    setRebuilding(true)
    setError(null)
    setSuccess(null)
    setJob(null)
    try {
      const { job_id } = await startRebuild(
        toPayload(),
        destDb,
        replaceOriginal,
        doBackup,
      )
      const finished = await pollJob(job_id, setJob)
      if (finished.status === 'error') {
        throw new Error(finished.error ?? 'Rebuild failed')
      }
      setSuccess(`Rebuild complete. Result: ${JSON.stringify(finished.result)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div>
      <h2>Clean Preview</h2>
      <p className="muted">
        Preview how many rows and bytes match the current filter, then run rebuild.
      </p>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="actions">
        <button className="primary" onClick={handlePreview} disabled={loading || rebuilding}>
          {loading ? 'Loading preview…' : 'Preview clean'}
        </button>
      </div>

      {preview && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <dl>
            <dt>Matching rows</dt>
            <dd>{preview.row_count.toLocaleString()}</dd>
            <dt>Total bytes</dt>
            <dd>{formatBytes(preview.total_bytes)}</dd>
          </dl>
        </div>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Rebuild options</h3>

        <div className="form-row">
          <label htmlFor="dest-db">Destination DB path</label>
          <input
            id="dest-db"
            type="text"
            value={destDb}
            onChange={(e) => setDestDb(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label>
            <input
              type="checkbox"
              checked={replaceOriginal}
              onChange={(e) => setReplaceOriginal(e.target.checked)}
            />
            Replace original database
          </label>
        </div>

        <div className="form-row">
          <label>
            <input
              type="checkbox"
              checked={doBackup}
              onChange={(e) => setDoBackup(e.target.checked)}
            />
            Create backup before rebuild
          </label>
        </div>

        <div className="actions">
          <button
            className="primary"
            onClick={handleRebuild}
            disabled={rebuilding || !destDb.trim()}
          >
            {rebuilding ? 'Rebuilding…' : 'Start rebuild'}
          </button>
        </div>

        {rebuilding && job && (
          <div className="progress">
            {job.message || job.status}
          </div>
        )}
      </div>
    </div>
  )
}

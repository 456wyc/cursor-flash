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
import { useI18n } from '../i18n/I18nContext'

export default function Overview() {
  const { t, describeCategory } = useI18n()
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [categories, setCategories] = useState<CategoryStat[]>([])
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [loading, setLoading] = useState(true)
  const [job, setJob] = useState<Job | null>(null)

  const loadCategories = useCallback(async () => {
    try {
      const cats = await getCategories()
      setCategories(cats)
    } catch {
      setCategories([])
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      setError(null)
      const s = await getStatus()
      setStatus(s)
      if (s.index_path) {
        await loadCategories()
      } else {
        setCategories([])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setCategories([])
    } finally {
      setLoading(false)
    }
  }, [loadCategories])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function handleScan() {
    setScanning(true)
    setError(null)
    setJob(null)
    try {
      const { job_id } = await startScan()
      const finished = await pollJob(job_id, setJob)
      if (finished.status === 'error') {
        throw new Error(finished.error ?? t('overview.scanFailed'))
      }
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setScanning(false)
    }
  }

  const sizeGb = status ? (status.size_bytes / 1024 ** 3).toFixed(2) : '—'

  return (
    <div>
      <h2>{t('overview.title')}</h2>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <dl>
          <dt>{t('overview.dbSize')}</dt>
          <dd>{sizeGb} GB</dd>
          <dt>{t('overview.cursorRunning')}</dt>
          <dd>
            {status === null ? (
              '…'
            ) : status.cursor_running ? (
              <span className="badge badge-warn">{t('common.yes')}</span>
            ) : (
              <span className="badge badge-ok">{t('common.no')}</span>
            )}
          </dd>
          <dt>{t('overview.indexStale')}</dt>
          <dd>
            {status === null ? (
              '…'
            ) : status.index_stale ? (
              <span className="badge badge-warn">{t('overview.indexStaleYes')}</span>
            ) : (
              <span className="badge badge-ok">{t('common.no')}</span>
            )}
          </dd>
          <dt>{t('overview.indexPath')}</dt>
          <dd className="path-value">{status?.index_path ?? t('common.none')}</dd>
        </dl>
        <div className="actions">
          <button className="primary" onClick={handleScan} disabled={scanning}>
            {scanning ? t('overview.scanning') : t('overview.scan')}
          </button>
          <button onClick={() => void refresh()} disabled={scanning || loading}>
            {t('common.refresh')}
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
          <h3 style={{ marginTop: 0 }}>{t('overview.categoriesSummary')}</h3>
          {status?.index_stale && (
            <p className="muted" style={{ marginTop: 0 }}>
              {t('overview.staleDataNote')}
            </p>
          )}
          <div className="summary-grid">
            {categories.map((c) => (
              <div key={c.category} className="summary-item" title={describeCategory(c.category)}>
                <strong>{c.category}</strong>
                <span>
                  {c.row_count.toLocaleString()} · {formatBytes(c.total_bytes)}
                </span>
                <p className="summary-desc">{describeCategory(c.category)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && categories.length === 0 && (
        <p className="muted">{t('overview.emptyHint')}</p>
      )}
    </div>
  )
}

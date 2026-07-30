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
import { useI18n } from '../i18n/I18nContext'

const DEFAULT_DEST = 'E:/cursor-vscdb-tool/new-state.vscdb'

export default function CleanPreview() {
  const { t } = useI18n()
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
        throw new Error(finished.error ?? t('preview.rebuildFailed'))
      }
      setSuccess(
        t('preview.rebuildComplete', { result: JSON.stringify(finished.result) }),
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRebuilding(false)
    }
  }

  return (
    <div>
      <h2>{t('preview.title')}</h2>
      <p className="muted">{t('preview.hint')}</p>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="actions">
        <button className="primary" onClick={handlePreview} disabled={loading || rebuilding}>
          {loading ? t('preview.previewLoading') : t('preview.previewBtn')}
        </button>
      </div>

      {preview && (
        <div className="card" style={{ marginTop: '1rem' }}>
          <dl>
            <dt>{t('preview.matchingRows')}</dt>
            <dd>{preview.row_count.toLocaleString()}</dd>
            <dt>{t('preview.totalBytes')}</dt>
            <dd>{formatBytes(preview.total_bytes)}</dd>
          </dl>
        </div>
      )}

      <div className="card" style={{ marginTop: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>{t('preview.rebuildOptions')}</h3>

        <div className="form-row">
          <label htmlFor="dest-db">{t('preview.destDb')}</label>
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
            {t('preview.replaceOriginal')}
          </label>
        </div>

        <div className="form-row">
          <label>
            <input
              type="checkbox"
              checked={doBackup}
              onChange={(e) => setDoBackup(e.target.checked)}
            />
            {t('preview.doBackup')}
          </label>
        </div>

        <div className="actions">
          <button
            className="primary"
            onClick={handleRebuild}
            disabled={rebuilding || !destDb.trim()}
          >
            {rebuilding ? t('preview.rebuilding') : t('preview.startRebuild')}
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

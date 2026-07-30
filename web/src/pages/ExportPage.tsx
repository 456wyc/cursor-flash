import { useState } from 'react'
import { exportReport } from '../api'
import { useI18n } from '../i18n/I18nContext'

export default function ExportPage() {
  const { t } = useI18n()
  const [outDir, setOutDir] = useState('E:/cursor-flash/export')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await exportReport(outDir)
      setSuccess(t('export.success', { path: result.out_dir }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>{t('export.title')}</h2>
      <p className="muted">{t('export.hint')}</p>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="form-row">
          <label htmlFor="out-dir">{t('export.outDir')}</label>
          <input
            id="out-dir"
            type="text"
            value={outDir}
            onChange={(e) => setOutDir(e.target.value)}
          />
        </div>

        <div className="actions">
          <button
            className="primary"
            onClick={handleExport}
            disabled={loading || !outDir.trim()}
          >
            {loading ? t('export.exporting') : t('export.exportBtn')}
          </button>
        </div>
      </div>
    </div>
  )
}

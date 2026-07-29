import { useState } from 'react'
import { exportReport } from '../api'

export default function ExportPage() {
  const [outDir, setOutDir] = useState('E:/cursor-vscdb-tool/export')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    setError(null)
    setSuccess(null)
    try {
      const result = await exportReport(outDir)
      setSuccess(`Report exported to: ${result.out_dir}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h2>Export</h2>
      <p className="muted">Export index statistics report to a directory.</p>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="form-row">
          <label htmlFor="out-dir">Output directory</label>
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
            {loading ? 'Exporting…' : 'Export report'}
          </button>
        </div>
      </div>
    </div>
  )
}

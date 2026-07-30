import { useEffect, useState } from 'react'
import { formatBytes, getComposers, type ComposerStat } from '../api'
import { useFilter } from '../FilterContext'
import { useI18n } from '../i18n/I18nContext'

export default function Composers() {
  const { t } = useI18n()
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
      <h2>{t('composers.title')}</h2>
      <p className="muted">{t('composers.hint')}</p>
      {error && <div className="error">{error}</div>}

      <div className="actions" style={{ marginBottom: '1rem' }}>
        <button onClick={selectAll} disabled={loading || stats.length === 0}>
          {t('common.selectAll')}
        </button>
        <button onClick={clearAll} disabled={loading}>
          {t('common.clear')}
        </button>
        <span className="muted">{t('common.selected', { count: selected.length })}</span>
      </div>

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : stats.length === 0 ? (
        <p className="muted">{t('composers.empty')}</p>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <th>{t('composers.composerId')}</th>
              <th>{t('common.rows')}</th>
              <th>{t('common.size')}</th>
              <th>{t('composers.lastUpdated')}</th>
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

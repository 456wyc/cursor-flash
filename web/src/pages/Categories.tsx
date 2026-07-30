import { useEffect, useState } from 'react'
import { formatBytes, getCategories, type CategoryStat } from '../api'
import { useFilter } from '../FilterContext'
import { useI18n } from '../i18n/I18nContext'

export default function Categories() {
  const { t } = useI18n()
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
      <h2>{t('categories.title')}</h2>
      <p className="muted">{t('categories.hint')}</p>
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
        <p className="muted">{t('categories.empty')}</p>
      ) : (
        <table className="list-table">
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <th>{t('categories.category')}</th>
              <th>{t('common.rows')}</th>
              <th>{t('common.size')}</th>
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

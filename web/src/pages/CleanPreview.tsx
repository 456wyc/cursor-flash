import { useEffect, useMemo, useState } from 'react'
import {
  formatBytes,
  getCategories,
  getComposers,
  pollJob,
  previewClean,
  startRebuild,
  type CategoryStat,
  type ComposerStat,
  type Job,
  type PreviewResult,
} from '../api'
import { useFilter } from '../FilterContext'
import { useI18n } from '../i18n/I18nContext'

const DEFAULT_DEST = 'E:/cursor-vscdb-tool/new-state.vscdb'

export default function CleanPreview() {
  const { t, describeCategory } = useI18n()
  const {
    categories: selectedCats,
    composerIds: selectedComposers,
    olderThanMs,
    toggleCategory,
    toggleComposerId,
    setOlderThanMs,
    setCategories,
    setComposerIds,
    clearAll,
    hasCriteria,
    toPayload,
  } = useFilter()

  const [catStats, setCatStats] = useState<CategoryStat[]>([])
  const [composerStats, setComposerStats] = useState<ComposerStat[]>([])
  const [composerQuery, setComposerQuery] = useState('')
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [destDb, setDestDb] = useState(DEFAULT_DEST)
  const [replaceOriginal, setReplaceOriginal] = useState(false)
  const [doBackup, setDoBackup] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const [listsLoading, setListsLoading] = useState(true)

  useEffect(() => {
    setListsLoading(true)
    Promise.all([getCategories(), getComposers()])
      .then(([cats, comps]) => {
        setCatStats(cats)
        setComposerStats(comps)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setListsLoading(false))
  }, [])

  // Clear stale preview when filter changes
  useEffect(() => {
    setPreview(null)
  }, [selectedCats, selectedComposers, olderThanMs])

  const filteredComposers = useMemo(() => {
    const q = composerQuery.trim().toLowerCase()
    if (!q) return composerStats
    return composerStats.filter((c) => c.composer_id.toLowerCase().includes(q))
  }, [composerStats, composerQuery])

  const dateValue =
    olderThanMs !== null ? new Date(olderThanMs).toISOString().slice(0, 10) : ''

  function handleDateChange(value: string) {
    if (!value) {
      setOlderThanMs(null)
      return
    }
    const ms = new Date(value + 'T00:00:00').getTime()
    setOlderThanMs(Number.isNaN(ms) ? null : ms)
  }

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
      <p className="muted">{t('preview.hintCombined')}</p>

      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}

      <div className="card">
        <div className="filter-card-head">
          <h3 style={{ margin: 0 }}>{t('preview.combinedFilter')}</h3>
          <button type="button" onClick={clearAll} disabled={!hasCriteria}>
            {t('preview.clearFilter')}
          </button>
        </div>
        <p className="muted" style={{ marginTop: '0.5rem' }}>
          {t('preview.andLogic')}
        </p>

        <div className="filter-summary">
          <div>
            <strong>{t('nav.categories')}</strong>:{' '}
            {selectedCats.length
              ? selectedCats.join(', ')
              : t('preview.anyCategory')}
          </div>
          <div>
            <strong>{t('nav.composers')}</strong>:{' '}
            {selectedComposers.length
              ? t('common.selected', { count: selectedComposers.length })
              : t('preview.anyComposer')}
          </div>
          <div>
            <strong>{t('nav.time')}</strong>:{' '}
            {olderThanMs !== null
              ? t('preview.beforeDate', {
                  date: new Date(olderThanMs).toLocaleString(),
                })
              : t('preview.anyTime')}
          </div>
        </div>

        {listsLoading ? (
          <p>{t('common.loading')}</p>
        ) : (
          <div className="filter-panels">
            <section className="filter-panel">
              <h4>{t('preview.pickCategories')}</h4>
              <div className="actions" style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setCategories(catStats.map((c) => c.category))}
                  disabled={catStats.length === 0}
                >
                  {t('common.selectAll')}
                </button>
                <button type="button" onClick={() => setCategories([])}>
                  {t('common.clear')}
                </button>
              </div>
              <div className="check-list">
                {catStats.map((c) => (
                  <label key={c.category} className="check-row" title={describeCategory(c.category)}>
                    <input
                      type="checkbox"
                      checked={selectedCats.includes(c.category)}
                      onChange={() => toggleCategory(c.category)}
                    />
                    <span className="check-main">
                      <span className="check-title">{c.category}</span>
                      <span className="muted">
                        {c.row_count.toLocaleString()} · {formatBytes(c.total_bytes)}
                      </span>
                      <span className="summary-desc">{describeCategory(c.category)}</span>
                    </span>
                  </label>
                ))}
                {catStats.length === 0 && (
                  <p className="muted">{t('categories.empty')}</p>
                )}
              </div>
            </section>

            <section className="filter-panel">
              <h4>{t('preview.pickComposers')}</h4>
              <div className="actions" style={{ marginBottom: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setComposerIds(composerStats.map((c) => c.composer_id))}
                  disabled={composerStats.length === 0}
                >
                  {t('common.selectAll')}
                </button>
                <button type="button" onClick={() => setComposerIds([])}>
                  {t('common.clear')}
                </button>
              </div>
              <input
                type="search"
                className="search-input"
                placeholder={t('preview.searchComposer')}
                value={composerQuery}
                onChange={(e) => setComposerQuery(e.target.value)}
              />
              <div className="check-list check-list-tall">
                {filteredComposers.map((c) => (
                  <label key={c.composer_id} className="check-row">
                    <input
                      type="checkbox"
                      checked={selectedComposers.includes(c.composer_id)}
                      onChange={() => toggleComposerId(c.composer_id)}
                    />
                    <span className="check-main">
                      <span className="check-title mono">{c.composer_id}</span>
                      <span className="muted">
                        {c.row_count.toLocaleString()} · {formatBytes(c.total_bytes)}
                        {c.last_updated_ms
                          ? ` · ${new Date(c.last_updated_ms).toLocaleString()}`
                          : ''}
                      </span>
                    </span>
                  </label>
                ))}
                {filteredComposers.length === 0 && (
                  <p className="muted">{t('composers.empty')}</p>
                )}
              </div>
            </section>

            <section className="filter-panel">
              <h4>{t('preview.pickTime')}</h4>
              <div className="form-row">
                <label htmlFor="preview-older-date">{t('time.olderDate')}</label>
                <input
                  id="preview-older-date"
                  type="date"
                  value={dateValue}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </div>
              <p className="muted">{t('preview.timeHint')}</p>
            </section>
          </div>
        )}
      </div>

      <div className="actions">
        <button
          className="primary"
          onClick={handlePreview}
          disabled={loading || rebuilding || !hasCriteria}
        >
          {loading ? t('preview.previewLoading') : t('preview.previewBtn')}
        </button>
        {!hasCriteria && (
          <span className="muted">{t('preview.needCriteria')}</span>
        )}
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
            disabled={rebuilding || !destDb.trim() || !hasCriteria}
          >
            {rebuilding ? t('preview.rebuilding') : t('preview.startRebuild')}
          </button>
        </div>

        {rebuilding && job && (
          <div className="progress">{job.message || job.status}</div>
        )}
      </div>
    </div>
  )
}

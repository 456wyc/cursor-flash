import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  formatBytes,
  getComposerDetail,
  previewClean,
  type ComposerDetail,
  type PreviewResult,
} from '../api'
import { useFilter } from '../FilterContext'
import { useI18n } from '../i18n/I18nContext'

export default function ComposerDetailPage() {
  const { composerId = '' } = useParams()
  const navigate = useNavigate()
  const { t, describeCategory } = useI18n()
  const { setComposerIds, setCategories, setOlderThanMs } = useFilter()

  const [detail, setDetail] = useState<ComposerDetail | null>(null)
  const [selectedCats, setSelectedCats] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => {
    if (!composerId) return
    setLoading(true)
    setError(null)
    getComposerDetail(composerId)
      .then((d) => {
        setDetail(d)
        // Default: select all categories for convenience
        setSelectedCats(d.categories.map((c) => c.category))
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [composerId])

  const selectedBytes = useMemo(() => {
    if (!detail) return 0
    return detail.categories
      .filter((c) => selectedCats.includes(c.category))
      .reduce((sum, c) => sum + c.total_bytes, 0)
  }, [detail, selectedCats])

  function toggleCat(cat: string) {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    )
    setPreview(null)
  }

  async function handlePreview() {
    if (!composerId || selectedCats.length === 0) return
    setPreviewLoading(true)
    setError(null)
    try {
      const result = await previewClean({
        categories: selectedCats,
        composer_ids: [composerId],
        older_than_ms: null,
      })
      setPreview(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setPreviewLoading(false)
    }
  }

  function applyToCleanPreview() {
    if (!composerId || selectedCats.length === 0) return
    setComposerIds([composerId])
    setCategories(selectedCats)
    setOlderThanMs(null)
    navigate('/preview')
  }

  if (loading) {
    return <p>{t('common.loading')}</p>
  }

  if (!detail) {
    return (
      <div>
        <p className="error">{error ?? t('composerDetail.notFound')}</p>
        <Link to="/composers">{t('composerDetail.back')}</Link>
      </div>
    )
  }

  const title = detail.name || detail.composer_id

  return (
    <div>
      <p className="muted">
        <Link to="/composers">{t('composerDetail.back')}</Link>
      </p>
      <h2>{t('composerDetail.title')}</h2>
      {error && <div className="error">{error}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{title}</h3>
        {detail.subtitle && <p className="muted">{detail.subtitle}</p>}
        <dl>
          <dt>{t('composers.composerId')}</dt>
          <dd className="mono">{detail.composer_id}</dd>
          <dt>{t('composerDetail.workspace')}</dt>
          <dd className="mono">{detail.workspace_id ?? t('common.none')}</dd>
          <dt>{t('composerDetail.mode')}</dt>
          <dd>{detail.unified_mode ?? '—'}</dd>
          <dt>{t('composers.lastUpdated')}</dt>
          <dd>
            {detail.last_updated_ms
              ? new Date(detail.last_updated_ms).toLocaleString()
              : '—'}
          </dd>
          <dt>{t('composerDetail.created')}</dt>
          <dd>
            {detail.created_at_ms
              ? new Date(detail.created_at_ms).toLocaleString()
              : '—'}
          </dd>
          <dt>{t('common.rows')}</dt>
          <dd>{detail.row_count.toLocaleString()}</dd>
          <dt>{t('common.size')}</dt>
          <dd>{formatBytes(detail.total_bytes)}</dd>
        </dl>
      </div>

      <div className="card">
        <div className="filter-card-head">
          <h3 style={{ margin: 0 }}>{t('composerDetail.partialClean')}</h3>
          <div className="actions" style={{ marginTop: 0 }}>
            <button
              type="button"
              onClick={() => setSelectedCats(detail.categories.map((c) => c.category))}
            >
              {t('common.selectAll')}
            </button>
            <button type="button" onClick={() => setSelectedCats([])}>
              {t('common.clear')}
            </button>
          </div>
        </div>
        <p className="muted">{t('composerDetail.partialHint')}</p>

        <table className="list-table">
          <thead>
            <tr>
              <th style={{ width: 40 }} />
              <th>{t('categories.category')}</th>
              <th>{t('categories.description')}</th>
              <th>{t('common.rows')}</th>
              <th>{t('common.size')}</th>
            </tr>
          </thead>
          <tbody>
            {detail.categories.map((c) => (
              <tr key={c.category}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedCats.includes(c.category)}
                    onChange={() => toggleCat(c.category)}
                  />
                </td>
                <td>{c.category}</td>
                <td className="muted">{describeCategory(c.category)}</td>
                <td>{c.row_count.toLocaleString()}</td>
                <td>{formatBytes(c.total_bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p className="muted" style={{ marginTop: '0.75rem' }}>
          {t('composerDetail.selectedEstimate', {
            count: selectedCats.length,
            size: formatBytes(selectedBytes),
          })}
        </p>

        <div className="actions">
          <button
            className="primary"
            onClick={handlePreview}
            disabled={previewLoading || selectedCats.length === 0}
          >
            {previewLoading ? t('preview.previewLoading') : t('preview.previewBtn')}
          </button>
          <button
            className="primary"
            onClick={applyToCleanPreview}
            disabled={selectedCats.length === 0}
          >
            {t('composerDetail.goClean')}
          </button>
        </div>

        {preview && (
          <dl style={{ marginTop: '1rem' }}>
            <dt>{t('preview.matchingRows')}</dt>
            <dd>{preview.row_count.toLocaleString()}</dd>
            <dt>{t('preview.totalBytes')}</dt>
            <dd>{formatBytes(preview.total_bytes)}</dd>
          </dl>
        )}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t('composerDetail.largestKeys')}</h3>
        <p className="muted">{t('composerDetail.samplesHint')}</p>
        <table className="list-table">
          <thead>
            <tr>
              <th>{t('categories.category')}</th>
              <th>{t('composerDetail.key')}</th>
              <th>{t('common.size')}</th>
            </tr>
          </thead>
          <tbody>
            {detail.samples.map((s) => (
              <tr key={s.key}>
                <td>{s.category}</td>
                <td className="mono">{s.key}</td>
                <td>{formatBytes(s.size_bytes)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

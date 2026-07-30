import { useFilter } from '../FilterContext'
import { useI18n } from '../i18n/I18nContext'

export default function TimeFilter() {
  const { t } = useI18n()
  const { olderThanMs, setOlderThanMs } = useFilter()

  const dateValue =
    olderThanMs !== null
      ? new Date(olderThanMs).toISOString().slice(0, 10)
      : ''

  function handleDateChange(value: string) {
    if (!value) {
      setOlderThanMs(null)
      return
    }
    const ms = new Date(value + 'T00:00:00').getTime()
    setOlderThanMs(Number.isNaN(ms) ? null : ms)
  }

  function handleMsChange(value: string) {
    if (value === '') {
      setOlderThanMs(null)
      return
    }
    const n = parseInt(value, 10)
    setOlderThanMs(Number.isNaN(n) ? null : n)
  }

  return (
    <div>
      <h2>{t('time.title')}</h2>
      <p className="muted">{t('time.hint')}</p>

      <div className="card">
        <div className="form-row">
          <label htmlFor="older-date">{t('time.olderDate')}</label>
          <input
            id="older-date"
            type="date"
            value={dateValue}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="older-ms">{t('time.olderMs')}</label>
          <input
            id="older-ms"
            type="number"
            placeholder={t('time.msPlaceholder')}
            value={olderThanMs ?? ''}
            onChange={(e) => handleMsChange(e.target.value)}
          />
        </div>

        {olderThanMs !== null && (
          <p className="muted">
            {t('time.currentFilter', {
              date: new Date(olderThanMs).toLocaleString(),
              ms: olderThanMs,
            })}
          </p>
        )}
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { getStatus, type DbStatus } from '../api'
import { useI18n } from '../i18n/I18nContext'

export default function Settings() {
  const { t } = useI18n()
  const [status, setStatus] = useState<DbStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getStatus()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div>
      <h2>{t('settings.title')}</h2>
      <p className="muted">{t('settings.hint')}</p>

      {error && <div className="error">{error}</div>}

      {status && (
        <div className="card">
          <dl>
            <dt>{t('settings.dbPath')}</dt>
            <dd>{status.db_path}</dd>
            <dt>{t('settings.indexPath')}</dt>
            <dd>{status.index_path ?? t('common.none')}</dd>
            <dt>{t('settings.safetyLevel')}</dt>
            <dd>
              <span className="badge badge-warn">
                {t('settings.level', { level: status.safety_level })}
              </span>
            </dd>
            <dt>{t('settings.dbExists')}</dt>
            <dd>{status.exists ? t('common.yes') : t('common.no')}</dd>
          </dl>
        </div>
      )}

      {!status && !error && <p>{t('common.loading')}</p>}
    </div>
  )
}

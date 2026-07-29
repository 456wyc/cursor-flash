import { useFilter } from '../FilterContext'

export default function TimeFilter() {
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
      <h2>Time Filter</h2>
      <p className="muted">
        Delete entries older than the specified date. Leave empty to skip time filtering.
      </p>

      <div className="card">
        <div className="form-row">
          <label htmlFor="older-date">Older than (date)</label>
          <input
            id="older-date"
            type="date"
            value={dateValue}
            onChange={(e) => handleDateChange(e.target.value)}
          />
        </div>

        <div className="form-row">
          <label htmlFor="older-ms">Older than (ms timestamp)</label>
          <input
            id="older-ms"
            type="number"
            placeholder="Unix ms, e.g. 1700000000000"
            value={olderThanMs ?? ''}
            onChange={(e) => handleMsChange(e.target.value)}
          />
        </div>

        {olderThanMs !== null && (
          <p className="muted">
            Current filter: entries before{' '}
            <strong>{new Date(olderThanMs).toLocaleString()}</strong> ({olderThanMs} ms)
          </p>
        )}
      </div>
    </div>
  )
}

export interface DbStatus {
  db_path: string
  size_bytes: number
  exists: boolean
  cursor_running: boolean
  safety_level: string
  index_path: string | null
  index_stale: boolean
}

export interface Job {
  id: string
  kind: string
  status: 'pending' | 'running' | 'done' | 'error'
  progress: number
  message: string
  error: string | null
  result: unknown
}

export interface CategoryStat {
  category: string
  row_count: number
  total_bytes: number
}

export interface ComposerStat {
  composer_id: string
  row_count: number
  total_bytes: number
  last_updated_ms: number | null
}

export interface FilterPayload {
  categories: string[]
  composer_ids: string[]
  older_than_ms: number | null
  newer_than_ms?: number | null
  cascade_headers?: boolean
  include_unknown_time?: boolean
}

export interface PreviewResult {
  row_count: number
  total_bytes: number
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || res.statusText)
  }
  return res.json() as Promise<T>
}

export function getStatus(): Promise<DbStatus> {
  return apiFetch('/api/status')
}

export function startScan(): Promise<{ job_id: string }> {
  return apiFetch('/api/scan', { method: 'POST' })
}

export function getJob(jobId: string): Promise<Job> {
  return apiFetch(`/api/jobs/${jobId}`)
}

export async function pollJob(
  jobId: string,
  onUpdate?: (job: Job) => void,
  intervalMs = 500,
): Promise<Job> {
  for (;;) {
    const job = await getJob(jobId)
    onUpdate?.(job)
    if (job.status === 'done' || job.status === 'error') {
      return job
    }
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

export function getCategories(): Promise<CategoryStat[]> {
  return apiFetch('/api/stats/categories')
}

export function getComposers(): Promise<ComposerStat[]> {
  return apiFetch('/api/stats/composers')
}

export function previewClean(filter: FilterPayload): Promise<PreviewResult> {
  return apiFetch('/api/clean/preview', {
    method: 'POST',
    body: JSON.stringify(filter),
  })
}

export function startRebuild(
  filter: FilterPayload,
  destDb: string,
  replaceOriginal: boolean,
  doBackup: boolean,
): Promise<{ job_id: string }> {
  const params = new URLSearchParams({
    dest_db: destDb,
    replace_original: String(replaceOriginal),
    do_backup: String(doBackup),
  })
  return apiFetch(`/api/reclaim/rebuild?${params}`, {
    method: 'POST',
    body: JSON.stringify(filter),
  })
}

export function exportReport(outDir: string): Promise<{ out_dir: string }> {
  const params = new URLSearchParams({ out_dir: outDir })
  return apiFetch(`/api/export?${params}`, { method: 'POST' })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

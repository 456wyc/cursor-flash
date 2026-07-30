export type Locale = 'zh' | 'en'

export type MessageTree = {
  [key: string]: string | MessageTree
}

export type Messages = {
  app: {
    title: string
  }
  nav: {
    overview: string
    categories: string
    composers: string
    time: string
    preview: string
    settings: string
    export: string
  }
  common: {
    yes: string
    no: string
    loading: string
    refresh: string
    selectAll: string
    clear: string
    selected: string
    rows: string
    size: string
    none: string
    language: string
  }
  overview: {
    title: string
    dbSize: string
    cursorRunning: string
    indexStale: string
    indexStaleYes: string
    scan: string
    scanning: string
    categoriesSummary: string
    emptyHint: string
    scanFailed: string
  }
  categories: {
    title: string
    hint: string
    category: string
    description: string
    empty: string
  }
  composers: {
    title: string
    hint: string
    composerId: string
    lastUpdated: string
    empty: string
  }
  time: {
    title: string
    hint: string
    olderDate: string
    olderMs: string
    msPlaceholder: string
    currentFilter: string
  }
  preview: {
    title: string
    hint: string
    previewBtn: string
    previewLoading: string
    matchingRows: string
    totalBytes: string
    rebuildOptions: string
    destDb: string
    replaceOriginal: string
    doBackup: string
    startRebuild: string
    rebuilding: string
    rebuildComplete: string
    rebuildFailed: string
  }
  settings: {
    title: string
    hint: string
    dbPath: string
    indexPath: string
    safetyLevel: string
    level: string
    dbExists: string
  }
  export: {
    title: string
    hint: string
    outDir: string
    exportBtn: string
    exporting: string
    success: string
  }
  /** Human-readable explanations keyed by catalog category id */
  categoryDesc: Record<string, string>
}

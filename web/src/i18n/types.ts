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
    indexPath: string
    scan: string
    scanning: string
    categoriesSummary: string
    staleDataNote: string
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
    hintDetail: string
    composerId: string
    lastUpdated: string
    empty: string
    actions: string
    viewDetail: string
  }
  composerDetail: {
    title: string
    back: string
    notFound: string
    workspace: string
    mode: string
    created: string
    partialClean: string
    partialHint: string
    selectedEstimate: string
    goClean: string
    largestKeys: string
    samplesHint: string
    key: string
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
    hintCombined: string
    combinedFilter: string
    andLogic: string
    clearFilter: string
    anyCategory: string
    anyComposer: string
    anyTime: string
    beforeDate: string
    pickCategories: string
    pickComposers: string
    pickTime: string
    searchComposer: string
    timeHint: string
    needCriteria: string
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
  filterBar: {
    empty: string
    active: string
    andHint: string
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

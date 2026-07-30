import { NavLink, Route, Routes } from 'react-router-dom'
import Overview from './pages/Overview'
import Categories from './pages/Categories'
import Composers from './pages/Composers'
import TimeFilter from './pages/TimeFilter'
import CleanPreview from './pages/CleanPreview'
import Settings from './pages/Settings'
import ExportPage from './pages/ExportPage'
import { useI18n } from './i18n/I18nContext'
import type { Locale } from './i18n/types'

export default function App() {
  const { t, locale, setLocale } = useI18n()

  const navItems = [
    { to: '/', label: t('nav.overview'), end: true },
    { to: '/categories', label: t('nav.categories') },
    { to: '/composers', label: t('nav.composers') },
    { to: '/time', label: t('nav.time') },
    { to: '/preview', label: t('nav.preview') },
    { to: '/settings', label: t('nav.settings') },
    { to: '/export', label: t('nav.export') },
  ]

  return (
    <div className="layout">
      <header className="header">
        <h1>{t('app.title')}</h1>
        <label className="lang-switch">
          <span className="lang-switch-label">{t('common.language')}</span>
          <select
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            aria-label={t('common.language')}
          >
            <option value="zh">中文</option>
            <option value="en">English</option>
          </select>
        </label>
      </header>
      <nav className="nav">
        {navItems.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/categories" element={<Categories />} />
          <Route path="/composers" element={<Composers />} />
          <Route path="/time" element={<TimeFilter />} />
          <Route path="/preview" element={<CleanPreview />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/export" element={<ExportPage />} />
        </Routes>
      </main>
    </div>
  )
}

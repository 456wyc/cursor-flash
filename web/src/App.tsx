import { NavLink, Route, Routes } from 'react-router-dom'
import Overview from './pages/Overview'
import Categories from './pages/Categories'
import Composers from './pages/Composers'
import TimeFilter from './pages/TimeFilter'
import CleanPreview from './pages/CleanPreview'
import Settings from './pages/Settings'
import ExportPage from './pages/ExportPage'

const navItems = [
  { to: '/', label: 'Overview', end: true },
  { to: '/categories', label: 'Categories' },
  { to: '/composers', label: 'Composers' },
  { to: '/time', label: 'Time Filter' },
  { to: '/preview', label: 'Clean Preview' },
  { to: '/settings', label: 'Settings' },
  { to: '/export', label: 'Export' },
]

export default function App() {
  return (
    <div className="layout">
      <header className="header">
        <h1>Cursor VSCDB Manager</h1>
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

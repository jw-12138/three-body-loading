import { useState, useCallback, useEffect } from 'react'
import { ThreeBodyCanvas } from './components/ThreeBodyCanvas'
import { PRESETS, type PresetConfig } from './engine/presets'
import './App.css'

type Theme = 'system' | 'light' | 'dark'

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) || 'system'
  )

  useEffect(() => {
    const root = document.documentElement
    if (theme === 'system') {
      // Let CSS @media (prefers-color-scheme) handle it
      root.removeAttribute('data-theme')
    } else {
      root.setAttribute('data-theme', theme)
    }
  }, [theme])

  const setAndStore = useCallback((t: Theme) => {
    setTheme(t)
    localStorage.setItem('theme', t)
  }, [])

  return [theme, setAndStore] as const
}

function App() {
  const [selectedPreset, setSelectedPreset] = useState<PresetConfig | null>(null)
  const [resetKey, setResetKey] = useState(0)
  const [theme, setTheme] = useTheme()

  const handleReset = useCallback(() => {
    setResetKey(k => k + 1)
  }, [])

  const handleClose = useCallback(() => {
    setSelectedPreset(null)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <h1 className="hero-title">
            A Gallery of Three-Body<br />Loading Animations
          </h1>
          <p className="hero-desc">
            Because if the universe can't solve it,<br />
            why should your loading spinner?
          </p>
        </div>
        <div className="header-actions">
          <a href="https://github.com/jw-12138/three-body-loading" target="_blank" rel="noopener" className="github-link" title="GitHub">
            <svg viewBox="0 0 256 256" fill="currentColor">
              <path d="M208.31,75.68A59.78,59.78,0,0,0,202.93,28,8,8,0,0,0,196,24a59.75,59.75,0,0,0-48,24H124A59.75,59.75,0,0,0,76,24a8,8,0,0,0-6.93,4,59.78,59.78,0,0,0-5.38,47.68A58.14,58.14,0,0,0,56,104v8a56.06,56.06,0,0,0,48.44,55.47A39.8,39.8,0,0,0,96,192v8H72a24,24,0,0,1-24-24,40,40,0,0,0-40-40,8,8,0,0,0,0,16,24,24,0,0,1,24,24,40,40,0,0,0,40,40H96v16a8,8,0,0,0,16,0V192a24,24,0,0,1,48,0v40a8,8,0,0,0,16,0V192a39.8,39.8,0,0,0-8.44-24.53A56.06,56.06,0,0,0,216,112v-8A58.14,58.14,0,0,0,208.31,75.68ZM200,112a40,40,0,0,1-40,40H112a40,40,0,0,1-40-40v-8a41.74,41.74,0,0,1,6.9-22.48A8,8,0,0,0,80,73.55a43.81,43.81,0,0,1,.79-23.87,43.84,43.84,0,0,1,32.32,20.14,8,8,0,0,0,6.71,3.68h32.35a8,8,0,0,0,6.74-3.69,43.92,43.92,0,0,1,32.32-20.13,43.81,43.81,0,0,1,.77,23.85,8.15,8.15,0,0,0,1,7.48A41.76,41.76,0,0,1,200,104Z" />
            </svg>
          </a>
          <div className="theme-switcher">
          <button
            className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
            onClick={() => setTheme('system')}
            title="System"
          >
            <svg viewBox="0 0 256 256" fill="currentColor">
              <path d="M208,40H48A24,24,0,0,0,24,64V176a24,24,0,0,0,24,24H208a24,24,0,0,0,24-24V64A24,24,0,0,0,208,40Zm8,136a8,8,0,0,1-8,8H48a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H208a8,8,0,0,1,8,8Zm-48,48a8,8,0,0,1-8,8H96a8,8,0,0,1,0-16h64A8,8,0,0,1,168,224Z" />
            </svg>
          </button>
          <button
            className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            title="Light"
          >
            <svg viewBox="0 0 256 256" fill="currentColor">
              <path d="M120,40V16a8,8,0,0,1,16,0V40a8,8,0,0,1-16,0Zm72,88a64,64,0,1,1-64-64A64.07,64.07,0,0,1,192,128Zm-16,0a48,48,0,1,0-48,48A48.05,48.05,0,0,0,176,128ZM58.34,69.66A8,8,0,0,0,69.66,58.34l-16-16A8,8,0,0,0,42.34,53.66Zm0,116.68-16,16a8,8,0,0,0,11.32,11.32l16-16a8,8,0,0,0-11.32-11.32ZM192,72a8,8,0,0,0,5.66-2.34l16-16a8,8,0,0,0-11.32-11.32l-16,16A8,8,0,0,0,192,72Zm5.66,114.34a8,8,0,0,0-11.32,11.32l16,16a8,8,0,0,0,11.32-11.32ZM48,128a8,8,0,0,0-8-8H16a8,8,0,0,0,0,16H40A8,8,0,0,0,48,128Zm80,80a8,8,0,0,0-8,8v24a8,8,0,0,0,16,0V216A8,8,0,0,0,128,208Zm112-88H216a8,8,0,0,0,0,16h24a8,8,0,0,0,0-16Z" />
            </svg>
          </button>
          <button
            className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            title="Dark"
          >
            <svg viewBox="0 0 256 256" fill="currentColor">
              <path d="M233.54,142.23a8,8,0,0,0-8-2,88.08,88.08,0,0,1-109.8-109.8,8,8,0,0,0-10-10,104.84,104.84,0,0,0-52.91,37A104,104,0,0,0,136,224a103.09,103.09,0,0,0,62.52-20.88,104.84,104.84,0,0,0,37-52.91A8,8,0,0,0,233.54,142.23ZM188.9,190.36A88,88,0,0,1,65.64,67.09,89,89,0,0,1,96,48.11,104.11,104.11,0,0,0,207.89,160,89,89,0,0,1,188.9,190.36Z" />
            </svg>
          </button>
          </div>
        </div>
      </header>

      <main className="gallery">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            className="card"
            onClick={() => {
              setSelectedPreset(preset)
              setResetKey(k => k + 1)
            }}
          >
            <div className="card-canvas">
              <ThreeBodyCanvas preset={preset} size={200} paused={!!selectedPreset} />
            </div>
            <div className="card-info">
              <div className="card-header">
                <div className="card-name">{preset.name}</div>
                <span className={`stability-tag ${preset.stability}`}>{preset.stability}</span>
              </div>
            </div>
          </button>
        ))}
      </main>

      {selectedPreset && (
        <div className="modal-backdrop" onClick={handleClose}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modal-preview">
              <div className="modal-canvas-wrap">
                <ThreeBodyCanvas
                  key={`${selectedPreset.key}-${resetKey}`}
                  preset={selectedPreset}
                  size={400}
                  interactive
                />
              </div>
              <div className="modal-controls">
                <button className="btn-reset" onClick={handleReset}>
                  Reset
                </button>
              </div>
            </div>
            <div className="modal-info">
              <button className="btn-close" onClick={handleClose}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </button>
              <div className="modal-title-row">
                <h2 className="modal-title">{selectedPreset.name}</h2>
                <span className={`stability-tag ${selectedPreset.stability}`}>{selectedPreset.stability}</span>
              </div>
              <p className="modal-desc">{selectedPreset.description}</p>
              <div className="formula-box">
                <div className="formula-label">GOVERNING EQUATION</div>
                <div className="formula">
                  F = G·m₁·m₂ / r²
                </div>
                <div className="formula-sub">
                  Integration: RK4 (4th-order Runge-Kutta)
                </div>
              </div>
              <div className="status-box">
                <div className="status-dot" />
                <span>Loading... (ETA: Heat death of the universe)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="inspired-links">
        <a href="https://paidax01.github.io/math-curve-loaders/" target="_blank" rel="noopener" className="link-pill">
          Inspired by paidax01
        </a>
        <a href="https://x.com/bbssppllvv/status/2038718410318659763" target="_blank" rel="noopener" className="link-pill">
          Inspired by @bbssppllvv
        </a>
      </div>

      <footer className="footer">
        <p>
          No bodies were harmed in the making of this website.
          <br />
          <span className="footer-sub">
            Gravitational constant may vary. Not responsible for existential crises induced by chaotic systems.
          </span>
        </p>
      </footer>
    </div>
  )
}

export default App

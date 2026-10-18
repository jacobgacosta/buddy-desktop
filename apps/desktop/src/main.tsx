import ReactDOM from 'react-dom/client'
import { App } from './App'

// Global dark scrollbar style (webkit)
const _style = document.createElement('style')
_style.textContent = `
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.13); border-radius: 4px; }
  ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.22); }
  * { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.13) transparent; }
  select option { background: #12111f !important; color: #e5e7eb !important; }
`
document.head.appendChild(_style)

document.addEventListener('contextmenu', e => e.preventDefault())

// Suppress Rive linear-animation deprecation warnings (v4 API, not upgrading yet)
const _warn = console.warn.bind(console)
console.warn = (...args) => {
  if (typeof args[0] === 'string' && args[0].startsWith('[Rive:')) return
  _warn(...args)
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)

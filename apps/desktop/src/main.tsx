import ReactDOM from 'react-dom/client'
import { App } from './App'

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

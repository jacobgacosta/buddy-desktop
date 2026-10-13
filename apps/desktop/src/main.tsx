import ReactDOM from 'react-dom/client'
import { App } from './App'

document.addEventListener('contextmenu', e => e.preventDefault())

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
)

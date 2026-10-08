import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Silence non-fatal transient map tile network aborts
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason?.name === 'AJAXError' ||
      event.reason?.message?.includes('AJAXError') ||
      event.reason?.message?.includes('Failed to fetch')
    ) {
      event.preventDefault();
    }
  });
}

createRoot(document.getElementById('root')!).render(<App />);

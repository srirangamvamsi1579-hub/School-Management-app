import { createRoot } from 'react-dom/client';
import { StoreProvider } from './data/store.js';
import App from './App.jsx';
import MobileApp from './mobile/MobileApp.jsx';
import './styles.css';

// Inside the store app (Capacitor) or a mobile build, open the mobile app; otherwise the website
const mobile = window.Capacitor?.isNativePlatform?.() || import.meta.env.VITE_TARGET === 'mobile';
createRoot(document.getElementById('root')).render(<StoreProvider>{mobile ? <MobileApp /> : <App />}</StoreProvider>);

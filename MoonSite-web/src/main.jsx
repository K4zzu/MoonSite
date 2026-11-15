import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';

// No StrictMode: the 3D scene owns a WebGL context and must mount exactly once.
createRoot(document.getElementById('root')).render(<App />);

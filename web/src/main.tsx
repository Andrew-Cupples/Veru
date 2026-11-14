import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { installAnalytics } from './analytics/autoTrack';
import '@fontsource-variable/inter';
import '@fontsource-variable/jetbrains-mono';
import './styles/global.css';
import './styles/motion.css';

installAnalytics();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

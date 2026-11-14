import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PromptLedger } from '../index';
import './dev.css';

// Standalone dev shell. The broader app will mount <PromptLedger /> the same way inside its own layout.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PromptLedger />
  </StrictMode>,
);

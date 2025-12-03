import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 1. Cattura errori globali (se l'app esplode prima di partire)
window.addEventListener('error', (e) => {
  document.body.innerHTML = `
    <div style="background:#fee2e2; color:#991b1b; padding:20px; font-family:sans-serif; margin:20px; border:2px solid #b91c1c; border-radius:8px;">
      <h1 style="margin-top:0">⚠️ Errore Critico Rilevato</h1>
      <p><strong>Messaggio:</strong> ${e.message}</p>
      <p><strong>File:</strong> ${e.filename}:${e.lineno}</p>
      <p>Per favore, copia questo errore e invialo all'assistenza.</p>
    </div>
  `;
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error("Impossibile trovare l'elemento <div id='root'> in index.html. Controlla quel file!");
}

// 2. Avvio sicuro di React
try {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
} catch (err) {
  console.error("Errore React:", err);
  document.body.innerHTML = `<div style="color:red">Errore di avvio React: ${err.message}</div>`;
}
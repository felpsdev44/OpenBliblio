// Ponto de entrada da tela. Se o alto contraste estava ligado, ele volta ao abrir o site.
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

if (localStorage.getItem('alto-contraste') === '1') {
  document.documentElement.classList.add('alto-contraste');
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
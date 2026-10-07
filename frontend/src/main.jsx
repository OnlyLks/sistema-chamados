import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx' // Certifique-se de que está .jsx e não .js
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter> {/* <--- Coloque o BrowserRouter envolvendo o App */}
    <App />
    </BrowserRouter>
  </React.StrictMode>,
)
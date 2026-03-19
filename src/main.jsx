import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import App from './App';
import './styles/index.css';
import { nanoid } from 'nanoid';

function Home() {
  const slug = nanoid(6).toLowerCase();
  return <Navigate to={`/${slug}`} replace />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/:slug" element={<App />} />
    </Routes>
  </BrowserRouter>
);

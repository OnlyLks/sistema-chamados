import React from 'react';
import {Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LoginColaborador from './pages/LoginColaborador';
import LoginTecnico from './pages/LoginTecnico';
import PainelColaborador from './pages/PainelColaborador';
import PainelTecnico from './pages/PainelTecnico';
import AdminTecnicos from './pages/AdminTecnicos';
import AuditoriaAdmin from './pages/AuditoriaAdmin';
import './index.css';

const PrivateRoute = ({ children, allowedRoles, adminOnly = false }) => {
  const { user, loading } = useAuth();
  if (loading) return <div>Carregando...</div>;
  if (!user) return <Navigate to="/" />;
  if (allowedRoles && !allowedRoles.includes(user.tipo)) {
    return <Navigate to="/" />;
  }
  if (adminOnly && !user.admin) {
    return <Navigate to="/tecnico" replace />;
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LoginColaborador />} />
          <Route path="/login-tecnico" element={<LoginTecnico />} />
          <Route
            path="/colaborador"
            element={
              <PrivateRoute allowedRoles={['colaborador']}>
                <PainelColaborador />
              </PrivateRoute>
            }
          />
          <Route
            path="/tecnico"
            element={
              <PrivateRoute allowedRoles={['tecnico']}>
                <PainelTecnico />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/tecnicos"
            element={
              <PrivateRoute allowedRoles={['tecnico']} adminOnly>
                <AdminTecnicos />
              </PrivateRoute>
            }
          />
          <Route
            path="/admin/auditoria"
            element={
              <PrivateRoute allowedRoles={['tecnico']} adminOnly>
                <AuditoriaAdmin />
              </PrivateRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

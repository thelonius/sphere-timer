import { useState } from 'react';
import { AuthProvider } from './context/AuthProvider';
import { LanguageProvider } from './context/LanguageProvider';
import { ThemeProvider } from './context/ThemeProvider';
import { useAuth } from './context/useAuth';
import { useLanguage } from './context/useLanguage';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import './App.css';

function AuthFlow() {
  const { user, loading, login, register, logout } = useAuth();
  const { t } = useLanguage();
  const [showRegister, setShowRegister] = useState(false);

  if (loading) {
    return (
      <div className="app">
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '100vh',
          color: 'var(--text-primary)'
        }}>
          {t('loading')}
        </div>
      </div>
    );
  }

  if (!user) {
    return showRegister ? (
      <Register 
        onRegister={register}
        onSwitchToLogin={() => setShowRegister(false)}
      />
    ) : (
      <Login 
        onLogin={login}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  return <Dashboard user={user} onLogout={logout} />;
}

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <div className="app">
            <AuthFlow />
          </div>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

export default App;

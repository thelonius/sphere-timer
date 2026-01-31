import { useState } from 'react';
import { useLanguage } from '../context/useLanguage';
import './Login.css';

function Login({ onLogin, onSwitchToRegister }) {
  const { t, toggleLanguage, language } = useLanguage();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const validateForm = () => {
    if (!formData.email.trim()) {
      setError(t('enterEmail'));
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError(t('validEmail'));
      return false;
    }
    if (!formData.password) {
      setError(t('enterPassword'));
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    const result = await onLogin(formData.email, formData.password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || 'Ошибка входа');
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <button className="language-toggle" onClick={toggleLanguage} title={t('language')}>
          {language === 'ru' ? 'EN' : 'RU'}
        </button>
        <div className="logo-container">
          <div className="logo-circle"></div>
          <h1 className="app-title">{t('appTitle')}</h1>
        </div>
        <p className="subtitle">{t('appSubtitle')}</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('email')}
              className="login-input"
              autoFocus
              disabled={loading}
            />
            <div className="input-underline"></div>
          </div>

          <div className="input-group">
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder={t('password')}
              className="login-input"
              disabled={loading}
            />
            <div className="input-underline"></div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            <span>{loading ? t('loggingIn') : t('login')}</span>
            <div className="button-glow"></div>
          </button>

          <div className="auth-switch">
            <span>{t('noAccount')} </span>
            <button 
              type="button" 
              className="switch-link" 
              onClick={onSwitchToRegister}
              disabled={loading}
            >
              {t('register')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Login;

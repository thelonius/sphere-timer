import { useState } from 'react';
import { useLanguage } from '../context/useLanguage';
import './Login.css';

function Register({ onRegister, onSwitchToLogin }) {
  const { t, toggleLanguage, language } = useLanguage();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
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
    if (!formData.username.trim()) {
      setError(t('enterUsername'));
      return false;
    }
    if (formData.username.length < 3) {
      setError(t('usernameMinLength'));
      return false;
    }
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
    if (formData.password.length < 6) {
      setError(t('passwordTooShort'));
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError(t('passwordsNotMatch'));
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
    const result = await onRegister(formData.username, formData.email, formData.password);
    setLoading(false);

    if (!result.success) {
      setError(result.error || t('enterPassword'));
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
        <p className="subtitle">{t('createAccount')}</p>
        
        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              placeholder={t('username')}
              className="login-input"
              autoFocus
              disabled={loading}
            />
            <div className="input-underline"></div>
          </div>

          <div className="input-group">
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder={t('email')}
              className="login-input"
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
              placeholder={t('passwordMinLength')}
              className="login-input"
              disabled={loading}
            />
            <div className="input-underline"></div>
          </div>

          <div className="input-group">
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder={t('confirmPassword')}
              className="login-input"
              disabled={loading}
            />
            <div className="input-underline"></div>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="login-button" disabled={loading}>
            <span>{loading ? t('registering') : t('register')}</span>
            <div className="button-glow"></div>
          </button>

          <div className="auth-switch">
            <span>{t('alreadyHaveAccount')} </span>
            <button 
              type="button" 
              className="switch-link" 
              onClick={onSwitchToLogin}
              disabled={loading}
            >
              {t('login')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Register;

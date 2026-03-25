import { useState } from 'react';
import { useLanguage } from '../context/useLanguage';
import { authAPI } from '../services/api';
import './Login.css';

function Login({ onLogin, onSwitchToRegister }) {
  const { t, toggleLanguage, language } = useLanguage();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [resetData, setResetData] = useState({
    email: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [isResetMode, setIsResetMode] = useState(false);

  const handleChange = (e) => {
    if (isResetMode) {
      setResetData({
        ...resetData,
        [e.target.name]: e.target.value
      });
    } else {
      setFormData({
        ...formData,
        [e.target.name]: e.target.value
      });
    }
    setError('');
    setSuccess('');
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

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!resetData.email.trim()) {
      setError(t('enterEmail'));
      return;
    }
    if (resetData.newPassword.length < 6) {
      setError(t('passwordMinLength'));
      return;
    }
    if (resetData.newPassword !== resetData.confirmPassword) {
      setError(t('passwordsNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const result = await authAPI.resetPassword(resetData.email, resetData.newPassword);
      if (result.success) {
        setSuccess(t('passwordResetSuccess'));
        setTimeout(() => setIsResetMode(false), 2000);
      }
    } catch (err) {
      setError(err.message || 'Error resetting password');
    } finally {
      setLoading(false);
    }
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
        
        {!isResetMode ? (
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

            <div className="forgot-password-link">
              <button 
                type="button" 
                className="text-button" 
                onClick={() => setIsResetMode(true)}
              >
                {t('forgotPassword')}
              </button>
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
        ) : (
          <form onSubmit={handleResetSubmit} className="login-form">
            <div className="input-group">
              <input
                type="email"
                name="email"
                value={resetData.email}
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
                name="newPassword"
                value={resetData.newPassword}
                onChange={handleChange}
                placeholder={t('newPassword')}
                className="login-input"
                disabled={loading}
              />
              <div className="input-underline"></div>
            </div>

            <div className="input-group">
              <input
                type="password"
                name="confirmPassword"
                value={resetData.confirmPassword}
                onChange={handleChange}
                placeholder={t('confirmNewPassword')}
                className="login-input"
                disabled={loading}
              />
              <div className="input-underline"></div>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <button type="submit" className="login-button" disabled={loading}>
              <span>{loading ? t('loading') : t('resetPassword')}</span>
              <div className="button-glow"></div>
            </button>

            <div className="auth-switch">
              <button 
                type="button" 
                className="switch-link" 
                onClick={() => setIsResetMode(false)}
                disabled={loading}
              >
                {t('backToLogin')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default Login;

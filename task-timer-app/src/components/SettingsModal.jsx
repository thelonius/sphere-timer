import { useState } from 'react';
import { useLanguage } from '../context/useLanguage';
import { userAPI } from '../services/api';
import './Calendar.css'; 
import './TaskForm.css';

function SettingsModal({ user, onClose }) {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
    setSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.currentPassword || !formData.newPassword || !formData.confirmPassword) {
      setError(t('allFieldsRequired') || 'All fields are required');
      return;
    }
    if (formData.newPassword.length < 6) {
      setError(t('passwordMinLength'));
      return;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError(t('passwordsNotMatch'));
      return;
    }

    setLoading(true);
    try {
      const result = await userAPI.changePassword(formData.currentPassword, formData.newPassword);
      if (result.success) {
        setSuccess(t('passwordChanged'));
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: ''
        });
        setTimeout(onClose, 2000);
      }
    } catch (err) {
      setError(err.message || 'Error changing password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="calendar-overlay" onClick={onClose}>
      <div className="calendar-container" onClick={e => e.stopPropagation()} style={{ width: '400px', maxHeight: 'auto' }}>
        <div className="calendar-header">
          <h2>{t('settings')}</h2>
          <button className="close-button" onClick={onClose}></button>
        </div>

        <div className="calendar-main" style={{ padding: '20px' }}>
          <div style={{ marginBottom: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.2rem', color: 'var(--accent-cyan)' }}>{user?.username}</div>
            <div style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{user?.email}</div>
          </div>

          <form onSubmit={handleSubmit} className="task-form" autoComplete="off">
            <h3 style={{ marginBottom: '15px' }}>{t('changePassword')}</h3>
            
            <div className="form-group">
              <label>{t('currentPassword')}</label>
              <input
                type="password"
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                placeholder=""
                className="task-input"
                autoComplete="current-password"
                readOnly
                onFocus={e => e.target.removeAttribute('readOnly')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>{t('newPassword')}</label>
              <input
                type="password"
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                placeholder=""
                className="task-input"
                autoComplete="new-password"
                readOnly
                onFocus={e => e.target.removeAttribute('readOnly')}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>{t('confirmNewPassword')}</label>
              <input
                type="password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder=""
                className="task-input"
                autoComplete="new-password"
                readOnly
                onFocus={e => e.target.removeAttribute('readOnly')}
                disabled={loading}
              />
            </div>

            {error && <div className="error-message" style={{ margin: '10px 0' }}>{error}</div>}
            {success && <div className="success-message" style={{ margin: '10px 0' }}>{success}</div>}

            <div className="form-actions" style={{ marginTop: '20px' }}>
              <button type="button" className="cancel-button" onClick={onClose} disabled={loading}>
                {t('cancel')}
              </button>
              <button type="submit" className="submit-button" disabled={loading}>
                {loading ? t('loading') : t('save')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SettingsModal;

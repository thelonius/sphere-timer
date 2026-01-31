import { useEffect, useState } from 'react';
import './Notification.css';

function Notification({ message, onClose }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isFading, setIsFading] = useState(false);

  useEffect(() => {
    const fadeTimer = setTimeout(() => {
      setIsFading(true);
    }, 4000);

    const closeTimer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 5000);

    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(closeTimer);
    };
  }, [onClose]);

  if (!isVisible) return null;

  return (
    <div className={`notification ${isFading ? 'fade-out' : ''}`}>
      <div className="notification-content">
        <span className="notification-message">{message}</span>
      </div>
      <button className="notification-close" onClick={() => {
        setIsVisible(false);
        onClose();
      }}>×</button>
    </div>
  );
}

export default Notification;

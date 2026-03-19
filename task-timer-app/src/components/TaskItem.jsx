import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../context/useLanguage';
import TaskForm from './TaskForm';
import { formatTime, getTodayDate } from '../utils/timeUtils';
import './TaskItem.css';

function TaskItem({ 
  task, 
  isActive, 
  isPulsing, 
  isHighlighted, 
  currentTime, 
  onToggleTimer, 
  onDelete, 
  onUpdate, 
  onSetPulsing,
  draggable, 
  onDragStart, 
  onDragOver, 
  onDragEnd, 
  isDragging 
}) {
  const { t } = useLanguage();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStopInput, setShowStopInput] = useState(false);
  const [stopHours, setStopHours] = useState(0);
  const [stopMinutes, setStopMinutes] = useState(5);
  const [stopSeconds, setStopSeconds] = useState(0);
  const [scheduledStopAt, setScheduledStopAt] = useState(null);
  const [popoverDirection, setPopoverDirection] = useState('up');

  // Общее время
  const totalTime = isActive 
    ? task.totalTime + (currentTime - task.startTime)
    : task.totalTime;

  // Время за сегодня
  const getTodayTime = () => {
    const today = getTodayDate();
    const todayHistory = task.history?.filter(h => h.date === today) || [];
    const historyTime = todayHistory.reduce((sum, h) => sum + h.time, 0);
    
    if (isActive) {
      const startDate = new Date(task.startTime).toISOString().split('T')[0];
      if (startDate === today) {
        return historyTime + (currentTime - task.startTime);
      }
    }
    
    return historyTime;
  };

  // Текущая сессия
  const currentSessionTime = isActive ? currentTime - task.startTime : 0;

  useEffect(() => {
    if (scheduledStopAt && currentTime >= scheduledStopAt) {
      if (isActive) {
        onToggleTimer();
      }
      onSetPulsing(true);
      setScheduledStopAt(null);
    }
  }, [currentTime, scheduledStopAt, isActive, onToggleTimer, onSetPulsing]);

  const handleUpdate = (updates) => {
    onUpdate(updates);
    setShowEditForm(false);
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  const handleScheduledStopClick = (e) => {
    e.stopPropagation();
    
    if (!showStopInput) {
      // При открытии проверяем место
      const buttonRect = e.currentTarget.getBoundingClientRect();
      if (buttonRect.top < 400) {
        setPopoverDirection('down');
      } else {
        setPopoverDirection('up');
      }
    }
    
    setShowStopInput(!showStopInput);
  };

  const handleSetScheduledStop = (e) => {
    e.stopPropagation();
    const h = parseInt(stopHours) || 0;
    const m = parseInt(stopMinutes) || 0;
    const s = parseInt(stopSeconds) || 0;
    const totalMs = (h * 3600 + m * 60 + s) * 1000;
    
    if (totalMs > 0) {
      const stopAt = Date.now() + totalMs;
      setScheduledStopAt(stopAt);
      setShowStopInput(false);
      if (!isActive) {
        onToggleTimer();
      }
    }
  };

  const handleCancelScheduledStop = (e) => {
    e.stopPropagation();
    setScheduledStopAt(null);
    setShowStopInput(false);
  };

  const clearPulsing = () => {
    if (isPulsing) {
      onSetPulsing(false);
    }
  };

  return (
    <>
      <div 
        id={`task-${task.id}`}
        className={`task-item ${isHighlighted ? 'highlighted' : ''} ${isDragging ? 'dragging' : ''} ${isPulsing ? 'stop-pulsing' : ''} ${showStopInput ? 'popover-open' : ''}`}
        style={{ borderLeftColor: task.color }}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onClick={clearPulsing}
      >
        <div className="task-color-indicator" style={{ backgroundColor: task.color }}>
          {isActive && <div className="pulse"></div>}
        </div>

        <div className="task-content">
          <h3 className="task-name">{task.name}</h3>
          <div className="task-time-container">
            <div className="task-time-item">
              <span className="time-label">{t('totalTaskTime')}:</span>
              <span className="time-value">{formatTime(totalTime)}</span>
            </div>
            <div className="task-time-item">
              <span className="time-label">{t('todayTime')}:</span>
              <span className="time-value">{formatTime(getTodayTime())}</span>
            </div>
            {isActive && (
              <div className="task-time-item current-session">
                <span className="time-label">{t('currentSession')}:</span>
                <span className="time-value">{formatTime(currentSessionTime)}</span>
              </div>
            )}
            {scheduledStopAt && (
              <div className="task-time-item scheduled-stop">
                <span className="time-label">{t('stopAfter')}:</span>
                <span className="time-value">{formatTime(scheduledStopAt - currentTime)}</span>
              </div>
            )}
          </div>
        </div>

        <div className="task-actions">
          <div className="stop-input-wrapper">
            {showStopInput && createPortal(
              <div className="stop-input-overlay" onClick={() => setShowStopInput(false)}>
                <div className={`stop-input-field ${popoverDirection}`} onClick={e => e.stopPropagation()}>
                  <span className="stop-input-label">{t('stopAfter')}:</span>
                  <div className="stop-inputs-row">
                    <div className="stop-unit">
                      <input 
                        type="number" 
                        min="0" 
                        value={stopHours} 
                        onChange={(e) => setStopHours(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSetScheduledStop(e)}
                      />
                      <label>{t('hours')}</label>
                    </div>
                    <div className="stop-unit">
                      <input 
                        type="number" 
                        min="0" 
                        max="59" 
                        value={stopMinutes} 
                        onChange={(e) => setStopMinutes(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSetScheduledStop(e)}
                      />
                      <label>{t('minutes')}</label>
                    </div>
                    <div className="stop-unit">
                      <input 
                        type="number" 
                        min="0" 
                        max="59" 
                        value={stopSeconds} 
                        onChange={(e) => setStopSeconds(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSetScheduledStop(e)}
                      />
                      <label>{t('seconds')}</label>
                    </div>
                  </div>
                  <div className="stop-actions-row">
                    {scheduledStopAt && (
                      <button className="cancel-stop-btn" onClick={handleCancelScheduledStop}>
                        {t('cancel')}
                      </button>
                    )}
                    <button className="confirm-stop-btn" onClick={handleSetScheduledStop}>OK</button>
                  </div>
                  <button className="stop-input-close" onClick={() => setShowStopInput(false)}>×</button>
                </div>
              </div>,
              document.body
            )}
            <button
              className={`timer-button stop-btn ${scheduledStopAt ? 'active' : ''}`}
              onClick={handleScheduledStopClick}
              title={t('stopAfter')}
            >
              ⏹
            </button>
          </div>

          <button
            className={`timer-button ${isActive ? 'active' : ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleTimer(); }}
            title={isActive ? t('stop') : t('start')}
          >
            {isActive ? '⏸' : '▶'}
          </button>
          
          <button
            className="edit-button"
            onClick={(e) => { e.stopPropagation(); setShowEditForm(true); }}
            title={t('edit')}
          >
            ✎
          </button>
          
          <button
            className="delete-button"
            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
            title={t('delete')}
          >
          </button>
        </div>
      </div>

      {showEditForm && (
        <TaskForm
          initialData={task}
          onSubmit={handleUpdate}
          onCancel={() => setShowEditForm(false)}
        />
      )}

      {showDeleteConfirm && (
        <div className="delete-confirm-overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="delete-confirm" onClick={e => e.stopPropagation()}>
            <h3>{t('deleteTask')}</h3>
            <p>{t('taskName')} "{task.name}" {t('deleteTaskMessage')}</p>
            <div className="confirm-actions">
              <button onClick={() => setShowDeleteConfirm(false)} className="cancel-button">
                {t('cancel')}
              </button>
              <button onClick={handleDelete} className="confirm-delete-button">
                {t('delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default TaskItem;

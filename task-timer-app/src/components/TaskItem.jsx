import { useState } from 'react';
import { useLanguage } from '../context/useLanguage';
import TaskForm from './TaskForm';
import { formatTime, getTodayDate } from '../utils/timeUtils';
import './TaskItem.css';

function TaskItem({ task, isActive, isHighlighted, currentTime, onToggleTimer, onDelete, onUpdate, draggable, onDragStart, onDragOver, onDragEnd, isDragging }) {
  const { t } = useLanguage();
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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

  const handleUpdate = (updates) => {
    onUpdate(updates);
    setShowEditForm(false);
  };

  const handleDelete = () => {
    onDelete();
    setShowDeleteConfirm(false);
  };

  return (
    <>
      <div 
        id={`task-${task.id}`}
        className={`task-item ${isHighlighted ? 'highlighted' : ''} ${isDragging ? 'dragging' : ''}`}
        style={{ borderLeftColor: task.color }}
        draggable={draggable}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
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
          </div>
        </div>

        <div className="task-actions">
          <button
            className={`timer-button ${isActive ? 'active' : ''}`}
            onClick={onToggleTimer}
            title={isActive ? 'Остановить' : 'Запустить'}
          >
            {isActive ? '⏸' : '▶'}
          </button>
          
          <button
            className="edit-button"
            onClick={() => setShowEditForm(true)}
            title="Редактировать"
          >
            ✎
          </button>
          
          <button
            className="delete-button"
            onClick={() => setShowDeleteConfirm(true)}
            title="Удалить"
          >
            ×
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
        <div className="delete-confirm-overlay">
          <div className="delete-confirm">
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

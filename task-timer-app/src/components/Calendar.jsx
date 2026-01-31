import { useState, useMemo } from 'react';
import { useLanguage } from '../context/useLanguage';
import { formatTimeCompact } from '../utils/timeUtils';
import './Calendar.css';

function Calendar({ tasks, onClose }) {
  const { t } = useLanguage();
  const [selectedTask, setSelectedTask] = useState(tasks[0]?.id || null);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const task = tasks.find(t => t.id === selectedTask);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    // Корректируем день недели: 0 (воскресенье) становится 6, 1 (понедельник) становится 0
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getTimeForDate = (dateString) => {
    if (!task) return 0;
    return task.history
      .filter(h => h.date === dateString)
      .reduce((sum, h) => sum + h.time, 0);
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };

  const monthNames = [
    t('january'), t('february'), t('march'), t('april'), t('may'), t('june'),
    t('july'), t('august'), t('september'), t('october'), t('november'), t('december')
  ];

  const dayNames = [t('monday'), t('tuesday'), t('wednesday'), t('thursday'), t('friday'), t('saturday'), t('sunday')];

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const dateString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timeSpent = getTimeForDate(dateString);
    const isToday = dateString === new Date().toISOString().split('T')[0];

    days.push(
      <div 
        key={day} 
        className={`calendar-day ${timeSpent > 0 ? 'has-time' : ''} ${isToday ? 'today' : ''}`}
        style={{
          backgroundColor: timeSpent > 0 ? task?.color + '20' : 'transparent',
          borderColor: timeSpent > 0 ? task?.color : 'transparent'
        }}
      >
        <div className="day-number">{day}</div>
        {timeSpent > 0 && (
          <div className="day-time" style={{ color: task?.color }}>
            {formatTimeCompact(timeSpent, { hours: t('hours'), minutes: t('minutes') })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>{t('timeStatistics')}</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="calendar-content">
        <div className="task-selector">
          {tasks.map(t => (
            <button
              key={t.id}
              className={`task-badge ${selectedTask === t.id ? 'active' : ''}`}
              onClick={() => setSelectedTask(t.id)}
              style={{
                backgroundColor: selectedTask === t.id ? t.color : 'transparent',
                borderColor: t.color,
                color: selectedTask === t.id ? '#0a0e27' : t.color
              }}
            >
              {t.name}
            </button>
          ))}
        </div>

        <div className="calendar-main">
          {task && (
            <>
              <div className="calendar-controls">
                <button onClick={prevMonth} className="month-nav">‹</button>
                <h3>{monthNames[month]} {year}</h3>
                <button onClick={nextMonth} className="month-nav">›</button>
              </div>

              <div className="calendar-grid">
                {dayNames.map(name => (
                  <div key={name} className="calendar-day-name">{name}</div>
                ))}
                {days}
              </div>
            </>
          )}

          {tasks.length === 0 && (
            <div className="empty-calendar">
              <p>{t('noTasksToDisplay')}</p>
            </div>
          )}
        </div>
      </div>

      {task && (
        <div className="calendar-stats">
          <div className="stat-item">
            <span className="stat-label">{t('totalTime')}:</span>
            <span className="stat-value" style={{ color: task.color }}>
              {formatTimeCompact(task.totalTime, { hours: t('hours'), minutes: t('minutes') })}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('sessions')}:</span>
            <span className="stat-value" style={{ color: task.color }}>
              {task.history.length}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;

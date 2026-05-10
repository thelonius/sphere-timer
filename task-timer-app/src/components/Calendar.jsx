import { useState, useMemo } from 'react';
import { useLanguage } from '../context/useLanguage';
import { formatTimeCompact, getTodayDate } from '../utils/timeUtils';
import './Calendar.css';

function Calendar({ tasks, archivedTasks = [], onClose }) {
  const { t } = useLanguage();
  const allTasks = useMemo(() => [...tasks, ...archivedTasks], [tasks, archivedTasks]);
  const [selectedTask, setSelectedTask] = useState(allTasks[0]?.id || null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [startText, setStartText] = useState('');
  const [endText, setEndText] = useState('');

  const todayFormatted = useMemo(() => {
    const d = new Date();
    return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
  }, []);

  const parseTextDate = (text) => {
    const s = text.trim();
    // DD.MM.YYYY or D.M.YYYY (with dots)
    const dot = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
    if (dot) {
      const d = parseInt(dot[1]), m = parseInt(dot[2]), y = dot[3];
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12)
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      return '';
    }
    const digits = s.replace(/\D/g, '');
    // 8 digits DDMMYYYY
    if (digits.length === 8) {
      const d = parseInt(digits.slice(0, 2)), m = parseInt(digits.slice(2, 4)), y = digits.slice(4);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12)
        return `${y}-${digits.slice(2, 4)}-${digits.slice(0, 2)}`;
    }
    // 7 digits DDMYYYY (single-digit month 1–9)
    if (digits.length === 7) {
      const d = parseInt(digits.slice(0, 2)), m = parseInt(digits.slice(2, 3)), y = digits.slice(3);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 9)
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    // 6 digits DMYYYY (single-digit day and month 1–9)
    if (digits.length === 6) {
      const d = parseInt(digits.slice(0, 1)), m = parseInt(digits.slice(1, 2)), y = digits.slice(2);
      if (d >= 1 && d <= 9 && m >= 1 && m <= 9)
        return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return '';
  };

  const reformatDate = (iso) => {
    const [y, m, d] = iso.split('-');
    return `${d}.${m}.${y}`;
  };

  const handleStartChange = (e) => {
    const val = e.target.value;
    setStartText(val);
    setStartDate(parseTextDate(val));
  };

  const handleEndChange = (e) => {
    const val = e.target.value;
    setEndText(val);
    setEndDate(parseTextDate(val));
  };

  const handleStartBlur = () => {
    const parsed = parseTextDate(startText);
    if (parsed) setStartText(reformatDate(parsed));
  };

  const handleEndBlur = () => {
    const parsed = parseTextDate(endText);
    if (parsed) setEndText(reformatDate(parsed));
  };

  const fillToday = () => {
    setEndText(todayFormatted);
    setEndDate(parseTextDate(todayFormatted));
  };

  const clearDateFilter = () => {
    setStartText(''); setEndText('');
    setStartDate(''); setEndDate('');
  };

  const task = allTasks.find(t => t.id === selectedTask);

  const isInDateRange = (dateString) => {
    if (startDate && dateString < startDate) return false;
    if (endDate && dateString > endDate) return false;
    return true;
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = (firstDay.getDay() + 6) % 7;
    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const getTimeForDate = (dateString) => {
    if (!task || !isInDateRange(dateString)) return 0;

    let time = task.history
      .filter(h => h.date === dateString)
      .reduce((sum, h) => sum + h.time, 0);

    if (task.isActive && task.startTime) {
      const now = Date.now();
      const [y, m, d] = dateString.split('-').map(Number);
      const dayStart = new Date(y, m - 1, d).getTime();
      const dayEnd = dayStart + 24 * 60 * 60 * 1000;
      const overlapStart = Math.max(task.startTime, dayStart);
      const overlapEnd = Math.min(now, dayEnd);
      if (overlapEnd > overlapStart) {
        time += overlapEnd - overlapStart;
      }
    }

    return time;
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);

  const prevMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  const nextMonth = () => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));

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
    const isToday = dateString === getTodayDate();

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

  const filteredHistory = useMemo(() => {
    if (!task) return [];
    return task.history.filter(h => isInDateRange(h.date));
  }, [task, startDate, endDate]);

  const filteredTotalTime = useMemo(() => {
    const historyTime = filteredHistory.reduce((sum, h) => sum + h.time, 0);
    if (!startDate && !endDate && task?.isActive && task?.startTime) {
      return historyTime + (Date.now() - task.startTime);
    }
    return historyTime;
  }, [filteredHistory, startDate, endDate, task]);

  const filteredSessions = useMemo(() => {
    const count = filteredHistory.reduce((sum, h) => sum + (h.sessions || 0), 0);
    if (!startDate && !endDate && task?.isActive) return count + 1;
    return count;
  }, [filteredHistory, startDate, endDate, task]);

  const hasDateFilter = startText || endText;

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h2>{t('timeStatistics')}</h2>
        <button className="close-button" onClick={onClose}></button>
      </div>

      <div className="calendar-content">
        <div className="task-selector">
          {tasks.map(task => (
            <button
              key={task.id}
              className={`task-badge ${selectedTask === task.id ? 'active' : ''}`}
              onClick={() => setSelectedTask(task.id)}
              style={{
                backgroundColor: selectedTask === task.id ? task.color : 'transparent',
                borderColor: task.color,
                color: selectedTask === task.id ? '#0a0e27' : task.color
              }}
            >
              {task.name}
            </button>
          ))}
          {archivedTasks.length > 0 && (
            <>
              {tasks.length > 0 && <div className="task-selector-divider" />}
              <div className="task-selector-archive-label">{t('archiveSection')}</div>
              {archivedTasks.map(task => (
                <button
                  key={task.id}
                  className={`task-badge archived ${selectedTask === task.id ? 'active' : ''}`}
                  onClick={() => setSelectedTask(task.id)}
                  style={{
                    backgroundColor: selectedTask === task.id ? task.color : 'transparent',
                    borderColor: task.color,
                    color: selectedTask === task.id ? '#0a0e27' : task.color,
                    opacity: selectedTask === task.id ? 1 : 0.6,
                  }}
                >
                  {task.name}
                </button>
              ))}
            </>
          )}
        </div>

        <div className="calendar-main">
          <div className="date-filter-row">
            <label className="date-filter-label">{t('dateFrom')}</label>
            <input
              type="text"
              className={`date-filter-input ${startText && !startDate ? 'date-filter-input--invalid' : ''}`}
              placeholder={t('datePlaceholder')}
              value={startText}
              onChange={handleStartChange}
              onBlur={handleStartBlur}
              maxLength={10}
            />
            <label className="date-filter-label">{t('dateTo')}</label>
            <input
              type="text"
              className={`date-filter-input ${endText && !endDate ? 'date-filter-input--invalid' : ''}`}
              placeholder={todayFormatted}
              value={endText}
              onChange={handleEndChange}
              onBlur={handleEndBlur}
              maxLength={10}
            />
            <button className="date-filter-today" onClick={fillToday} title={todayFormatted}>
              {t('today')}
            </button>
            {hasDateFilter && (
              <button className="date-filter-clear" onClick={clearDateFilter}>
                {t('clearFilter')}
              </button>
            )}
          </div>

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

          {allTasks.length === 0 && (
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
              {formatTimeCompact(filteredTotalTime, { hours: t('hours'), minutes: t('minutes') })}
            </span>
          </div>
          <div className="stat-item">
            <span className="stat-label">{t('sessions')}:</span>
            <span className="stat-value" style={{ color: task.color }}>
              {filteredSessions}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default Calendar;

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSync from '../hooks/useSync';
import { useLanguage } from '../context/useLanguage';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import Calendar from './Calendar';
import Constellations from './Constellations';
import Notification from './Notification';
import { saveTasks } from '../utils/storageUtils';
import { getTodayDate, formatTime } from '../utils/timeUtils';
import { tasksAPI } from '../services/api';
import SettingsModal from './SettingsModal';
import './Dashboard.css';

const API_ERROR_MAP = {
  'Timer is not running': 'errorTimerNotRunning',
  'Timer already running': 'errorTimerAlreadyRunning',
  'Task not found': 'errorTaskNotFound',
  'Access denied': 'errorAccessDenied',
  'Could not connect to server': 'errorNetwork',
  'Task with this name already exists': 'duplicateTaskName',
};

function Dashboard({ user, onLogout }) {
  const { t, toggleLanguage, language } = useLanguage();

  const tError = (msg) => {
    const key = Object.keys(API_ERROR_MAP).find(k => msg?.includes(k));
    return key ? t(API_ERROR_MAP[key]) : (msg || t('errorUnknown'));
  };
  const headerRef = useRef(null);
  const tasksHeaderRef = useRef(null);
  const faviconCanvasRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskIds, setActiveTaskIds] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showArchiveSection, setShowArchiveSection] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [pulsingTaskIds, setPulsingTaskIds] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [syncStatus, setSyncStatus] = useState('connecting');

  // Timer for updating global current time once per second
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.getTasks(true);
      if (response.success) {
        const active = response.data.filter(t => !t.isArchived);
        const archived = response.data.filter(t => t.isArchived);
        setTasks(active);
        setArchivedTasks(archived);
        setActiveTaskIds(active.filter(t => t.isActive).map(t => t.id));
      }
    } catch (error) {
      setNotification(tError(error.message));
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncEvent = useCallback((event) => {
    if (event.type === 'CONNECTED') {
      setSyncStatus('connected');
      fetchTasks();
      return;
    }

    const { type, data } = event;
    
    switch (type) {
      case 'TASK_STARTED':
        setTasks(prev => prev.map(t => 
          t.id === data.id ? { ...t, ...data } : t
        ));
        setActiveTaskIds(prev => prev.includes(data.id) ? prev : [...prev, data.id]);
        break;
      
      case 'TASK_STOPPED':
        setTasks(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t));
        setActiveTaskIds(prev => prev.filter(id => id !== data.id));
        break;
      
      case 'TASK_CREATED':
        setTasks(prev => {
          if (prev.some(t => t.id === data.id)) return prev;
          return [...prev, data].sort((a, b) => a.orderIndex - b.orderIndex);
        });
        break;
      
      case 'TASK_UPDATED':
        setTasks(prev => prev.map(t => t.id === data.id ? { ...t, ...data } : t)
          .sort((a, b) => a.orderIndex - b.orderIndex));
        break;
      
      case 'TASK_DELETED':
        setTasks(prev => prev.filter(t => t.id !== data.id));
        setArchivedTasks(prev => prev.filter(t => t.id !== data.id));
        setActiveTaskIds(prev => prev.filter(id => id !== data.id));
        break;

      case 'TASK_ARCHIVED':
        setTasks(prev => prev.filter(t => t.id !== data.id));
        setArchivedTasks(prev => prev.some(t => t.id === data.id) ? prev : [data, ...prev]);
        setActiveTaskIds(prev => prev.filter(id => id !== data.id));
        break;

      case 'TASK_RESTORED':
        setArchivedTasks(prev => prev.filter(t => t.id !== data.id));
        setTasks(prev => prev.some(t => t.id === data.id) ? prev : [...prev, data].sort((a, b) => a.orderIndex - b.orderIndex));
        break;

      default:
        break;
    }
  }, [fetchTasks]);

  useSync(handleSyncEvent);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const drawFavicon = useCallback((innerR, glowPhase = 0) => {
    if (!faviconCanvasRef.current) {
      faviconCanvasRef.current = document.createElement('canvas');
      faviconCanvasRef.current.width = 64;
      faviconCanvasRef.current.height = 64;
    }
    const canvas = faviconCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 64, 64);

    // Glow halo: transitions cyan→magenta matching login screen's `pulse` animation.
    // glowPhase 0 = cyan peak, 1 = magenta peak.
    const gr = Math.round(255 * glowPhase);
    const gg = Math.round(245 * (1 - glowPhase));
    ctx.fillStyle = `rgba(${gr}, ${gg}, 255, 0.25)`;
    ctx.beginPath();
    ctx.arc(32, 32, 32, 0, Math.PI * 2);
    ctx.fill();

    // Outer cyan circle (fixed)
    ctx.fillStyle = '#00f5ff';
    ctx.beginPath();
    ctx.arc(32, 32, 30, 0, Math.PI * 2);
    ctx.fill();

    // Inner dark circle — never fills completely, controls ring thickness
    ctx.fillStyle = '#0a0e27';
    ctx.beginPath();
    ctx.arc(32, 32, innerR, 0, Math.PI * 2);
    ctx.fill();

    let link = document.querySelector('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = canvas.toDataURL();
  }, []);

  const updateTitle = useCallback((activeTasks, pulsingTasks = []) => {
    if (pulsingTasks.length > 0) {
      document.title = pulsingTasks[0].name;
    } else if (activeTasks.length === 0) {
      document.title = 'SphereTimer';
    } else {
      document.title = `${activeTasks.length} | ${activeTasks.map(t => t.name).join(' • ')}`;
    }
  }, []);

  const activeTasks = useMemo(() =>
    tasks.filter(t => activeTaskIds.includes(t.id)),
    [tasks, activeTaskIds]
  );

  const pulsingTasks = useMemo(() =>
    tasks.filter(t => pulsingTaskIds.includes(t.id)),
    [tasks, pulsingTaskIds]
  );

  const filteredTasks = useMemo(() =>
    searchQuery.trim()
      ? tasks.filter(task => task.name.toLowerCase().includes(searchQuery.toLowerCase()))
      : tasks,
    [tasks, searchQuery]
  );

  useEffect(() => {
    if (pulsingTaskIds.length === 0) updateTitle(activeTasks);
  }, [activeTasks, pulsingTaskIds, updateTitle]);

  useEffect(() => {
    // Idle: static logo — innerR=18, no glow
    drawFavicon(18, 0);

    if (pulsingTasks.length > 0) {
      // Alert: fast pulse (0.7s period), wide ring swing for urgency
      let t = 0;
      let titleOn = true;
      const interval = setInterval(() => {
        t += 60;
        const cos = Math.cos(2 * Math.PI * t / 700);
        // innerR swings 8 (thick) ↔ 22 (thin), never fully fills
        drawFavicon(Math.round(15 + 7 * cos), (1 - cos) / 2);
        const newTitleOn = cos > 0;
        if (newTitleOn !== titleOn) {
          titleOn = newTitleOn;
          if (titleOn) updateTitle([], pulsingTasks);
          else updateTitle(activeTasks);
        }
      }, 60);
      return () => clearInterval(interval);
    }

    if (activeTasks.length > 0) {
      // Active: slow breath matching login's innerPulse (3s period).
      // Cosine starts at 1 → begins at rest position (thin ring).
      // innerR: 18 (thin ring, rest) → 10 (thick ring, exhale) → 18
      let t = 0;
      const interval = setInterval(() => {
        t += 60;
        const cos = Math.cos(2 * Math.PI * t / 3000);
        const innerR = Math.round(14 + 4 * cos);       // 10 – 18
        const glowPhase = (1 - cos) / 2;              // 0 (cyan) → 1 (magenta)
        drawFavicon(innerR, glowPhase);
      }, 60);
      return () => clearInterval(interval);
    }
  }, [activeTasks, pulsingTasks, drawFavicon, updateTitle]);

  // Update CSS variables with the header and subheader heights so main padding is correct on mobile when they wrap
  useEffect(() => {
    const setHeights = () => {
      if (headerRef.current) {
        const height = headerRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
      if (tasksHeaderRef.current) {
        const sh = tasksHeaderRef.current.getBoundingClientRect().height;
        document.documentElement.style.setProperty('--subheader-height', `${sh}px`);
      }
    };

    setHeights();
    window.addEventListener('resize', setHeights);

    // Also observe mutations (e.g., when task form opens and increases height)
    const ro = new ResizeObserver(setHeights);
    if (headerRef.current) ro.observe(headerRef.current);
    if (tasksHeaderRef.current) ro.observe(tasksHeaderRef.current);

    return () => {
      window.removeEventListener('resize', setHeights);
      ro.disconnect();
    };
  }, [user.username, language, showCalendar]);

  // Handle window resize for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const createTask = async (taskData) => {
    try {
      const response = await tasksAPI.createTask(taskData);
      if (response.success) {
        setTasks([...tasks, response.data]);
        setShowTaskForm(false);
      }
    } catch (error) {
      setNotification(tError(error.message));
    }
  };

  const scrollToTask = (taskId) => {
    const element = document.getElementById(`task-${taskId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedTaskId(taskId);
      setTimeout(() => setHighlightedTaskId(null), 2000);
    }
  };

  const deleteTask = async (taskId) => {
    try {
      const response = await tasksAPI.deleteTask(taskId);
      if (response.success) {
        setActiveTaskIds(prev => prev.filter(id => id !== taskId));
        setTasks(prev => prev.filter(task => task.id !== taskId));
      }
    } catch (error) {
      setNotification(tError(error.message));
    }
  };

  const archiveTask = async (taskId) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setArchivedTasks(prev => prev.some(t => t.id === taskId) ? prev : [{ ...task, isArchived: true }, ...prev]);
    setActiveTaskIds(prev => prev.filter(id => id !== taskId));
    try {
      await tasksAPI.archiveTask(taskId);
    } catch (error) {
      setNotification(tError(error.message));
      fetchTasks();
    }
  };

  const restoreTask = async (taskId) => {
    setArchivedTasks(prev => prev.filter(t => t.id !== taskId));
    try {
      const response = await tasksAPI.restoreTask(taskId);
      if (response.success) {
        setTasks(prev =>
          prev.some(t => t.id === taskId)
            ? prev
            : [...prev, response.data].sort((a, b) => a.orderIndex - b.orderIndex)
        );
      }
    } catch (error) {
      setNotification(tError(error.message));
      fetchTasks();
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      const response = await tasksAPI.updateTask(taskId, updates);
      if (response.success) {
        setTasks(prev => prev.map(task => 
          task.id === taskId ? response.data : task
        ));
      }
    } catch (error) {
      setNotification(tError(error.message));
    }
  };

  const toggleTimer = async (taskId) => {
    // Если задача пульсирует, то нажатие на нее (в любом месте, но тут через toggle) останавливает пульсацию
    setPulsingTaskIds(prev => prev.filter(id => id !== taskId));

    const isCurrentlyActive = activeTaskIds.includes(taskId);

    if (isCurrentlyActive) {
      // Остановить таймер
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const now = Date.now();
      const sessionTime = now - task.startTime;

      // Split session across calendar days
      const splitEntries = [];
      const startMs = task.startTime;
      let dayStart = new Date(startMs);
      dayStart.setHours(0, 0, 0, 0);
      while (dayStart.getTime() < now) {
        const dayStartMs = dayStart.getTime();
        const dayEndMs = dayStartMs + 86400000;
        const ovStart = Math.max(startMs, dayStartMs);
        const ovEnd = Math.min(now, dayEndMs);
        if (ovEnd > ovStart) {
          const y = dayStart.getFullYear();
          const m = String(dayStart.getMonth() + 1).padStart(2, '0');
          const d = String(dayStart.getDate()).padStart(2, '0');
          splitEntries.push({ date: `${y}-${m}-${d}`, time: ovEnd - ovStart, timestamp: now });
        }
        dayStart = new Date(dayEndMs);
      }

      const optimisticUpdate = {
        ...task,
        totalTime: task.totalTime + sessionTime,
        history: [...task.history, ...splitEntries],
        startTime: null,
        isActive: false
      };

      setTasks(prev => prev.map(t => t.id === taskId ? optimisticUpdate : t));
      setActiveTaskIds(prev => prev.filter(id => id !== taskId));

      setTasks(currentTasks => {
        const nextTasks = currentTasks.map(t => t.id === taskId ? optimisticUpdate : t);
        saveTasks(user?.username || 'default', nextTasks);
        return nextTasks;
      });

      try {
        const response = await tasksAPI.stopTimer(taskId);
        if (response.success) {
          setTasks(prev => prev.map(t => t.id === taskId ? response.data : t));
        }
      } catch (error) {
        setNotification(tError(error.message));
      }
    } else {
      const now = Date.now();

      setTasks(prev => prev.map(t =>
        t.id === taskId ? { ...t, startTime: now, isActive: true } : t
      ));
      setActiveTaskIds(prev => [...prev, taskId]);

      setTasks(currentTasks => {
        saveTasks(user?.username || 'default', currentTasks);
        return currentTasks;
      });

      try {
        const response = await tasksAPI.startTimer(taskId);
        if (response.success) {
          setTasks(prev => prev.map(t => t.id === taskId ? response.data : t));
        }
      } catch (error) {
        setNotification(tError(error.message));
      }
    }
  };

  const setTaskPulsing = (taskId, isPulsing) => {
    setPulsingTaskIds(prev =>
      isPulsing
        ? prev.includes(taskId) ? prev : [...prev, taskId]
        : prev.filter(id => id !== taskId)
    );
  };

  return (
    <div className="dashboard">
      <header ref={headerRef} className="dashboard-header">
        <div className="header-inner">
          <div className="header-left">
            <h1 className="dashboard-title">SphereTimer</h1>
          </div>
          <div className="header-center">
            <div
              className="user-badge" 
              onClick={() => setShowSettings(true)}
              style={{ cursor: 'pointer' }}
              title={t('settings')}
            >
              <div className="user-avatar">{user.username[0].toUpperCase()}</div>
              <span className="username">{user.username}</span>
            </div>
          </div>
          <div className="header-right">
            <button 
              className="icon-button calendar-button"
              onClick={() => setShowCalendar(!showCalendar)}
              title={t('calendar')}
            >
              <img src="/calendar-icon.svg" alt="Calendar" className="icon-calendar-svg" />
            </button>
            <button 
              className="icon-button language-button"
              onClick={toggleLanguage}
              title={t('language')}
            >
              <span className="icon-lang">{language === 'ru' ? 'EN' : 'RU'}</span>
            </button>
            <button 
              className="icon-button logout-button"
              onClick={onLogout}
              title={t('logout')}
            >
              <img src="/logout-icon.svg" alt="Logout" className="icon-logout-svg" />
            </button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="task-loader">
          <div ref={tasksHeaderRef} className="task-header">
            <div className="tasks-inner">
              <h2>{t('myTasks')}</h2>
              <button 
                className="create-task-button"
                onClick={() => setShowTaskForm(true)}
              >
                <span>+</span> {t('newTask')}
              </button>
            </div>
          </div>

          {showTaskForm && (
            <TaskForm
              onSubmit={createTask}
              onCancel={() => setShowTaskForm(false)}
              existingNames={tasks.map(t => t.name)}
            />
          )}

          <div className="task-search-wrapper">
            <input
              type="text"
              className="task-search-input"
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button className="task-search-clear" onClick={() => setSearchQuery('')}>×</button>
            )}
          </div>

          <div className="tasks-scroll">
            <TaskList
              tasks={filteredTasks}
              activeTaskIds={activeTaskIds}
              pulsingTaskIds={pulsingTaskIds}
              highlightedTaskId={highlightedTaskId}
              onToggleTimer={toggleTimer}
              onDelete={deleteTask}
              onUpdate={updateTask}
              onArchive={archiveTask}
              onReorder={setTasks}
              onSetPulsing={setTaskPulsing}
              existingNames={tasks.map(t => t.name)}
            />
            {searchQuery.trim() && filteredTasks.length === 0 && (
              <div className="search-empty-state">{t('noSearchResults')}</div>
            )}

            {archivedTasks.length > 0 && (
              <div className="archive-section">
                <button
                  className="archive-section-toggle"
                  onClick={() => setShowArchiveSection(s => !s)}
                >
                  <span>{t('archiveSection')} ({archivedTasks.length})</span>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{ transform: showArchiveSection ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </button>

                {showArchiveSection && (
                  <div className="archived-tasks-list">
                    {archivedTasks.map(task => (
                      <div key={task.id} className="archived-task-item" style={{ borderLeftColor: task.color }}>
                        <div className="archived-task-dot" style={{ backgroundColor: task.color }} />
                        <div className="archived-task-name">{task.name}</div>
                        <div className="archived-task-time">{formatTime(task.totalTime)}</div>
                        <button
                          className="restore-button"
                          onClick={() => restoreTask(task.id)}
                          title={t('restore')}
                        >
                          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="1 4 1 10 7 10"/>
                            <path d="M3.51 15a9 9 0 1 0 .49-3.45"/>
                          </svg>
                        </button>
                        <button
                          className="delete-button"
                          onClick={() => deleteTask(task.id)}
                          title={t('delete')}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {!isMobile && (
          <div className="constellations-container">
            <Constellations
              activeTasks={activeTasks}
              onTaskClick={(task) => scrollToTask(task.id)}
            />
          </div>
        )}
      </main>

      {showCalendar && (
        <div className="calendar-overlay" onClick={() => setShowCalendar(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Calendar
              tasks={tasks}
              archivedTasks={archivedTasks}
              onClose={() => setShowCalendar(false)}
            />
          </div>
        </div>
      )}

      {showSettings && (
        <SettingsModal 
          user={user}
          onClose={() => setShowSettings(false)}
        />
      )}

      {notification && (
        <Notification 
          message={notification}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}

export default Dashboard;

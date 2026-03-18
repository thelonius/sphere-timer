import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import useSync from '../hooks/useSync';
import { useLanguage } from '../context/useLanguage';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import Calendar from './Calendar';
import Constellations from './Constellations';
import Notification from './Notification';
import { saveTasks, loadTasks } from '../utils/storageUtils';
import { tasksAPI } from '../services/api';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const { t, toggleLanguage, language } = useLanguage();
  const headerRef = useRef(null);
  const tasksHeaderRef = useRef(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTaskIds, setActiveTaskIds] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [syncStatus, setSyncStatus] = useState('connecting');

  const fetchTasks = useCallback(async () => {
    try {
      setLoading(true);
      const response = await tasksAPI.getTasks();
      if (response.success) {
        setTasks(response.data);
        const active = response.data.filter(t => t.isActive).map(t => t.id);
        setActiveTaskIds(active);
      }
    } catch (error) {
      setNotification(error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSyncEvent = useCallback((event) => {
    console.log('Sync event received:', event);
    
    if (event.type === 'CONNECTED') {
      setSyncStatus('connected');
      fetchTasks();
      return;
    }

    const { type, data } = event;
    
    switch (type) {
      case 'TASK_STARTED':
        setTasks(prev => prev.map(t => 
          t.id === data.id ? { ...t, ...data } : { ...t, isActive: false, startTime: null }
        ));
        setActiveTaskIds([data.id]);
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
        setActiveTaskIds(prev => prev.filter(id => id !== data.id));
        break;
      
      default:
        break;
    }
  }, [fetchTasks]);

  useSync(handleSyncEvent);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const updateFavicon = useCallback((activeTasks, isPulsing = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    if (activeTasks.length === 0) {
      // Нет активных задач - стандартная иконка
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, 64, 64);
      ctx.strokeStyle = '#00F5FF';
      ctx.lineWidth = 2;
      ctx.arc(32, 32, 24, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Используем цвет первой активной задачи
      const primaryColor = activeTasks[0].color;
      const radius = isPulsing ? 30 : 32;
      const glowRadius = isPulsing ? 30 : 32;
      
      // Свечение
      const gradient = ctx.createRadialGradient(32, 32, radius, 32, 32, glowRadius);
      gradient.addColorStop(0, primaryColor);
      gradient.addColorStop(1, primaryColor + '00');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, 64, 64);
      
      // Основной круг
      ctx.fillStyle = primaryColor;
      ctx.beginPath();
      ctx.arc(32, 32, radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Если больше одной задачи, добавляем индикатор
      if (activeTasks.length > 1) {
        ctx.fillStyle = '#050811';
        ctx.font = 'bold 32px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeTasks.length.toString(), 32, 34);
      }
    }
    
    const link = document.querySelector('link[rel="icon"]') || document.createElement('link');
    link.rel = 'icon';
    link.href = canvas.toDataURL();
    document.head.appendChild(link);
  }, []);

  const updateTitle = useCallback((activeTasks) => {
    if (activeTasks.length === 0) {
      document.title = 'SphereTimer';
    } else {
      const names = activeTasks.map(t => t.name).join(' • ');
      document.title = names;
    }
  }, []);

  const activeTasks = useMemo(() => 
    tasks.filter(t => activeTaskIds.includes(t.id)), 
    [tasks, activeTaskIds]
  );

  useEffect(() => {
    updateFavicon(activeTasks);
    updateTitle(activeTasks);
    
    // Пульсация favicon для активных задач
    let pulseInterval;
    if (activeTasks.length > 0) {
      let isPulsing = false;
      pulseInterval = setInterval(() => {
        isPulsing = !isPulsing;
        updateFavicon(activeTasks, isPulsing);
      }, 1500);
    }
    
    return () => {
      if (pulseInterval) clearInterval(pulseInterval);
    };
  }, [activeTasks, updateFavicon, updateTitle]);

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
      setNotification(error.message);
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
        if (activeTaskIds.includes(taskId)) {
          setActiveTaskIds(activeTaskIds.filter(id => id !== taskId));
        }
        setTasks(tasks.filter(task => task.id !== taskId));
      }
    } catch (error) {
      setNotification(error.message);
    }
  };

  const updateTask = async (taskId, updates) => {
    try {
      const response = await tasksAPI.updateTask(taskId, updates);
      if (response.success) {
        setTasks(tasks.map(task => 
          task.id === taskId ? response.data : task
        ));
      }
    } catch (error) {
      setNotification(error.message);
    }
  };

  const toggleTimer = async (taskId) => {
    try {
      if (activeTaskIds.includes(taskId)) {
        // Stop timer
        const response = await tasksAPI.stopTimer(taskId);
        if (response.success) {
          setTasks(tasks.map(t => t.id === taskId ? response.data : t));
          setActiveTaskIds(activeTaskIds.filter(id => id !== taskId));
        }
      } else {
        // Start timer
        // Backend handles stopping previous tasks for the user
        const response = await tasksAPI.startTimer(taskId);
        if (response.success) {
          // Since backend might stop another task, we should refresh most data
          // or at least handle the single active task pattern
          setTasks(tasks.map(t => {
            if (t.id === taskId) return { ...t, isActive: true, startTime: response.data.startTime };
            return { ...t, isActive: false, startTime: null };
          }));
          setActiveTaskIds([taskId]);
        }
      }
    } catch (error) {
      setNotification(error.message);
    }
  };

  return (
    <div className="dashboard">
      <header ref={headerRef} className="dashboard-header">
        <div className="header-inner">
          <div className="header-left">
            <h1 className="dashboard-title">SphereTimer</h1>
            {/* <div className="user-badge">
              <div className="user-avatar">{user.username[0].toUpperCase()}</div>
              <span className="username">{user.username}</span>
            </div> */}
          </div>
          <div className="header-center">
            {/* <h1 className="dashboard-title">SphereTimer</h1> */}
            <div className="user-badge">
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
            />
          )}

          <div className="tasks-scroll">
            <TaskList
              tasks={tasks}
              activeTaskIds={activeTaskIds}
              highlightedTaskId={highlightedTaskId}
              onToggleTimer={toggleTimer}
              onDelete={deleteTask}
              onUpdate={updateTask}
              onReorder={setTasks}
            />
          </div>
        </div>

        {!isMobile && (
          <div className="constellations-container">
            <Constellations 
              activeTasks={tasks.filter(t => activeTaskIds.includes(t.id))}
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
              onClose={() => setShowCalendar(false)}
            />
          </div>
        </div>
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

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useLanguage } from '../context/useLanguage';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import Calendar from './Calendar';
import Constellations from './Constellations';
import Notification from './Notification';
import { saveTasks, loadTasks } from '../utils/storageUtils';
import './Dashboard.css';

function Dashboard({ user, onLogout }) {
  const { t, toggleLanguage, language } = useLanguage();
  const headerRef = useRef(null);
  const tasksHeaderRef = useRef(null);
  const [tasks, setTasks] = useState(() => loadTasks(user.username));
  const [activeTaskIds, setActiveTaskIds] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [highlightedTaskId, setHighlightedTaskId] = useState(null);
  const [notification, setNotification] = useState(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    saveTasks(user.username, tasks);
  }, [tasks, user.username]);

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
      const radius = isPulsing ? 26 : 28;
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
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeTasks.length.toString(), 32, 32);
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

  const createTask = (taskData) => {
    const newTask = {
      id: Date.now(),
      ...taskData,
      totalTime: 0,
      history: [],
      createdAt: new Date().toISOString(),
    };
    setTasks([...tasks, newTask]);
    setShowTaskForm(false);
  };

  const scrollToTask = (taskId) => {
    const element = document.getElementById(`task-${taskId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedTaskId(taskId);
      setTimeout(() => setHighlightedTaskId(null), 2000);
    }
  };

  const deleteTask = (taskId) => {
    if (activeTaskIds.includes(taskId)) {
      setActiveTaskIds(activeTaskIds.filter(id => id !== taskId));
    }
    setTasks(tasks.filter(task => task.id !== taskId));
  };

  const updateTask = (taskId, updates) => {
    setTasks(tasks.map(task => 
      task.id === taskId ? { ...task, ...updates } : task
    ));
  };

  const toggleTimer = (taskId) => {
    if (activeTaskIds.includes(taskId)) {
      // Остановить таймер
      const task = tasks.find(t => t.id === taskId);
      const now = Date.now();
      const sessionTime = now - task.startTime;
      
      const updatedTask = {
        ...task,
        totalTime: task.totalTime + sessionTime,
        history: [
          ...task.history,
          {
            date: new Date().toISOString().split('T')[0],
            time: sessionTime,
            timestamp: now,
          }
        ],
        startTime: null,
      };
      
      setTasks(tasks.map(t => t.id === taskId ? updatedTask : t));
      setActiveTaskIds(activeTaskIds.filter(id => id !== taskId));
    } else {
      // Запустить таймер (максимум 3 задачи)
      if (activeTaskIds.length >= 3) {
        setNotification(t('maxTasksLimit'));
        return;
      }
      
      setTasks(tasks.map(t => 
        t.id === taskId ? { ...t, startTime: Date.now() } : t
      ));
      setActiveTaskIds([...activeTaskIds, taskId]);
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

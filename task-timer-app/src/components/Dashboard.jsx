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
  const [pulsingTaskIds, setPulsingTaskIds] = useState([]);
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

  const updateFavicon = useCallback((activeTasks, isPulsingBall = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    
    ctx.clearRect(0, 0, 64, 64);
    
    if (activeTasks.length === 0 && !isPulsingBall) {
      // 1. Стандартная иконка (без задач)
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(8, 8, 48, 48); // Небольшой темный фон внутри кольца
      ctx.strokeStyle = '#00f5ff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(32, 32, 28, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Цвет фона - цвет первой задачи в списке
      const bgColor = activeTasks.length > 0 ? activeTasks[0].color : '#00f5ff';
      
      // 2. Отрисовываем цветной фон
      ctx.fillStyle = bgColor;
      ctx.beginPath();
      ctx.arc(32, 32, 32, 0, Math.PI * 2);
      ctx.fill();
      
      if (isPulsingBall) {
        // 3. Режим алертов: пульсирующий черный шар
        const innerRadius = isPulsingBall ? 20 : 25; // Здесь isPulsingBall - это флаг, мы можем менять радиус в интервале
        // На самом деле, для простоты будем использовать константу или переданный флаг
        const r = 24 + Math.sin(Date.now() / 150) * 4; // Плавная анимация если бы мы вызывали чаще, но у нас setInterval.
        // Используем фиксированные шаги из setInterval
        const pulseR = 22; 
        
        const gradient = ctx.createRadialGradient(32, 32, 2, 32, 32, pulseR);
        gradient.addColorStop(0, '#1a1f35');
        gradient.addColorStop(1, '#050811');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(32, 32, pulseR, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 4. Режим работы: число задач
        ctx.fillStyle = '#050811'; // Темный цвет приложения
        ctx.font = 'bold 44px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(activeTasks.length.toString(), 32, 35);
      }
    }
    
    const link = document.querySelector('link[rel="icon"]') || document.createElement('link');
    link.rel = 'icon';
    link.href = canvas.toDataURL();
    document.head.appendChild(link);
  }, []);

  const updateTitle = useCallback((activeTasks, pulsingTasks = []) => {
    if (pulsingTasks.length > 0) {
      document.title = pulsingTasks[0].name;
    } else if (activeTasks.length === 0) {
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
    const isRedAlert = pulsingTaskIds.length > 0;
    const pulsingTasks = tasks.filter(t => pulsingTaskIds.includes(t.id));
    
    updateFavicon(activeTasks);
    updateTitle(activeTasks);
    
    // Пульсация favicon для активных задач или алертов
    let pulseInterval;
    if (activeTasks.length > 0 || isRedAlert) {
      let isPulseOn = false;
      pulseInterval = setInterval(() => {
        isPulseOn = !isPulseOn;
        if (isRedAlert && pulsingTasks.length > 0) {
          // Специальная пульсация для стопа: черный шар на цветном фоне
          updateFavicon(pulsingTasks, isPulseOn);
          if (isPulseOn) {
            updateTitle([], pulsingTasks);
          } else {
            updateTitle(activeTasks);
          }
        } else {
          // Обычный режим: просто обновляем, если нужно мигать иконкой (например)
          // Но по условию нам нужно просто число, которое не мигает, или мигает?
          // "число запущеных задач отражается вместо фавикона"
          updateFavicon(activeTasks, false);
        }
      }, isRedAlert ? 700 : 3000);
    }
    
    return () => {
      if (pulseInterval) clearInterval(pulseInterval);
    };
  }, [activeTasks, pulsingTaskIds, tasks, updateFavicon, updateTitle]);

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

  const toggleTimer = (taskId) => {
    // Если задача пульсирует, то нажатие на нее (в любом месте, но тут через toggle) останавливает пульсацию
    if (pulsingTaskIds.includes(taskId)) {
      setPulsingTaskIds(pulsingTaskIds.filter(id => id !== taskId));
    }

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
      
      // Записываем локально в сторадж чтобы не терять до синхронизации бэка
      saveTasks(user?.username || 'default', tasks.map(t => t.id === taskId ? updatedTask : t));
    } else {
      // Запустить таймер
      const updatedTasks = tasks.map(t => 
        t.id === taskId ? { ...t, startTime: Date.now() } : t
      );
      setTasks(updatedTasks);
      setActiveTaskIds([...activeTaskIds, taskId]);
      
      // Записываем локально в сторадж чтобы не терять до синхронизации бэка
      saveTasks(user?.username || 'default', updatedTasks);
    }
  };

  const setTaskPulsing = (taskId, isPulsing) => {
    if (isPulsing) {
      if (!pulsingTaskIds.includes(taskId)) {
        setPulsingTaskIds(prev => [...prev, taskId]);
      }
    } else {
      setPulsingTaskIds(prev => prev.filter(id => id !== taskId));
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
              pulsingTaskIds={pulsingTaskIds}
              highlightedTaskId={highlightedTaskId}
              onToggleTimer={toggleTimer}
              onDelete={deleteTask}
              onUpdate={updateTask}
              onReorder={setTasks}
              onSetPulsing={setTaskPulsing}
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

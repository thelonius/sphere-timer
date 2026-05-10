import { useState, useEffect } from 'react';
import TaskItem from './TaskItem';
import { useLanguage } from '../context/useLanguage';
import './TaskList.css';

function TaskList({ tasks, activeTaskIds, pulsingTaskIds, highlightedTaskId, onToggleTimer, onDelete, onUpdate, onArchive, onReorder, onSetPulsing, existingNames }) {
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [draggedIndex, setDraggedIndex] = useState(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 100);

    return () => clearInterval(interval);
  }, []);

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newTasks = [...tasks];
    const draggedTask = newTasks[draggedIndex];
    newTasks.splice(draggedIndex, 1);
    newTasks.splice(index, 0, draggedTask);
    
    setDraggedIndex(index);
    onReorder(newTasks);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  if (tasks.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">⏱</div>
        <p>{t('noTasks')}</p>
        <p className="empty-subtitle">{t('createFirst')}</p>
      </div>
    );
  }

  return (
    <div className="task-list">
      {tasks.map((task, index) => (
        <TaskItem
          key={task.id}
          task={task}
          isActive={activeTaskIds.includes(task.id)}
          isPulsing={pulsingTaskIds?.includes(task.id)}
          isHighlighted={highlightedTaskId === task.id}
          currentTime={currentTime}
          onToggleTimer={() => onToggleTimer(task.id)}
          onDelete={() => onDelete(task.id)}
          onUpdate={(updates) => onUpdate(task.id, updates)}
          onArchive={onArchive ? () => onArchive(task.id) : undefined}
          onSetPulsing={(isPulsing) => onSetPulsing(task.id, isPulsing)}
          existingNames={existingNames}
          draggable
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          isDragging={draggedIndex === index}
        />
      ))}
    </div>
  );
}

export default TaskList;

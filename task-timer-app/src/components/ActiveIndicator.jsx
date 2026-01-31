import { useEffect, useState } from 'react';
import './ActiveIndicator.css';

function ActiveIndicator({ activeTasks = [], onTaskClick }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activeTasks.length > 0) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [activeTasks]);

  if (!visible || activeTasks.length === 0) return null;

  const title = activeTasks.map(t => t.name).join(', ');

  return (
    <div className="active-indicator" title={`Активные задачи: ${title}`}>
      <div className="indicator-container">
        {activeTasks.map((task, index) => (
          <div 
            key={task.id}
            className="indicator-circle"
            style={{ 
              backgroundColor: task.color,
              animationDelay: `${index * 0.3}s`
            }}
            onClick={() => onTaskClick && onTaskClick(task)}
          >
            <div className="indicator-pulse" style={{ backgroundColor: task.color }}></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default ActiveIndicator;

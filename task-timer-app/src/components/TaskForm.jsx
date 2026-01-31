import { useState } from 'react';
import { useLanguage } from '../context/useLanguage';
import './TaskForm.css';

// Цвета всех звезд из созвездий (спектральные классы)
const PRESET_COLORS = [
  '#AAD4FF',   // Голубые гиганты (O, B класс) - Денеб, Ригель, Регул
  '#64B5F6',   // Яркие голубые - Вега, Беллатрикс
  '#FFFFFF',   // Белые звезды (A класс) - Сириус, Менкалинан
  '#FFF9D0',   // Желто-белые (F класс) - Дубхе, Шедар
  '#FFEB3B',   // Желтые (G класс) - Капелла, Солнце
  '#FFB347',   // Оранжевые (K класс) - Арктур, Альдебаран, Поллукс
  '#FF6B6B',   // Красные (M класс)
  '#FF4757',   // Красные гиганты - Бетельгейзе
];

function TaskForm({ onSubmit, onCancel, initialData = null }) {
  const { t } = useLanguage();
  const [name, setName] = useState(initialData?.name || '');
  const [color, setColor] = useState(initialData?.color || PRESET_COLORS[0]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit({ name: name.trim(), color });
    }
  };

  return (
    <div className="task-form-overlay">
      <div className="task-form">
        <h3>{initialData ? t('editTask') : t('newTask')}</h3>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('taskName')}</label>
            <textarea
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('enterTaskName')}
              className="task-input task-textarea"
              autoFocus
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>{t('taskColor')}</label>
            <div className="color-picker">
              {PRESET_COLORS.map((presetColor) => (
                <button
                  key={presetColor}
                  type="button"
                  className={`color-option ${color === presetColor ? 'selected' : ''}`}
                  style={{ backgroundColor: presetColor }}
                  onClick={() => setColor(presetColor)}
                />
              ))}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-button">
              {t('cancel')}
            </button>
            <button type="submit" className="submit-button">
              {initialData ? t('save') : t('create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default TaskForm;

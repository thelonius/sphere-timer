# Quick Start Guide - Authentication

## Что добавлено

✅ **Система регистрации и авторизации**
- Регистрация с email, username и паролем
- Вход в систему с email и паролем
- Валидация форм на клиенте
- Сохранение токенов в localStorage
- Context API для управления состоянием аутентификации

✅ **API Сервис** (`src/services/api.js`)
- Готовые методы для всех endpoint'ов
- Автоматическое добавление Authorization заголовков
- Обработка ошибок 401 (истекшие токены)
- Конфигурируемый через .env

✅ **Документация**
- README.md - обновлена с инструкциями по интеграции
- BACKEND_API.md - полная документация по API
- .env.example - шаблон переменных окружения

## Как использовать

### Пользовательский сценарий

1. **Регистрация**:
   - Пользователь вводит username, email и пароль
   - Данные валидируются на клиенте
   - После успешной регистрации автоматический вход

2. **Вход**:
   - Пользователь вводит email и пароль
   - После успешного входа данные сохраняются
   - Автоматическое восстановление сессии при перезагрузке

3. **Выход**:
   - Очистка всех данных из localStorage
   - Возврат на экран входа

### Текущая реализация (без бэкенда)

Сейчас система работает в **demo режиме**:
- Любой email/пароль принимается
- Данные сохраняются только в localStorage
- Готова к подключению настоящего API

### Подключение бэкенда

1. Создайте файл `.env`:
```bash
cp .env.example .env
```

2. Укажите URL вашего API:
```env
VITE_API_URL=http://localhost:3000/api
```

3. Раскомментируйте API вызовы в:
   - `src/context/AuthProvider.jsx` (методы register и login)
   - Добавьте `import { authAPI } from '../services/api';`

4. Замените временную реализацию на:
```javascript
const data = await authAPI.register(username, email, password);
const { user: userData, token } = data;
```

## Структура файлов

```
src/
├── context/
│   ├── authContext.js     # React Context (только createContext)
│   ├── AuthProvider.jsx   # Provider с логикой аутентификации
│   └── useAuth.js         # Хук для использования в компонентах
├── services/
│   └── api.js             # API методы
├── components/
│   ├── Login.jsx          # Форма входа
│   └── Register.jsx       # Форма регистрации
└── App.jsx                # Главный компонент с AuthProvider
```

## Использование в компонентах

```javascript
import { useAuth } from '../context/useAuth';

function MyComponent() {
  const { user, login, logout, isAuthenticated } = useAuth();
  
  // user - объект пользователя или null
  // isAuthenticated - булево значение
  // login(email, password) - функция для входа
  // logout() - функция для выхода
  
  return (
    <div>
      {isAuthenticated ? (
        <p>Привет, {user.username}!</p>
      ) : (
        <p>Вы не авторизованы</p>
      )}
    </div>
  );
}
```

## Что нужно на бэкенде

См. файл `BACKEND_API.md` для полной документации.

Минимально необходимые endpoints:
- POST `/api/auth/register` - регистрация
- POST `/api/auth/login` - вход
- GET `/api/auth/verify` - проверка токена (опционально)

Формат ответа:
```json
{
  "success": true,
  "data": {
    "user": { "id": 1, "username": "user", "email": "user@example.com" },
    "token": "jwt_token_here"
  }
}
```

## Безопасность

⚠️ **Важно для продакшена:**
1. Используйте HTTPS
2. Храните секретные ключи в .env (не коммитьте!)
3. Настройте CORS на бэкенде
4. Используйте HTTP-only cookies для токенов (рекомендуется)
5. Добавьте rate limiting для auth endpoints

## Следующие шаги

1. ✅ Создать бэкенд API (Node.js/Express рекомендуется)
2. ✅ Настроить базу данных (PostgreSQL/MongoDB)
3. ✅ Подключить frontend к API
4. ⏳ Добавить refresh tokens
5. ⏳ Добавить "Forgot Password"
6. ⏳ Добавить OAuth (Google, GitHub)

# Требования к Backend для SphereTimer

## Общая информация

**Проект:** SphereTimer - веб-приложение для отслеживания времени задач  
**Frontend:** React 19.2 + Vite 5.4  
**Хранилище данных:** Временно LocalStorage, требуется замена на Backend API  
**Формат данных:** JSON  
**Аутентификация:** JWT токены

---

## 1. Конфигурация

### Переменные окружения
Backend URL настраивается через `.env`:
```env
VITE_API_URL=http://localhost:3000/api
```

### CORS
Необходимо разрешить CORS запросы с фронтенд-домена.

### Заголовки
Все защищенные endpoints требуют:
```
Authorization: Bearer <JWT_TOKEN>
```

---

## 2. Формат ответов

### Успешный ответ
```json
{
  "success": true,
  "data": { ... },
  "message": "Описание операции"
}
```

### Ответ с ошибкой
```json
{
  "success": false,
  "error": "Описание ошибки"
}
```

### HTTP статус-коды
- `200` - Успешная операция
- `201` - Ресурс создан
- `400` - Некорректные данные
- `401` - Не авторизован
- `403` - Доступ запрещен
- `404` - Ресурс не найден
- `500` - Ошибка сервера

---

## 3. Аутентификация

### POST `/auth/register`
**Описание:** Регистрация нового пользователя

**Запрос:**
```json
{
  "username": "string (3-50 символов)",
  "email": "string (валидный email)",
  "password": "string (минимум 6 символов)"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "username": "string",
      "email": "string",
      "createdAt": "ISO 8601 datetime"
    },
    "token": "string (JWT)"
  },
  "message": "Регистрация успешна"
}
```

**Возможные ошибки:**
- `400` - Email уже используется
- `400` - Некорректные данные (короткий пароль, невалидный email)

---

### POST `/auth/login`
**Описание:** Вход в систему

**Запрос:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "username": "string",
      "email": "string"
    },
    "token": "string (JWT)"
  },
  "message": "Вход выполнен"
}
```

**Возможные ошибки:**
- `401` - Неверный email или пароль

---

### POST `/auth/logout`
**Описание:** Выход из системы (опционально - инвалидация токена)

**Заголовки:** `Authorization: Bearer <token>`

**Ответ (200):**
```json
{
  "success": true,
  "message": "Выход выполнен"
}
```

---

### GET `/auth/verify`
**Описание:** Проверка валидности токена

**Заголовки:** `Authorization: Bearer <token>`

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "number",
      "username": "string",
      "email": "string"
    }
  }
}
```

**Возможные ошибки:**
- `401` - Токен невалиден или истек

---

## 4. Управление задачами

### GET `/tasks`
**Описание:** Получить все задачи пользователя

**Заголовки:** `Authorization: Bearer <token>`

**Ответ (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "number",
      "name": "string",
      "color": "string (hex цвет, например #FFD700)",
      "totalTime": "number (миллисекунды)",
      "isActive": "boolean",
      "startTime": "number | null (timestamp)",
      "order": "number",
      "history": [
        {
          "id": "number",
          "date": "string (YYYY-MM-DD)",
          "time": "number (миллисекунды)",
          "sessions": "number"
        }
      ],
      "createdAt": "ISO 8601 datetime",
      "updatedAt": "ISO 8601 datetime"
    }
  ]
}
```

---

### POST `/tasks`
**Описание:** Создать новую задачу

**Заголовки:** `Authorization: Bearer <token>`

**Запрос:**
```json
{
  "name": "string (1-100 символов)",
  "color": "string (hex цвет, например #FFD700)"
}
```

**Ответ (201):**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "name": "string",
    "color": "string",
    "totalTime": 0,
    "isActive": false,
    "startTime": null,
    "order": "number",
    "history": [],
    "createdAt": "ISO 8601 datetime",
    "updatedAt": "ISO 8601 datetime"
  },
  "message": "Задача создана"
}
```

---

### PUT `/tasks/:id`
**Описание:** Обновить задачу

**Заголовки:** `Authorization: Bearer <token>`

**Параметры URL:** `id` - ID задачи

**Запрос:**
```json
{
  "name": "string (опционально)",
  "color": "string (опционально)",
  "order": "number (опционально)"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "name": "string",
    "color": "string",
    "totalTime": "number",
    "isActive": "boolean",
    "startTime": "number | null",
    "order": "number",
    "history": [...],
    "updatedAt": "ISO 8601 datetime"
  },
  "message": "Задача обновлена"
}
```

**Возможные ошибки:**
- `404` - Задача не найдена
- `403` - Задача принадлежит другому пользователю

---

### DELETE `/tasks/:id`
**Описание:** Удалить задачу

**Заголовки:** `Authorization: Bearer <token>`

**Параметры URL:** `id` - ID задачи

**Ответ (200):**
```json
{
  "success": true,
  "message": "Задача удалена"
}
```

**Возможные ошибки:**
- `404` - Задача не найдена
- `403` - Задача принадлежит другому пользователю

---

### POST `/tasks/:id/start`
**Описание:** Запустить таймер задачи

**Заголовки:** `Authorization: Bearer <token>`

**Параметры URL:** `id` - ID задачи

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "isActive": true,
    "startTime": "number (timestamp в миллисекундах)"
  },
  "message": "Таймер запущен"
}
```

**Логика:**
- Если у пользователя уже есть активная задача - остановить её автоматически
- Установить `isActive = true`
- Установить `startTime = Date.now()`

---

### POST `/tasks/:id/stop`
**Описание:** Остановить таймер задачи

**Заголовки:** `Authorization: Bearer <token>`

**Параметры URL:** `id` - ID задачи

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "isActive": false,
    "startTime": null,
    "totalTime": "number",
    "timeAdded": "number (миллисекунды добавленного времени)",
    "history": [...]
  },
  "message": "Таймер остановлен"
}
```

**Логика:**
1. Вычислить прошедшее время: `elapsed = Date.now() - startTime`
2. Добавить к `totalTime`
3. Установить `isActive = false`, `startTime = null`
4. Обновить или создать запись в `history` для текущей даты:
   - `date` = текущая дата в формате YYYY-MM-DD
   - `time` += elapsed
   - `sessions` += 1

---

### GET `/tasks/stats`
**Описание:** Получить статистику по задачам

**Заголовки:** `Authorization: Bearer <token>`

**Query параметры (опционально):**
- `taskId` - ID конкретной задачи
- `startDate` - начальная дата (YYYY-MM-DD)
- `endDate` - конечная дата (YYYY-MM-DD)

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "totalTime": "number (миллисекунды)",
    "totalSessions": "number",
    "tasksCount": "number",
    "activeTasks": "number",
    "dailyStats": [
      {
        "date": "string (YYYY-MM-DD)",
        "time": "number",
        "sessions": "number"
      }
    ]
  }
}
```

---

## 5. Профиль пользователя

### GET `/user/profile`
**Описание:** Получить профиль пользователя

**Заголовки:** `Authorization: Bearer <token>`

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "username": "string",
    "email": "string",
    "createdAt": "ISO 8601 datetime",
    "tasksCount": "number",
    "totalTimeTracked": "number (миллисекунды)"
  }
}
```

---

### PUT `/user/profile`
**Описание:** Обновить профиль

**Заголовки:** `Authorization: Bearer <token>`

**Запрос:**
```json
{
  "username": "string (опционально)",
  "email": "string (опционально)"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "data": {
    "id": "number",
    "username": "string",
    "email": "string",
    "updatedAt": "ISO 8601 datetime"
  },
  "message": "Профиль обновлен"
}
```

---

### PUT `/user/password`
**Описание:** Изменить пароль

**Заголовки:** `Authorization: Bearer <token>`

**Запрос:**
```json
{
  "currentPassword": "string",
  "newPassword": "string (минимум 6 символов)"
}
```

**Ответ (200):**
```json
{
  "success": true,
  "message": "Пароль изменен"
}
```

**Возможные ошибки:**
- `400` - Текущий пароль неверен
- `400` - Новый пароль слишком короткий

---

## 6. Структура базы данных (рекомендации)

### PostgreSQL Schema

#### Таблица `users`
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
```

#### Таблица `tasks`
```sql
CREATE TABLE tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(7) NOT NULL,
  total_time BIGINT DEFAULT 0,
  is_active BOOLEAN DEFAULT FALSE,
  start_time BIGINT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_tasks_user_id ON tasks(user_id);
CREATE INDEX idx_tasks_is_active ON tasks(is_active);
```

#### Таблица `task_history`
```sql
CREATE TABLE task_history (
  id SERIAL PRIMARY KEY,
  task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time BIGINT NOT NULL,
  sessions INTEGER DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_task_history_task_id ON task_history(task_id);
CREATE INDEX idx_task_history_date ON task_history(date);
CREATE UNIQUE INDEX idx_task_history_unique ON task_history(task_id, date);
```

### MongoDB Schema (альтернатива)

```javascript
// User Schema
{
  _id: ObjectId,
  username: String (unique),
  email: String (unique),
  passwordHash: String,
  createdAt: Date,
  updatedAt: Date
}

// Task Schema
{
  _id: ObjectId,
  userId: ObjectId (ref: User),
  name: String,
  color: String,
  totalTime: Number,
  isActive: Boolean,
  startTime: Number,
  order: Number,
  history: [
    {
      date: String (YYYY-MM-DD),
      time: Number,
      sessions: Number
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

---

## 7. Примеры кода для Backend

### Authentication Middleware (Express.js)

```javascript
const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.userId = decoded.userId;
    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
};

module.exports = authMiddleware;
```

### CORS Configuration

```javascript
const cors = require('cors');

const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.ALLOWED_ORIGINS.split(',');
    
    // Разрешаем запросы без origin (mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
```

### Rate Limiting

```javascript
const rateLimit = require('express-rate-limit');

// Для auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 минут
  max: 5, // 5 попыток
  message: {
    success: false,
    error: 'Too many attempts, please try again later'
  }
});

// Для остальных endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: {
    success: false,
    error: 'Too many requests'
  }
});

app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);
app.use('/api/', apiLimiter);
```

### Password Hashing

```javascript
const bcrypt = require('bcrypt');

// При регистрации
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// При входе
const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};
```

### Express Server Structure

```javascript
// server.js
const express = require('express');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');
const tasksRoutes = require('./routes/tasks');
const userRoutes = require('./routes/user');

const app = express();

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/user', userRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
```

---

## 8. Переменные окружения

Создайте файл `.env` в корне backend проекта:

```env
# Server
PORT=3000
NODE_ENV=development

# Database (PostgreSQL)
DB_HOST=localhost
DB_PORT=5432
DB_NAME=sphere_timer
DB_USER=postgres
DB_PASSWORD=your_password

# Database (MongoDB альтернатива)
MONGODB_URI=mongodb://localhost:27017/sphere_timer

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# CORS
ALLOWED_ORIGINS=http://localhost:5173,http://localhost:3000

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Важно:** Никогда не коммитьте `.env` в git! Добавьте в `.gitignore`:
```
.env
.env.local
.env.production
```

---

## 9. Структура проекта

Рекомендуемая структура для Express.js backend:

```
backend/
├── src/
│   ├── config/
│   │   ├── database.js         # Подключение к БД
│   │   └── env.js              # Валидация переменных окружения
│   ├── middleware/
│   │   ├── auth.js             # JWT аутентификация
│   │   ├── errorHandler.js    # Обработка ошибок
│   │   └── validation.js       # Валидация входных данных
│   ├── routes/
│   │   ├── auth.js             # Роуты аутентификации
│   │   ├── tasks.js            # Роуты задач
│   │   └── user.js             # Роуты пользователя
│   ├── controllers/
│   │   ├── authController.js   # Логика аутентификации
│   │   ├── tasksController.js  # Логика задач
│   │   └── userController.js   # Логика пользователя
│   ├── models/
│   │   ├── User.js             # Модель пользователя
│   │   ├── Task.js             # Модель задачи
│   │   └── TaskHistory.js      # Модель истории
│   ├── utils/
│   │   ├── jwt.js              # Утилиты JWT
│   │   └── validators.js       # Валидаторы
│   └── server.js               # Точка входа
├── tests/
│   ├── auth.test.js
│   ├── tasks.test.js
│   └── user.test.js
├── .env.example                # Пример переменных окружения
├── .gitignore
├── package.json
└── README.md
```

---

## 10. Безопасность

### Обязательные меры:

1. **Хеширование паролей**
   ```javascript
   const bcrypt = require('bcrypt');
   const SALT_ROUNDS = 10;
   const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
   ```

2. **Защита от SQL Injection**
   - Используйте prepared statements
   - Валидируйте все входные данные
   - Используйте ORM (Sequelize, TypeORM) или query builders (Knex.js)

3. **JWT Tokens**
   - Храните secret в переменных окружения
   - Устанавливайте разумное время истечения (7 дней)
   - Не храните чувствительные данные в payload

4. **Rate Limiting**
   - Ограничивайте количество запросов к auth endpoints
   - Используйте redis для distributed rate limiting

5. **HTTPS**
   - В production используйте только HTTPS
   - Используйте Helmet.js для дополнительной безопасности

6. **Валидация**
   ```javascript
   const { body, validationResult } = require('express-validator');
   
   app.post('/api/auth/register',
     body('email').isEmail(),
     body('password').isLength({ min: 6 }),
     body('username').isLength({ min: 3, max: 50 }),
     async (req, res) => {
       const errors = validationResult(req);
       if (!errors.isEmpty()) {
         return res.status(400).json({
           success: false,
           errors: errors.array()
         });
       }
       // ... остальная логика
     }
   );
   ```

---

## 11. Deployment (Развертывание)

### Рекомендуемые платформы:

**Backend:**
- [Railway](https://railway.app/) - $5/месяц, простой деплой
- [Render](https://render.com/) - Бесплатный tier доступен
- [Fly.io](https://fly.io/) - Бесплатный tier, глобальная CDN
- [Heroku](https://heroku.com/) - $7/месяц после бесплатного периода
- [DigitalOcean App Platform](https://www.digitalocean.com/products/app-platform) - От $5/месяц

**Database:**
- [Supabase](https://supabase.com/) - PostgreSQL, бесплатный tier
- [Railway](https://railway.app/) - PostgreSQL/MySQL/Redis
- [MongoDB Atlas](https://www.mongodb.com/atlas) - Бесплатный tier 512MB
- [AWS RDS](https://aws.amazon.com/rds/) - От $15/месяц
- [Neon](https://neon.tech/) - PostgreSQL serverless, бесплатный tier

**Frontend:**
- [Vercel](https://vercel.com/) - Оптимально для React, бесплатный tier
- [Netlify](https://netlify.com/) - Бесплатный tier
- [GitHub Pages](https://pages.github.com/) - Бесплатно

### Environment Variables на Production:

Установите переменные окружения через dashboard платформы:
```env
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DATABASE_URL=<your-database-url>
ALLOWED_ORIGINS=https://your-frontend-domain.com
```

---

## 12. Тестирование

### Создайте тесты для API:

```javascript
// tests/auth.test.js
const request = require('supertest');
const app = require('../src/server');

describe('Authentication', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });
});
```

### Postman Collection

Создайте Postman collection для тестирования всех endpoints. Экспортируйте и сохраните в репозитории:
```
backend/
└── postman/
    └── SphereTimer_API.postman_collection.json
```

---

## 13. Миграция с LocalStorage

### Правила работы с таймером
1. **Одновременно активна только одна задача** - при запуске новой автоматически останавливать предыдущую
2. **История сохраняется по дням** - один день = одна запись в history с накопительным временем и количеством сессий
3. **Точность таймера** - фронтенд обновляет каждые 100мс, но отправляет финальное время при остановке
4. **Восстановление после перезагрузки** - при загрузке страницы продолжать активный таймер (вычислять elapsed = Date.now() - startTime)

### Валидация
- **username:** 3-50 символов, буквы, цифры, подчеркивание
- **email:** валидный email формат
- **password:** минимум 6 символов
- **task name:** 1-100 символов
- **color:** hex формат (#000000 - #FFFFFF)

### Безопасность
- Хешировать пароли (bcrypt, scrypt)
- JWT токены с истечением (рекомендуется 7 дней)
- Валидация всех входящих данных
- Защита от SQL инъекций
- Rate limiting для auth endpoints

---

## 8. Бизнес-логика

### Запуск/Остановка задачи

**Важно:** В один момент может быть активна только ОДНА задача.

Алгоритм:
1. При запуске задачи (PUT /api/tasks/:id/start):
   - Проверить есть ли уже активная задача у пользователя
   - Если есть - остановить её (обновить `total_time`, `is_active = false`)
   - Запустить новую задачу (`is_active = true`, `start_time = Date.now()`)

2. При остановке задачи (PUT /api/tasks/:id/stop):
   - Вычислить прошедшее время: `elapsed = Date.now() - start_time`
   - Обновить `total_time += elapsed`
   - Обновить историю: добавить elapsed к записи за сегодня
   - Установить `is_active = false`, `start_time = null`

### История задач

**Важно:** История хранится за каждый день отдельно.

Структура в БД:
```javascript
{
  task_id: 123,
  date: '2024-01-15',
  time: 7200000, // миллисекунды
  sessions: 5 // количество запусков
}
```

При обновлении истории:
1. Найти запись для task_id + сегодняшняя дата
2. Если существует: увеличить time и sessions
3. Если нет: создать новую запись

### Удаление задачи

При удалении задачи:
1. Если задача активна - остановить её
2. Удалить все записи истории (CASCADE в SQL)
3. Удалить саму задачу

### Порядок задач

Используйте поле `order_index` для сортировки:
- При создании: `order_index = MAX(order_index) + 1`
- При изменении порядка: обновить значения для всех затронутых задач

---

## 9. Дополнительные возможности (опционально)

### WebSocket для синхронизации
Для real-time синхронизации активных таймеров между устройствами:
```
WS /ws/tasks
```

**События:**
- `task:started` - таймер запущен
- `task:stopped` - таймер остановлен
- `task:updated` - задача обновлена
- `task:deleted` - задача удалена

### Экспорт данных
```
GET /export/tasks?format=json|csv
```

### Статистика за период
```
GET /stats/period?start=YYYY-MM-DD&end=YYYY-MM-DD
```

---

## 10. Тестирование

Предоставьте тестовый аккаунт:
```
Email: test@gmail.com
Password: 123456
```

Или документируйте процесс создания тестового окружения.

### Postman Collection

Создайте Postman collection для тестирования всех endpoints. Экспортируйте и сохраните в репозитории:
```
backend/
└── postman/
    └── SphereTimer_API.postman_collection.json
```

### Unit Tests

```javascript
// tests/auth.test.js
const request = require('supertest');
const app = require('../src/server');

describe('Authentication', () => {
  it('should register a new user', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });
    
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
  });
  
  it('should not register user with existing email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser2',
        email: 'test@example.com', // уже существует
        password: 'password123'
      });
    
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
```

---

## 11. Миграция с LocalStorage

При первом входе после подключения backend:
1. Frontend читает данные из LocalStorage через утилиты (`loadTasks()` из `/src/utils/storageUtils.js`)
2. Отправляет их на backend через batch import endpoint
3. Очищает LocalStorage после успешного импорта

**Структура хранения на frontend:**
- Ключи определены в `/src/utils/storageUtils.js` через константы `STORAGE_KEYS`
- Задачи хранятся как: `tasks_${username}`
- Токен: `authToken`
- Данные пользователя: `userData`

**Endpoint для миграции (опционально):**
```
POST /tasks/import

Body:
{
  "tasks": [массив задач из LocalStorage]
}
```

**Примечание:** Frontend использует централизованные утилиты для работы с localStorage:
- `saveTasks(username, tasks)` - сохранение задач
- `loadTasks(username)` - загрузка задач
- Все операции с автоматической обработкой ошибок и сериализацией

---

## Контакты для вопросов

При возникновении вопросов по интеграции обращайтесь к frontend-разработчику.

**Frontend репозиторий:** `/Users/alexandra/Projects/Sphere Timer/task-timer-app`  
**API клиент:** `/src/services/api.js` - содержит все методы для интеграции  
**Утилиты хранения:** `/src/utils/storageUtils.js` - работа с localStorage  
**Утилиты времени:** `/src/utils/timeUtils.js` - форматирование времени  
**Документация оптимизаций:** `/OPTIMIZATIONS.md` - детали реализации

# portfolio-showcase

Обычный проект-портфолио на Django, который я пилил для демонстрации разных штук — тут и REST API, и вебсокеты, и Celery, и чистый JS без фреймворков.

## Что внутри

Стек: Python 3.12, Django 5, DRF, Channels, Celery, Postgres 16, Redis 7. На фронте семантическая вёрстка и ванильный JavaScript (ES6 модули), без React/Vue.

Структура примерно такая:
- `config/` — настройки Django, asgi, celery
- `apps/core/` — кастомный User (UUID, логин через email), абстрактная модель с timestamps
- `apps/showcase/` — основные фичи (таски, медиа, чат, вебсокеты)
- `apps/api/` — DRF viewset'ы, сериалайзеры, кастомный рендерер, пагинация
- `static/js/` — модульный JS (api-обёртка, toast, modal, модули страниц)
- `templates/` — django-шаблоны

## Что умеет

Пять страниц-модулей:

1. **Dashboard** — приветствие с печатающейся анимацией, статистика из БД, рисованный через Canvas график по приоритетам задач, системные метрики (CPU/память/диск)
2. **Data Grid** — CRUD-таблица с inline-редактированием (двойной клик по строке), drag-and-drop сортировкой (сохраняет порядок на бэкенде), поиском и фильтрами. Кнопка экспорта в CSV через Celery-таску
3. **Real-Time Terminal** — чат на WebSockets с авто-реконнектом. Сервер раз в 5 секунд пушит статус (CPU/память). Терминальный интерфейс с историей сообщений
4. **Media Upload** — drag-and-drop зона загрузки изображений с прогресс-баром. На бэке проверка по magic bytes, Pillow создаёт WebP-превьюшки
5. **Security Playground** — три теста: XSS-санитизация через bleach, rate-limit кнопка (при 429 показывается кулдаун-таймер), просмотр security-заголовков

## Запуск

1. Копируем `.env.example` в `.env` и подставляем свои значения (особенно `SECRET_KEY`)
2. `docker compose up`
3. Открываем `http://localhost:8000`

Если вперые, то контейнер сам накатит миграции, соберёт статику и засеет тестовые данные (три юзера, 30 задач, 10 сообщений в чате).

Пароль для всех тестовых юзеров: `Demo@Password123!`

Если надо локально без докера:
- ставим PostgreSQL и Redis
- `pip install -r requirements.txt`
- `python manage.py migrate`
- `python manage.py seed_data`
- `daphne -b 0.0.0.0 -p 8000 config.asgi:application`

## Безопасность

Bleach на всём пользовательском вводе, CSP через django-csp, CORS только с указанных origin, X-Frame-Options DENY, rate-limiting через Redis, кастомный валидатор паролей, проверка файлов по magic numbers, UUID для всех первичных ключей.

## Фронтенд

Spa-подобная навигация без перезагрузки (Fetch + History API), но если JS отключен — обычные django-переходы работают. Тёмная тема по умолчанию, светлая сохраняется в localStorage. Все DOM-манипуляции через textContent (не innerHTML для пользовательских данных).<img width="1862" height="889" alt="изображение" src="https://github.com/user-attachments/assets/60d0cf86-dc20-4f88-9976-0dd113b6078d" />
<img width="1861" height="904" alt="изображение" src="https://github.com/user-attachments/assets/75b2272a-3b64-43a5-8e2f-db43b4603f40" /><img width="1842" height="660" alt="изображение" src="https://github.com/user-attachments/assets/e69cc300-b29d-4052-a707-042db280e5d7" /><img width="1867" height="901" alt="изображение" src="https://github.com/user-attachments/assets/01117bd7-982f-4ae2-b1b3-ab9e2c26219e" /><img width="1866" height="914" alt="изображение" src="https://github.com/user-attachments/assets/733c4976-6b6c-4ed8-9b5d-6cf3430e3afb" />






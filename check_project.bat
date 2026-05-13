@echo off
chcp 65001 >nul
title portfolio-showcase checker

echo.
echo ============================================
echo   portfolio-showcase — проверка проекта
echo ============================================
echo.

WHERE docker >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Docker не найден в PATH
    echo     Установи Docker Desktop: https://www.docker.com/products/docker-desktop
    echo.
    pause
    exit /b 1
)

WHERE python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Python не найден в PATH
    echo.
    pause
    exit /b 1
)

echo [1] Проверка файлов проекта...
echo.

set FILES_OK=1

if not exist "Dockerfile" (
    echo     [X] Dockerfile — отсутствует
    set FILES_OK=0
) else (
    echo     [OK] Dockerfile
)

if not exist "docker-compose.yml" (
    echo     [X] docker-compose.yml — отсутствует
    set FILES_OK=0
) else (
    echo     [OK] docker-compose.yml
)

if not exist "manage.py" (
    echo     [X] manage.py — отсутствует
    set FILES_OK=0
) else (
    echo     [OK] manage.py
)

if not exist "requirements.txt" (
    echo     [X] requirements.txt — отсутствует
    set FILES_OK=0
) else (
    echo     [OK] requirements.txt
)

if not exist ".env" (
    echo     [X] .env — отсутствует (скопируй .env.example в .env)
    echo         cp .env.example .env
    set FILES_OK=0
) else (
    echo     [OK] .env
)

if not exist "static\css\main.css" (
    echo     [X] static/css/main.css — отсутствует
    set FILES_OK=0
) else (
    echo     [OK] static/css/main.css
)

if not exist "static\js\app.js" (
    echo     [X] static/js/app.js — отсутствует
    set FILES_OK=0
) else (
    echo     [OK] static/js/app.js
)

if not exist "config\settings.py" (
    echo     [X] config/settings.py — отсутствует
    set FILES_OK=0
) else (
    echo     [OK] config/settings.py
)

echo.

if %FILES_OK% NEQ 1 (
    echo [!] Часть файлов отсутствует, проект запустить не получится
    echo.
    pause
    exit /b 1
)

echo [2] Проверка Python-зависимостей...
echo.

python -c "import django" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo     [!] Django не установлен, ставлю зависимости...
    pip install -r requirements.txt
    if %ERRORLEVEL% NEQ 0 (
        echo     [X] Не удалось установить зависимости
        pause
        exit /b 1
    )
) else (
    echo     [OK] Django установлен
)

python -c "import channels" >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo     [!] Channels не установлен, ставлю зависимости...
    pip install -r requirements.txt >nul 2>nul
)

echo.

echo [3] Проверка синтаксиса Python-файлов...
echo.

python -m py_compile manage.py >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo     [X] manage.py — ошибка синтаксиса
) else (
    echo     [OK] manage.py
)

python -m py_compile config\settings.py >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo     [X] config/settings.py — ошибка синтаксиса
) else (
    echo     [OK] config/settings.py
)

python -m py_compile config\urls.py >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo     [X] config/urls.py — ошибка синтаксиса
) else (
    echo     [OK] config/urls.py
)

echo.

echo [4] Проверка Django-конфигурации...
echo.

python manage.py check 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [!] Django check вернул ошибки (возможно, нет подключения к БД)
    echo     Это нормально если Postgres/Redis не запущены локально
    echo     Попробуй запустить через Docker: docker compose up
) else (
    echo     [OK] Django check — ошибок нет
)

echo.

echo [5] Сводка по проекту...
echo.
echo     Бэкенд:  Python 3.12 / Django 5.x / DRF / Channels / Celery
echo     БД:      PostgreSQL 16 / Redis 7
echo     Фронт:   HTML5 / CSS3 / Vanilla JS ES6 Modules
echo     Запуск:  docker compose up
echo     Адрес:   http://localhost:8000
echo.
echo     Страницы:
echo       /              — Dashboard
echo       /dashboard/    — Dashboard
echo       /data-grid/    — Data Grid (CRUD, drag-and-drop)
echo       /realtime/     — WebSocket Terminal
echo       /media/        — File Upload
echo       /security/     — Security Playground
echo.
echo     API:
echo       /api/dashboard/stats/
echo       /api/tasks/
echo       /api/media/
echo       /api/security/headers/
echo       /api/security/rate-limit-test/
echo       /api/security/xss-test/
echo       /api/system/metrics/
echo.
echo     WS:
echo       ws://localhost:8000/ws/chat/general/
echo.
echo     Тестовые юзеры (пароль: Demo@Password123!):
echo       alice@portfolio.dev
echo       bob@portfolio.dev
echo       charlie@portfolio.dev
echo.
echo ============================================
echo   Готово. Жми любую клавишу для выхода.
echo ============================================
pause >nul

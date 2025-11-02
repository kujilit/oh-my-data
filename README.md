# Visual ETL Builder

Каркас проекта визуального ETL-конструктора. Пользователь собирает ETL-пайплайны из визуальных нод (источники, трансформации, приёмники), после чего бэкенд генерирует Python-скрипты/DAG для Apache Airflow.

## Структура проекта

```
etl_builder/
├── backend/            # FastAPI + SQLAlchemy + генератор кода
│   ├── main.py         # REST API
│   ├── codegen.py      # Логика генерации DAG из графа
│   ├── models.py       # SQLAlchemy-модели и подключение к БД
│   ├── templates/      # Jinja2-шаблоны генерации кода
│   └── generated/      # Локально сгенерированные DAG-и (если запускать без docker-compose)
├── frontend/           # React + TypeScript + React Flow
│   └── src/
│       ├── App.tsx     # Основной редактор пайплайна
│       └── components/ # UI-компоненты
├── generated/          # Общая папка, монтируемая в контейнеры для сгенерированных DAG-ов
├── templates/          # Место для пользовательских шаблонов (можно расширять)
├── docker-compose.yml  # Инфраструктура (frontend + backend + PostgreSQL + Airflow)
└── requirements.txt    # Python-зависимости (делегирует backend/requirements.txt)
```

## Запуск через Docker Compose

```bash
docker compose up --build
```

Сервисы:
- **Frontend** — http://localhost:3000 (React Flow редактор)
- **Backend** — http://localhost:8000 (FastAPI, Swagger на `/docs`)
- **PostgreSQL** — доступен на `localhost:5432`
- **Airflow** — http://localhost:8080 (запускается в режиме `standalone`, DAG-и читаются из `./generated/dags`)

## Разработка локально

1. Установите зависимости Python:
   ```bash
   python -m venv .venv
   source .venv/bin/activate
   pip install -r requirements.txt
   ```
2. Запустите backend:
   ```bash
   uvicorn backend.main:app --reload
   ```
3. Установите зависимости фронтенда и запустите dev-сервер:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Пример использования API

### Генерация DAG-а
```bash
curl -X POST http://localhost:8000/generate_dag \
  -H 'Content-Type: application/json' \
  -d '{
        "dag_name": "example_etl",
        "nodes": [
          {"id": "1", "type": "source", "name": "users", "config": {"query": "SELECT * FROM users"}},
          {"id": "2", "type": "transform", "name": "filter_active", "config": {"function": "filter(lambda x: x[\'active\'], data)"}},
          {"id": "3", "type": "sink", "name": "to_postgres", "config": {"table": "active_users"}}
        ],
        "edges": [
          {"from": "1", "to": "2"},
          {"from": "2", "to": "3"}
        ]
      }'
```

### Проверка здоровья сервиса
```bash
curl http://localhost:8000/health
```

## Пример сгенерированного DAG-а

После вызова `/generate_dag` файл появится в `generated/dags/<имя>.py`. В репозитории лежит пример `generated/dags/example_etl.py`.

```python
from airflow import DAG
from airflow.decorators import task
from datetime import datetime
from my_utils.db import db_query, db_insert

default_args = {"start_date": datetime(2025, 1, 1)}

with DAG("example_etl", schedule_interval=None, default_args=default_args, catchup=False) as dag:
    @task
    def extract_users():
        return db_query("SELECT * FROM users")

    @task
    def filter_active(data):
        return [x for x in data if x['active']]

    @task
    def load_to_postgres(data):
        db_insert("active_users", data)

    extract_users() >> filter_active() >> load_to_postgres()
```

## Дальнейшие шаги

- Добавить авторизацию и сохранение проектов пользователей.
- Поддержать расширяемые шаблоны генерации (Python-скрипты, SQL и т.д.).
- Реализовать предпросмотр кода перед генерацией.
- Интегрировать версионирование DAG-ов и деплой в Airflow.

# Flagsmith + ClickHouse A/B Demo

Локальный демо-проект на React + Vite для A/B теста CTA-кнопки.
Сейчас эксперимент сравнивает два CTA-текста:

- `Получить предложение`
- `Узнать вашу выгоду`

Теперь весь локальный контур собран в один `docker-compose.yml`:

- `postgres` для Flagsmith
- `flagsmith`
- `flagsmith-task-processor`
- `clickhouse`
- `analytics-service`
- `frontend`

## Что важно по базе Flagsmith

Единый compose не создает новую базу Flagsmith, а использует внешний Docker volume:

- `flagsmith_pgdata`

Это тот же volume, который подключен в
[docker-compose2.yml](/Users/waldo/Projects/feature-flags/flagsmith/docker-compose2.yml),
поэтому данные старого Flagsmith сохраняются.

## Запуск

Поднять весь стек:

```bash
yarn stack:up
```

Остановить:

```bash
yarn stack:down
```

Посмотреть логи:

```bash
yarn stack:logs
```

После старта доступны:

- frontend: `http://localhost:8888`
- analytics-service: `http://localhost:4000/health`
- flagsmith: `http://localhost:8000`
- clickhouse HTTP: `http://localhost:8123`

## Конфигурация по умолчанию

- `VITE_FLAGSMITH_ENVIRONMENT_ID=guNeZ39sAbYJxUFWuXNX5e`
- `VITE_FLAGSMITH_API_URL=/flagsmith/api/v1/`
- `VITE_FLAGSMITH_AB_TEST_FLAG_KEY=my_cool_feature`
- `VITE_ANALYTICS_API_URL=/analytics`
- `CLICKHOUSE_USER=analytics`
- `CLICKHOUSE_PASSWORD=analytics`

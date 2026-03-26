# Flagsmith + ClickHouse A/B Demo

Локальный демо-проект для A/B-эксперимента с CTA-кнопкой.

Сейчас эксперимент сравнивает 2 варианта текста:

- `green`: `Получить предложение`
- `red`: `Узнать вашу выгоду`

Вариант приходит из Flagsmith. Фолбэк для experiment flag убран: на первом рендере UI показывает состояние загрузки, а кнопка активируется только после реального ответа Flagsmith.

## Что внутри

- `frontend`: React + Vite приложение
- `flagsmith`: remote evaluation для experiment variant
- `analytics-service`: принимает события и отдаёт summary
- `clickhouse`: хранит события `seen` и `clicked`
- `postgres`: база Flagsmith
- `flagsmith-task-processor`: фоновые задачи Flagsmith

## Как работает demo

1. При загрузке frontend создаёт или читает identity из `localStorage`.
2. Frontend запрашивает variant из Flagsmith до первого React render.
3. После получения variant отправляется событие `ab_cta_seen`.
4. При клике по CTA отправляется `ab_cta_clicked`.
5. Summary-панель читает агрегаты из `analytics-service`, который считает CTR в ClickHouse.

Важно:

- identity хранится в `localStorage`, а не в cookies
- кнопка `Другой пользователь` генерирует новый identity и позволяет быстро переключать пользователя для demo
- analytics summary опрашивается раз в 15 секунд

## Быстрый старт

Требования:

- Docker / Docker Compose
- для локальной сборки вне Docker лучше использовать Node.js 22

Создать внешний volume для Flagsmith, если его ещё нет:

```bash
docker volume create flagsmith_pgdata
```

Поднять весь стек:

```bash
yarn stack:up
```

Остановить стек:

```bash
yarn stack:down
```

Посмотреть логи:

```bash
yarn stack:logs
```

## Доступные сервисы

После старта через `docker compose` доступны:

- frontend: `http://localhost:8888`
- analytics health: `http://localhost:4000/health`
- flagsmith: `http://localhost:8000`
- clickhouse HTTP: `http://localhost:8123`

## Локальная разработка frontend

Если нужен только frontend в dev-режиме:

```bash
yarn dev
```

По умолчанию Vite поднимается на `http://localhost:5173`.

Для этого режима frontend ожидает те же client env vars, что и Docker-frontend:

- `VITE_FLAGSMITH_ENVIRONMENT_ID=guNeZ39sAbYJxUFWuXNX5e`
- `VITE_FLAGSMITH_API_URL=/flagsmith/api/v1/`
- `VITE_FLAGSMITH_AB_TEST_FLAG_KEY=my_cool_feature`
- `VITE_ANALYTICS_API_URL=/analytics`

Пример лежит в [.env.example](/Users/waldo/Projects/feature-flags/flagsmith-ab/.env.example).

## Полезные команды

```bash
yarn lint
yarn build
yarn analytics:start
yarn analytics:dev
```

`yarn build` требует современный Node.js. Если локально стоит старый Node, проще собирать frontend через Docker.

## Сетевая схема

Docker-frontend отдаётся через nginx и проксирует:

- `/flagsmith/api/v1/` -> `flagsmith:8000`
- `/analytics/api/` -> `analytics-service:4000`

Поэтому внутри frontend используются относительные URL, а не прямые `localhost:8000` и `localhost:4000`.

## Troubleshooting

Если summary-панель показывает ошибку аналитики:

- проверьте `http://localhost:4000/health`
- посмотрите `docker compose logs --tail=100 analytics-service clickhouse frontend`

Если вариант эксперимента долго не приходит:

- проверьте доступность Flagsmith на `http://localhost:8000`
- убедитесь, что `VITE_FLAGSMITH_ENVIRONMENT_ID` указывает на существующее environment

Если кажется, что пользователь "не меняется":

- identity хранится в `localStorage`
- для смены пользователя используйте кнопку `Другой пользователь` или очистите `localStorage`

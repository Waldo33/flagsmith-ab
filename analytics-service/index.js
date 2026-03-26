import { randomUUID } from 'node:crypto'
import process from 'node:process'
import cors from 'cors'
import express from 'express'

const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/

function requireSafeIdentifier(value, label) {
  if (!IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }

  return value
}

const analyticsEnv = {
  allowedOrigin: process.env.ANALYTICS_ALLOWED_ORIGIN || 'http://localhost:5173',
  clickhouseDatabase: requireSafeIdentifier(
    process.env.CLICKHOUSE_DATABASE || 'ab_tests',
    'database',
  ),
  clickhousePassword: process.env.CLICKHOUSE_PASSWORD || 'analytics',
  clickhouseTable: requireSafeIdentifier(
    process.env.CLICKHOUSE_TABLE || 'cta_experiment_events',
    'table',
  ),
  clickhouseUrl: process.env.CLICKHOUSE_URL || 'http://127.0.0.1:8123',
  clickhouseUser: process.env.CLICKHOUSE_USER || 'analytics',
  port: Number(process.env.ANALYTICS_PORT || 4000),
  startupRetryDelayMs: Number(process.env.ANALYTICS_STARTUP_RETRY_DELAY_MS || 2_000),
  startupRetryLimit: Number(process.env.ANALYTICS_STARTUP_RETRY_LIMIT || 30),
}

function sleep(delayMs) {
  return new Promise((resolve) => {
    setTimeout(resolve, delayMs)
  })
}

function createAuthHeader() {
  const credentials = `${analyticsEnv.clickhouseUser}:${analyticsEnv.clickhousePassword}`
  return `Basic ${Buffer.from(credentials).toString('base64')}`
}

async function runClickHouseQuery(query, options = {}) {
  const url = new URL(analyticsEnv.clickhouseUrl)

  if (options.database) {
    url.searchParams.set('database', options.database)
  }

  url.searchParams.set('query', query)

  const response = await fetch(url, {
    body: options.body,
    headers: {
      Authorization: createAuthHeader(),
      'Content-Type': 'text/plain; charset=utf-8',
    },
    method: 'POST',
  })

  if (!response.ok) {
    throw new Error(
      `ClickHouse returned ${response.status}: ${await response.text()}`,
    )
  }

  return response.text()
}

async function createAnalyticsStorage() {
  await runClickHouseQuery(
    `CREATE DATABASE IF NOT EXISTS ${analyticsEnv.clickhouseDatabase}`,
  )

  await runClickHouseQuery(
    `
      CREATE TABLE IF NOT EXISTS ${analyticsEnv.clickhouseTable} (
        event_id UUID,
        event_name LowCardinality(String),
        experiment String,
        variant LowCardinality(String),
        variant_source LowCardinality(String),
        distinct_id String,
        page_url String,
        referrer String,
        user_agent String,
        created_at_iso String,
        created_at_ms UInt64,
        properties_json String
      )
      ENGINE = MergeTree
      ORDER BY (experiment, event_name, variant, created_at_ms, distinct_id)
    `,
    {
      database: analyticsEnv.clickhouseDatabase,
    },
  )
}

async function insertAnalyticsRecord(record) {
  await runClickHouseQuery(
    `INSERT INTO ${analyticsEnv.clickhouseTable} FORMAT JSONEachRow`,
    {
      body: `${JSON.stringify(record)}\n`,
      database: analyticsEnv.clickhouseDatabase,
    },
  )
}

async function fetchExperimentSummary(experiment) {
  const responseText = await runClickHouseQuery(
    `
      SELECT
        variant,
        uniqExactIf(distinct_id, event_name = 'ab_cta_seen') AS unique_seen,
        uniqExactIf(distinct_id, event_name = 'ab_cta_clicked') AS unique_clicked,
        countIf(event_name = 'ab_cta_clicked') AS raw_clicked,
        round(if(unique_seen = 0, 0, (unique_clicked / unique_seen) * 100), 2) AS ctr
      FROM ${analyticsEnv.clickhouseTable}
      WHERE experiment = {experiment:String}
      GROUP BY variant
      ORDER BY variant ASC
      FORMAT JSONEachRow
    `.replace('{experiment:String}', `'${experiment.replace(/'/g, "\\'")}'`),
    {
      database: analyticsEnv.clickhouseDatabase,
    },
  )

  return responseText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line))
}

async function pingClickHouse() {
  const response = await fetch(`${analyticsEnv.clickhouseUrl}/ping`, {
    headers: {
      Authorization: createAuthHeader(),
    },
  })

  if (!response.ok) {
    throw new Error(`ClickHouse ping returned ${response.status}`)
  }

  return response.text()
}

async function waitForClickHouse() {
  let lastError = null

  for (let attempt = 1; attempt <= analyticsEnv.startupRetryLimit; attempt += 1) {
    try {
      await pingClickHouse()
      await createAnalyticsStorage()
      return
    } catch (error) {
      lastError = error

      console.warn(
        `ClickHouse is not ready yet (${attempt}/${analyticsEnv.startupRetryLimit})`,
      )
      console.warn(error)

      if (attempt < analyticsEnv.startupRetryLimit) {
        await sleep(analyticsEnv.startupRetryDelayMs)
      }
    }
  }

  throw lastError
}

function toTrimmedString(value) {
  return typeof value === 'string' ? value.trim() : ''
}

function normalizePayload(body) {
  if (!body || typeof body !== 'object') {
    return null
  }

  if (body.payload && typeof body.payload === 'object') {
    return {
      ...body.payload,
      eventName: body.payload.eventName || body.name,
      rawEvent: body,
    }
  }

  return body
}

function toEventRecord(body, userAgent) {
  const normalizedBody = normalizePayload(body)

  if (!normalizedBody || typeof normalizedBody !== 'object') {
    return null
  }

  const eventName = toTrimmedString(normalizedBody.eventName)
  const experiment = toTrimmedString(normalizedBody.experiment)
  const variant = toTrimmedString(normalizedBody.variant)
  const variantSource = toTrimmedString(normalizedBody.variantSource)
  const distinctId = toTrimmedString(normalizedBody.distinctId)
  const pageUrl = toTrimmedString(normalizedBody.pageUrl)
  const referrer = toTrimmedString(normalizedBody.referrer)

  if (!eventName || !experiment || !variant || !variantSource || !distinctId) {
    return null
  }

  const now = new Date()

  return {
    created_at_iso: now.toISOString(),
    created_at_ms: Date.now(),
    distinct_id: distinctId,
    event_id: randomUUID(),
    event_name: eventName,
    experiment,
    page_url: pageUrl,
    properties_json: JSON.stringify(body),
    referrer,
    user_agent: userAgent,
    variant,
    variant_source: variantSource,
  }
}

async function startAnalyticsService() {
  await waitForClickHouse()

  const app = express()

  app.use(
    cors({
      origin: analyticsEnv.allowedOrigin,
    }),
  )
  app.use(express.json({ limit: '32kb' }))

  app.get('/health', async (_request, response) => {
    try {
      await pingClickHouse()

      response.json({
        analytics: 'ok',
        clickhouse: 'ok',
        database: analyticsEnv.clickhouseDatabase,
        table: analyticsEnv.clickhouseTable,
      })
    } catch (error) {
      response.status(500).json({
        analytics: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  })

  app.post('/api/events', async (request, response, next) => {
    try {
      const record = toEventRecord(request.body, request.get('user-agent') || '')

      if (!record) {
        response.status(400).json({
          error:
            'eventName, experiment, variant, variantSource и distinctId обязательны',
        })
        return
      }

      await insertAnalyticsRecord(record)

      response.status(202).json({ ok: true })
    } catch (error) {
      next(error)
    }
  })

  app.get('/api/experiments/:experiment/summary', async (request, response, next) => {
    try {
      const variants = await fetchExperimentSummary(request.params.experiment)

      response.json({
        experiment: request.params.experiment,
        generatedAt: new Date().toISOString(),
        variants,
      })
    } catch (error) {
      next(error)
    }
  })

  app.use((error, _request, response, _next) => {
    response.status(500).json({
      error: error instanceof Error ? error.message : 'Unexpected server error',
    })
  })

  app.listen(analyticsEnv.port, () => {
    console.log(
      `Analytics service listening on http://localhost:${analyticsEnv.port} and writing to ${analyticsEnv.clickhouseDatabase}.${analyticsEnv.clickhouseTable}`,
    )
  })
}

startAnalyticsService().catch((error) => {
  console.error('Failed to start analytics service')
  console.error(error)
  process.exit(1)
})

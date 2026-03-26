import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'

const environmentId =
  process.env.FLAGSMITH_ENVIRONMENT ||
  process.env.VITE_FLAGSMITH_ENVIRONMENT_ID ||
  'guNeZ39sAbYJxUFWuXNX5e'

const apiUrl =
  process.env.FLAGSMITH_API_URL ||
  process.env.VITE_FLAGSMITH_API_URL ||
  'http://localhost:8000/api/v1/'

const publicApiUrl =
  process.env.PUBLIC_FLAGSMITH_API_URL ||
  process.env.VITE_FLAGSMITH_API_URL ||
  '/flagsmith/api/v1/'

const outputFile = join(
  process.cwd(),
  'src/generated/flagsmithFallbackState.ts',
)

const tempDir = mkdtempSync(join(tmpdir(), 'flagsmith-fallback-'))
const tempJsonPath = join(tempDir, 'flagsmith-state.json')

const command = [
  '--yes',
  'flagsmith-cli',
  'get',
  environmentId,
  '--api',
  apiUrl,
  '--output',
  tempJsonPath,
]

const result = spawnSync('npx', command, {
  stdio: 'inherit',
})

if (result.status !== 0) {
  rmSync(tempDir, { force: true, recursive: true })
  process.exit(result.status ?? 1)
}

const rawJson = readFileSync(tempJsonPath, 'utf8')
const parsed = JSON.parse(rawJson)
parsed.api = publicApiUrl

const fileContents = `export const flagsmithFallbackState = ${JSON.stringify(
  parsed,
  null,
  2,
)} as const\n`

writeFileSync(outputFile, fileContents, 'utf8')
rmSync(tempDir, { force: true, recursive: true })

console.log(`Updated ${outputFile}`)

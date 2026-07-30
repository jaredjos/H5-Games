import { spawnSync } from 'node:child_process'
import process from 'node:process'

const script = 'scripts/build-premium-spell-vfx.py'
const configuredPython = process.env.NIGHTTRACE_PYTHON?.trim()
const candidates = [
  ...(configuredPython
    ? [{ command: configuredPython, args: [script] }]
    : []),
  ...(process.platform === 'win32'
    ? [
        { command: 'python.exe', args: [script] },
        { command: 'py.exe', args: ['-3', script] },
        { command: 'python3.exe', args: [script] },
      ]
    : [
        { command: 'python3', args: [script] },
        { command: 'python', args: [script] },
      ]),
]

for (const candidate of candidates) {
  const result = spawnSync(candidate.command, candidate.args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  })

  if (result.error?.code === 'ENOENT') continue
  if (result.error) throw result.error
  process.exit(result.status ?? 1)
}

console.error(
  'NIGHTTRACE VFX build requires Python 3 with Pillow. ' +
    'Install Python or set NIGHTTRACE_PYTHON to its executable path.',
)
process.exit(1)

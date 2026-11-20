import { build } from 'vite'
import { mkdir, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { gzipSync } from 'node:zlib'

const { output } = await build({
  base: '/',
  build: { write: false, assetsInlineLimit: Infinity, modulePreload: false },
})
const script = output.find(file => file.type === 'chunk' && file.isEntry)
const styles = output.find(file => file.fileName.endsWith('.css'))
let html = await readFile('index.html', 'utf8')
html = html.replace('</head>', () => '<style>' + styles.source + '</style></head>')
html = html.replace(/<script type="module" src="\/src\/main.jsx"><\/script>/, () =>
  '<script type="module">' + script.code.replace(/<\/script/gi, '<\\/script') + '</script>')

const folder = await mkdtemp(path.join(tmpdir(), 'relogio-export-'))
const archive = path.resolve('dist', 'relogio-lemos-windows.zip')
try {
  await mkdir('dist', { recursive: true })
  await writeFile(path.join(folder, 'Relogio Lemos.html'), html)
  const installer = [
    '@echo off',
    'setlocal',
    'set "RELOGIO_SOURCE=%~dp0Relogio Lemos.html"',
    'powershell.exe -NoProfile -Command "$ErrorActionPreference = \'Stop\'; $folder = Join-Path $env:LOCALAPPDATA \'Relogio Lemos\'; [void][IO.Directory]::CreateDirectory($folder); $app = Join-Path $folder \'Relogio Lemos.html\'; Copy-Item -LiteralPath $env:RELOGIO_SOURCE -Destination $app -Force; $shell = New-Object -ComObject WScript.Shell; $link = $shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath(\'DesktopDirectory\')) \'Relogio Lemos.lnk\')); $link.TargetPath = $app; $link.Save(); Start-Process -FilePath $app"',
    'if errorlevel 1 pause',
  ].join('\r\n')
  await writeFile(path.join(folder, 'Instalar.cmd'), installer)
  execFileSync('tar.exe', ['-caf', archive, '-C', folder, 'Instalar.cmd', 'Relogio Lemos.html'])
  console.log(archive)
  const payload = path.join(folder, 'app.gz')
  await writeFile(payload, gzipSync(html))
  const executable = path.resolve('dist', 'Instalar-Relogio-Lemos.exe')
  const compiler = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework', 'v4.0.30319', 'csc.exe')
  execFileSync(compiler, ['/nologo', '/target:winexe', '/optimize+', '/out:' + executable,
    '/resource:' + payload + ',app.gz', path.resolve('scripts/Installer.cs')], { stdio: 'inherit' })
  console.log(executable)
} finally {
  await rm(folder, { recursive: true, force: true })
}

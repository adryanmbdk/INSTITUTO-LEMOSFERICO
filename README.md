# Instituto Lemosférico

Relógio de dia, noite e clima para mesas de RPG. Cada seção tem duração, céu e clima configuráveis. As configurações ficam salvas no navegador.

## Desenvolvimento

Use Node.js 22.12 ou superior. Na pasta do projeto, execute `npm ci` e depois `npm run dev`.

## Distribuição

- `npm run build` gera o site estático em `dist/`.
- `npm run preview` abre a compilação para conferência local.
- No Windows, `npm run export:windows` gera o instalador e a versão portátil em `dist/`.

O código da interface, do relógio e da paisagem fica em `src/`. As gravações de chuva e trovão ficam em `src/audio/`, e os arquivos de exportação para Windows em `scripts/`.

# spedicija

Web aplikacija za spediciju i pracenje profita po kontejneru.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- ORM: Prisma

## Lokalno pokretanje

```bash
npm install
npm install --prefix backend
npm install --prefix frontend
npm run dev
```

Backend koristi `backend/.env`, koji nije dio git repozitorijuma.

## Testovi

```bash
npm test
npm run test:integration
npm run lint
npm run build
```

`npm test` provjerava placanja i KIF/KUF API sa simuliranom bazom.
`npm run test:integration` koristi lokalni PostgreSQL iz `backend/.env`.
Kreira zasebne QA spedicije i podatke, testira prijavu, prava pristupa,
firme, sifrarnike, pozicije, fakture, troskove, placanja i izvjestaje,
pa uklanja samo podatke kreirane tim pokretanjem. Dozvoljena je samo
lokalna baza; test se ne pokrece na produkcijskom serveru.

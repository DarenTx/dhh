# Dahl Heritage Homes

## Project Info

|              |                                                                                     |
| ------------ | ----------------------------------------------------------------------------------- |
| **Website**  | [dahlheritagehomes.com](https://dahlheritagehomes.com)                              |
| **GitHub**   | [github.com/DarenTx/dhh](https://github.com/DarenTx/dhh)                            |
| **Supabase** | [vmzmwdqnnnojzrjpdlnj](https://supabase.com/dashboard/project/vmzmwdqnnnojzrjpdlnj) |

## Description

Property Management Dashboard for Dahl Heritage Homes.

## Tech Stack

| Layer               | Technology                                                                              |
| ------------------- | --------------------------------------------------------------------------------------- |
| **Framework**       | [Angular 21](https://angular.dev) — standalone components, signals, `@for` control flow |
| **Styling**         | SCSS                                                                                    |
| **Routing**         | Angular Router                                                                          |
| **PWA**             | `@angular/pwa` — service worker (`ngsw`), web app manifest, app icons                   |
| **Hosting**         | [GitHub Pages](https://pages.github.com)                                                |
| **Backend**         | [Supabase](https://supabase.com) (Postgres + Auth + Storage)                            |
| **Unit Tests**      | Vitest + jsdom                                                                          |
| **E2E Tests**       | [Playwright](https://playwright.dev)                                                    |
| **Language**        | TypeScript ~5.9                                                                         |
| **Runtime**         | Node.js 22 / npm 10                                                                     |
| **Package Manager** | npm                                                                                     |

## Local Development

```bash
npm start          # Dev server → http://localhost:4200
npm test           # Unit tests (Vitest)
npm run test:e2e   # Playwright e2e tests (auto-starts dev server)
ng build           # Production build → dist/dhh
```

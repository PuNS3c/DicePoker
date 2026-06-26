# Dice Poker

Single-screen multiplayer poker dice built with React, TypeScript, and Vite for static hosting on GitHub Pages.

## Features

- Setup flow for 2 to 6 players with custom names and round count selection
- Randomized play order at game start
- Pure scoring engine for classic poker-dice hands
- Turn engine with first roll, up to 2 rerolls, and end-of-turn confirmation
- Live scoreboard, round context, turn feedback, and final results celebration
- GitHub Actions workflow that tests, builds, and deploys to GitHub Pages

## Local Development

Requirements:
- Node.js 20+
- npm 10+

Install dependencies:

```bash
npm install
```

Start the dev server:

```bash
npm run dev
```

Run tests:

```bash
npm test
```

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Testing Scope

The automated tests focus on the highest-risk game logic:

- scoring every supported poker-dice hand
- tie-break ordering within the same hand rank
- reroll limits and selected-die rerolls
- player and round advancement
- final winner calculation

## GitHub Pages Deployment

The app is configured for the repository base path `/DicePoker/` in `vite.config.ts`.

Deployment is handled by `.github/workflows/deploy.yml`:

1. install dependencies with `npm ci`
2. run `npm test`
3. run `npm run build`
4. upload `dist/`
5. deploy to GitHub Pages

Repository settings required:

1. Open GitHub repository settings.
2. Go to `Pages`.
3. Set the source to `GitHub Actions`.

## Project Structure

- `src/App.tsx`: setup, play, and results screen flow
- `src/game/types.ts`: shared domain types
- `src/game/scoring.ts`: pure poker-dice scoring logic
- `src/game/engine.ts`: pure game progression and winner calculation
- `src/game/*.test.ts`: Vitest coverage for game logic

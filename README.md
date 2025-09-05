# React + Vite

This project is built with React and Vite.

## Environment Variables

To enable Google Places autocomplete for the location field, add your API key to a `.env` file:

```
VITE_API_URL=http://localhost:3000/api
VITE_GOOGLE_API_KEY=your_key_here
```

## Scripts

- `npm run dev` – start the development server
- `npm run build` – build the application
- `npm run lint` – run ESLint checks
- `npm run deploy` – build and publish the site to GitHub Pages

## Deploying to GitHub Pages

This project can be hosted on GitHub Pages. Run the deploy script to build the site and push the generated files to the `gh-pages` branch:

```
npm run deploy
```

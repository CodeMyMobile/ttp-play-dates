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

## Authentication

Users must sign up or log in to view match data. Guests are prompted to authenticate before any matches are shown.

## API Examples

### Sign Up

```bash
curl --location 'http://localhost:3000/api/auth/signup' \
--header 'Content-Type: application/json' \
--data-raw '{
    "email": "Player5@gmail.com",
    "password": "0000",
    "user_type":2
}'
```

### Update Player Profile

```bash
curl --location 'http://localhost:3000/api/player/personal_details' \
--header 'Authorization: token x.x.x' \
--header 'Content-Type: application/json' \
--data '{
   "full_name":"pratik player",
   "phone":354435,
   "profile_picture":"asdaffdsadfsf",
   "date_of_birth":"1999-11-06",
   "usta_rating":5,
   "uta_rating":3
}'
```

## Deploying to GitHub Pages

This project can be hosted on GitHub Pages. Run the deploy script to build the site and push the generated files to the `gh-pages` branch:

```
npm run deploy
```

## Pull Request Previews

Every pull request automatically builds with GitHub Actions and publishes a preview to GitHub Pages. Open the pull request's **Deployments** section to launch the preview and verify the changes before merging. Preview links refresh after each push and are removed when the pull request is closed.

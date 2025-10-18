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

## Invite Players flow

The match details screen now includes an **Invite players** button for hosts. The feature opens a modal with multiple tabs that progressively enhance depending on browser capabilities:

- **Device** – Uses the Contact Picker API (`navigator.contacts.select`) when available. Contacts are only requested after the host explicitly taps the picker button and are discarded when the modal closes.
- **Share** – Uses the Web Share API if supported. It always exposes the existing _Copy invite link_ action and quick SMS/Email deep links as fallbacks.
- **Paste** – Accepts phone numbers or emails (one per line), validates each entry, and lets the host edit before sending.
- **Upload** – Parses CSV or VCF files client-side to bootstrap the contact list. Files are never uploaded to a server.

All flows build the same short invite message:

```
Join my tennis match!
When: {localDateTime}
Where: {location}
Level: {level}
Join: {inviteUrl}
```

### Browser support

- Contact Picker and Web Share tabs appear only when the corresponding API is detected.
- SMS and email fallbacks use standard `sms:` and `mailto:` URLs to work on desktop and mobile.
- The modal works over HTTPS and gracefully degrades to copy/paste if modern APIs are unavailable.

### Optional server hook

`src/features/invite/useContactInvites.ts` exports `sendServerInvite`. It is a no-op by default, but you can replace it with a thin adapter that posts invites to your backend if one exists.

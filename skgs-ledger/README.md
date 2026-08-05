# SKGS Ledger — MongoDB + PWA edition

This is your customer ledger app, upgraded so that:

- **Data is stored in MongoDB** instead of a local JSON file — accessible from any
  device, backed up centrally, safe if you clear your browser.
- **It's a full PWA** (installable app icon, works offline for viewing, has a
  proper app icon on your phone/desktop home screen).

The frontend (`public/index.html`) is unchanged in look and behavior — it still
has the same Add Company / Add Bill / Mark Paid / Export flows. The only real
change under the hood is *where* the data lives.

## Project layout

```
skgs-ledger/
├── server.js              # Express server + API
├── models/Ledger.js        # MongoDB schema + starter seed data
├── package.json
├── .env.example             # copy to .env and fill in your MongoDB URL
└── public/
    ├── index.html            # the app itself
    ├── manifest.webmanifest  # PWA manifest
    ├── service-worker.js     # offline caching
    └── icons/                 # app icons (192, 512, maskable, apple-touch)
```

## 1. Set up a free MongoDB database

1. Go to https://www.mongodb.com/cloud/atlas/register and create a free account.
2. Create a free **M0 cluster** (no credit card needed).
3. Under **Database Access**, create a database user with a username/password.
4. Under **Network Access**, add `0.0.0.0/0` (allow access from anywhere) — or
   restrict to your hosting provider's IP once you deploy.
5. Click **Connect → Drivers**, copy the connection string. It looks like:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
6. Add a database name to the end, e.g. `.../skgs_ledger?retryWrites=true&w=majority`.

## 2. Configure the server

```bash
cd skgs-ledger
cp .env.example .env
```

Edit `.env` and paste your connection string into `MONGODB_URI`.

If you don't have a MongoDB Atlas connection ready, the server can still run locally with a JSON fallback store in `data/ledger.json`. The app will be fully usable for development, but this local store is not a replacement for a shared production database.

## 3. Install & run locally

You'll need [Node.js](https://nodejs.org) 18+ installed.

```bash
npm install
npm start
```

Open **http://localhost:5000** — the app loads, connects to MongoDB, and you'll
see "Synced to MongoDB" in the sync bar. The first time it runs, it seeds the
database with the same starter data (Abhilash Chemicals) you already had.

Every add/edit/delete/mark-paid action now writes straight to MongoDB via
`GET /api/ledger` and `PUT /api/ledger`.

## 4. Deploy it so it's reachable from your phone

Any Node-friendly host works. Two easy free options:

**Render.com**
1. Push this folder to a GitHub repo.
2. On Render, "New → Web Service", connect the repo.
3. Build command: `npm install` — Start command: `npm start`.
4. Add an environment variable `MONGODB_URI` with your connection string.
5. Deploy — you'll get a URL like `https://skgs-ledger.onrender.com`.

**Railway.app** works almost identically — connect the repo, add the
`MONGODB_URI` variable, deploy.

Because the server serves both the API and the frontend from the same origin,
there's nothing else to configure — `API_URL` in `index.html` is already set
to the relative path `/api/ledger`.

## 5. Install it as an app (PWA)

Once it's deployed (PWA install prompts need HTTPS, so `localhost` testing
won't show the prompt on most phones):

- **Android (Chrome)**: open the site → menu (⋮) → "Install app" / "Add to
  Home screen".
- **iPhone (Safari)**: open the site → Share button → "Add to Home Screen".
- **Desktop (Chrome/Edge)**: an install icon (⊕) appears in the address bar,
  or use the "Install app" button that appears in the app's own sync bar.

The app will then open full-screen from a home-screen icon, no browser
address bar, and the ledger table/summary still works offline (data syncs
again once you're back online).

## Notes on the data model

Everything is stored as **one MongoDB document** (collection `ledgers`, key
`main`) containing `ownCompany` and an array of `companies`, each with its own
`entries` (bills). This mirrors the exact shape of your old `companies.json`,
so **Import JSON / Export JSON still work** — Export JSON now backs up
whatever is currently in MongoDB, and Import JSON overwrites MongoDB with
whatever file you choose.

If you later want per-user logins or multiple separate ledgers, the schema in
`models/Ledger.js` is the place to extend (e.g. add a `key` per user instead
of always using `'main'`).

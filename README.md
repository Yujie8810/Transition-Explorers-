# Career Commons

A career-support app for UTD students and recent graduates, built for **CS 4352 — Foundations of Human-Computer Interaction (DP4)** by Transition Explorers.

**[Open the live app](https://career-commons.expo.app)**

## Features

- **Explore:** search and filter workplace questions, read answers, and save advice.
- **Ask:** compose, review, and publish questions; manage your own questions from Profile.
- **People:** browse graduate profiles, find relevant experience, and request guidance.
- **Your Circle:** manage contacts, exchange guidance messages, and schedule check-ins with invitations and new-time proposals.
- **Profile and Saved:** update your profile, opt into the People directory, and revisit saved answers.

## Trying the app

Open the live app and create an account or log in. If email confirmation is requested, confirm your email before logging in. The interface is designed for a portrait mobile screen; a narrow browser window or mobile viewport works well for review.

Suggested walkthrough: **Explore → open a question → save an answer → Saved → reopen the discussion**. To try communication and scheduling, use two accounts and a real graduate listing in People. Graduate accounts can enable their listing through **Profile → Your People profile → Edit People profile → Appear in People → Save**.

The app includes fictional graduates, questions, and answers alongside live community content. Requests and check-ins involving fictional graduates are personal demos and are not delivered; fictional-answer saves stay on that device. Post a real question to try answer posting and follow-ups. Messages and invitations refresh while their screens are open; push notifications and external calendar integration are not included.

## Run locally

Requires Node.js with npm and access to the shared Supabase project configuration.

```sh
git clone https://github.com/Yujie8810/Transition-Explorers-.git
cd Transition-Explorers-
npm ci
cp .env.example .env.local
```

Set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local` using the team's shared project values, then start the app:

```sh
npm run web
```

For mobile testing with a compatible Expo Go version, run `npm start` and scan the QR code. Local development requires a running development server; the hosted website does not.

## Technology and checks

Built with React Native, Expo, Expo Router, TypeScript, Supabase, and DM Sans. Direct dependencies and version ranges are listed in [package.json](package.json).

```sh
npm run typecheck
npm test
```

The latest local checks passed TypeScript, all 82 automated tests, and the Expo web export.

## Team

Aalvee Ahtav · Aproteem Majumder · Hoa Doan · Mourede Otchere · Yujie Duan

For detailed setup, backend configuration, troubleshooting, and contribution guidance, see the [teammate README](docs/README.md).

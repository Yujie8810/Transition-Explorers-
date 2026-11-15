# Career Commons

A career-support app for UTD students and recent graduates, built for **CS 4352 — Foundations of Human-Computer Interaction (DP4)** by Transition Explorers.

**[Open the live app](https://career-commons.expo.app)**

**YouTube walkthrough link:** ____________________

The walkthrough video, Source document, and Team document are prepared separately by their assigned teammates. The video link will be filled in when ready.

## Features

- **Explore:** search and filter workplace questions, read answers, and save advice.
- **Ask:** compose, review, and publish questions; manage your own questions from Profile.
- **People:** browse graduate profiles, find relevant experience, and request guidance.
- **Your Circle:** manage contacts, exchange guidance messages, and schedule check-ins with invitations and new-time proposals.
- **Profile and Saved:** update your profile, opt into the People directory, and revisit saved answers.

## Trying the app

Open the live app and create an account or log in. If email confirmation is requested, confirm your email before logging in. The interface is designed for a portrait mobile screen; a narrow browser window or mobile viewport works well for review.

The hosted website requires an internet connection and a browser, with no project installation or Expo Go required. No special browser flags are required by the code. There are no universal test credentials in this repository: use **Signup** with an accessible email address and your own password, confirm the email if prompted, then log in. Any prepared reviewer accounts should be supplied separately by the team.

For two-way testing, use account A and account B in separate browser profiles or on separate devices. On B, first choose **Profile → Edit profile → Graduate** and save. Then edit its People profile, enter role/expertise/bio, enable **Appear in People**, and save. A can now find B in People. These app accounts are separate from Expo accounts used for mobile development.

**Tested environments:** Tested on both mobile devices and web browsers.

Suggested walkthrough: **Explore → open a question → save an answer → Saved → reopen the discussion**. To try communication and scheduling, use two accounts and a real graduate listing in People. Graduate accounts can enable their listing through **Profile → Your People profile → Edit People profile → Appear in People → Save**.

The app includes fictional graduates, questions, and answers alongside live community content. Requests and check-ins involving fictional graduates are personal demos and are not delivered; fictional-answer saves stay on that device. Post a real question to try answer posting and follow-ups. Messages and invitations refresh while their screens are open; push notifications and external calendar integration are not included.

## How to use the UI: three tasks

The bottom tabs are **Explore**, **Ask**, **People**, and **Profile**. Open Saved from Profile or a save confirmation; open Your Circle from People or Profile. Use the back control to return from a detail screen.

### Task 1: Find and save workplace advice

1. Sign in and open **Explore**. Search for a question or select a topic filter, then open a question card.
2. Read its answers and choose **Save this tip** on the answer you want. Wait for the success confirmation.
3. Open **View saved** from the confirmation, or **Profile → Saved advice**. Open the saved item to revisit its discussion. Use **Remove** to remove an item and **Undo** if you removed it accidentally.
4. To ask your own question, open **Ask**, enter a question and optional details, select a topic and posting identity, then choose **Review question → Publish question**. Follow the success link to your question. Manage owned questions from **Profile → View your posted questions**. Real database questions support answer posting and follow-ups.

Expected result: the answer appears in Saved. Real-answer saves persist for the account across devices; fictional-answer saves stay on that device. Failed writes show an error rather than success.

### Task 2: Find a graduate and request guidance

1. Open **People**, search by name/role/skill or filter by expertise, then choose **View profile** on another person's listing.
2. Choose the guidance action, keep **Advice** selected, enter a message, and choose **Review request**. Check the recipient/message, then confirm sending to a real graduate or saving for a fictional graduate.
3. Open **View Your Circle → Your guidance requests**. Open the chat for a real delivered request.
4. On B, open **Your Circle → Requests received**, open the request/chat, type a reply, and send it. Return to A's chat and refresh or wait for the focused five-second refresh.

Expected result: both real participants see the private conversation. Fictional graduates cannot receive or reply to messages. You cannot request guidance from yourself.

### Task 3: Manage contacts and schedule check-ins

1. Choose **Add to Your Circle** on another graduate's profile. Open **Your Circle → Contacts** to search contacts, view profiles, or remove a contact with confirmation. Cancel upcoming/ongoing active check-ins before removing their contact.
2. Choose **Schedule check-in** on a contact. Choosing **Check-in** in the guidance form also adds the contact if needed and opens scheduling.
3. Enter a topic, select **15** or **30 minutes**, and choose a suggested date/time or type `YYYY-MM-DD` and a 24-hour `HH:mm` time. Check the displayed local time zone. Suggested times are not verified availability.
4. Choose **Review check-in**, check the details, and confirm. A real contact receives an invitation; a fictional contact creates a personal plan. Past dates and overlapping bookings are rejected.
5. Open **Your Circle → Check-ins**. B can accept/decline or choose **Reschedule** to propose another time/duration. A can accept/reject the proposal. The original meeting stays unchanged until a proposal is accepted; conflicting or stale changes show an error.
6. A can choose **Reschedule or edit** or cancel with confirmation. The contact stays fixed while editing; create a new check-in for a different person. Changed invitations require acceptance again. Check the resulting status and history.

Expected result: schedules and decisions appear for the appropriate accounts. Accepted invitations reserve both users' times. Proposed slots are not reserved until accepted.

## Implementation limitations

- Internet access is needed for live data and writes; mock records are not a complete offline mode.
- Circle/chat refreshes on focus, foreground return, and every five seconds while open. There are no push notifications or external calendar sync. Failed chat sends retain the draft while the screen remains mounted; there is no durable offline outbox.
- Fictional requests/plans are personal demos; fictional-answer saves do not sync across devices. Real question IDs are required for answer posting and follow-ups. Older local records are not uploaded automatically.
- Graduate affiliation and People listings are self-reported. The listing switch controls discovery, not profile privacy.
- Password recovery, email-link session handling, and richer goals/reflections are outside the implemented flows. If confirmation is required, confirm the email and return to password login.

## Run locally

Requires Node.js 22.13.0 or newer in the 22.x series, or Node.js 24.3.0 or newer in the 24.x series, npm, Git, and the shared Supabase project configuration. Node 20 is below this project's requirements. The hosted app above avoids local installation.

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

The example configuration contains placeholders, not a working backend. For local review the team must supply the project URL and publishable app key; never use a secret/admin key. Do not rerun creation migrations on the existing team project. Detailed configuration is in the [teammate README](docs/README.md). Rerun `npm ci` after pulling package changes and restart Expo after changing environment values.

On Windows PowerShell, `Copy-Item .env.example .env.local` also copies the configuration template. If scripts are disabled, use `npm.cmd` and `npx.cmd` instead of `npm` and `npx`. Run commands inside the cloned repository: a GitHub ZIP download has no `.git` and cannot run `git pull`.

For mobile testing with a compatible Expo Go version, run `npm start` and scan the QR code. Local development requires a running development server; the hosted website does not.

This project uses **Expo SDK 58**; install compatible Expo Go on the phone. Keep the phone/computer on the same Wi-Fi, or run `npx expo start --go --tunnel ngrok` and scan the new QR code. On a physical iPhone, sign in to the same Expo account in Expo Go and Expo CLI. Run `npx expo login` (or `npx expo login --no-browser` if browser authorization fails), then verify with `npx expo whoami`. These credentials are separate from the app login. Restart the server after switching Expo accounts. An empty bundler-cache warning is normal; wait for rebuilding to finish.

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

# Career Commons — Teammate Guide

Development, backend setup, troubleshooting, and contribution notes for the team. For the live app and review instructions, see the [main README](../README.md).

Team: Aalvee Ahtav, Aproteem Majumder, Hoa Doan, Mourede Otchere, Yujie Duan.

## Current implementation

**Backend wiring is complete for the currently implemented app flows.** The developer reports that the integrations work on the shared Supabase project, including guidance chat, scheduled invitations, and recipient-proposed new times. The latest local validation passed TypeScript, all **82 automated tests**, and a web Expo export. See the [verification record](backend-status.md) for the distinction between app checks, SQL permissions results, and final QA.

- **Accounts and Profile:** Supabase email/password signup/login, session restoration/refresh, confirmation feedback, logout, and saved name/program. Student/Graduate affiliation is self-reported Auth metadata.
- **Explore and Ask:** shared public/anonymous questions, search/topic filters, review/publish, author labels, owned-question lists, editing/deletion, and independent follow-ups.
- **Answers and Saved:** real answer posting, author bylines, shared counts, and account-private saved answers with Remove/Undo. Saves of fictional answers stay on the device.
- **People:** opt-in real graduate profiles with role, expertise, and bio, alongside seven fictional graduates. Use **Profile → Edit profile → Graduate**, then **Your People profile → Edit People profile → Appear in People → Save**. Your own listing offers editing instead of self-contact/request actions.
- **Circle and guidance chat:** remote contacts, reviewed requests, a recipient inbox, and private two-way guidance conversations with message bubbles and a composer. Hiding a delivered request preserves the recipient's conversation; a new guidance reply restores it for the sender.
- **Scheduled check-ins:** invitations show the date/time, duration, topic, and Accept/Decline controls. Both users see decisions and cancellation. Sender edits ask the recipient to accept the changed invitation.
- **Recipient rescheduling:** **Reschedule and propose a new time** appears below Decline. The original sender can accept or reject the proposal. Acceptance confirms the new time for both users; rejection keeps the original meeting unchanged. Calendar conflicts and stale proposals are checked on the server.

## Mock data and current limits

The app intentionally retains **7 fictional graduates, 13 fictional questions, and 30 fictional answers** alongside live content. Demo People entries remain visible if community-profile loading fails, with a retry message. Mock content is not an automatic offline replacement for backend writes or all task flows.

Fictional-guide requests and check-ins remain personal demo records without delivery. Fictional-answer saves use account-specific AsyncStorage and do not sync across devices. Answer posting and follow-ups require real database questions because fictional IDs are not UUIDs. Existing local records are preserved without automatic upload; recreate/save them through the app to store them remotely. Older private real-user requests/plans are not retroactively delivered.

Circle and chats refresh on focus, foreground return, and every five seconds while open; People refreshes on focus/manual refresh. There are no Supabase Realtime subscriptions, push notifications, calendar integration, or durable offline message outbox. Failed chat sends retain the draft while that screen remains mounted. Questions/answers/saves use their own loading/refresh actions. Real answer bylines do not yet link directly into People; use the People directory to find a listed graduate.

Listing in People and Graduate affiliation are self-reported, not verified membership. Existing profile columns are readable by signed-in users; the listing switch controls discovery, not profile privacy. Email-link session handling, password recovery, and richer goals/reflections are outside the implemented flows.

## Supabase authentication setup

**Existing team project:** the backend integrations are deployed and developer-reported working. Teammates should configure the app and use that project; **do not rerun its CREATE TABLE migrations**. The ordered scripts below are for a fresh project or a deliberately identified missing migration.

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` and set `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the shared project. Use a publishable app key; never include secret/admin keys. `.env.local` is ignored by Git.
3. For a **fresh project only**, run each entire SQL file once in Supabase SQL Editor, in this order:

| Order | SQL file | Adds |
| --- | --- | --- |
| 1 | [profiles.sql](../supabase/profiles.sql) | Case-sensitive `public."Profiles"` and owner writes |
| 2 | [advice.sql](../supabase/migrations/advice.sql) | Questions, feed RPC, answers, and saves |
| 3 | [circle_contacts.sql](../supabase/migrations/circle_contacts.sql) | Private contact membership |
| 4 | [guidance_requests.sql](../supabase/migrations/guidance_requests.sql) | Atomic request/contact saves |
| 5 | [check_ins.sql](../supabase/migrations/check_ins.sql) | Personal schedules, overlap/contact guards |
| 6 | [people_directory.sql](../supabase/migrations/people_directory.sql) | Opt-in real People listings and real guide IDs |
| 7 | [request_delivery.sql](../supabase/migrations/request_delivery.sql) | Private chat, inbox, shared invitations, calendar bookings |
| 8 | [check_in_time_proposals.sql](../supabase/migrations/check_in_time_proposals.sql) | Recipient proposals and sender decisions |

These are manual, ordered, one-time scripts, not idempotent setup. Saving a file does not execute it. This workflow does not use `supabase db push`.

4. Keep RLS enabled. Profiles are readable by signed-in users with owner-only profile writes; saves/contacts are private; delivered requests, messages, invitations, and proposals are readable by their participants. Guarded RPCs enforce who may send, decide, edit, or cancel. Run the [permissions checks](database-permissions.md) as ordinary authenticated roles rather than relying on dashboard admin reads.
5. Enable email/password authentication. If confirmation is enabled, configure delivery/Site URL, confirm the account, then return to password login. Live confirmation/delivery behavior for the team's configuration still needs a recorded result.
6. Restart Expo with `npx expo start --clear`, sign in, and open Profile so the account has a profile row. Restart after environment changes or if a phone is running stale code.

### Data ownership and shared providers

| Data | Source of truth |
| --- | --- |
| Credentials and sessions | Supabase Auth; device/browser storage persists the session |
| Name/program, role, bio, expertise, People listing | `Profiles` |
| Self-reported Student/Graduate affiliation | Auth `user_metadata.affiliation` |
| Questions and anonymous feed | `questions`, read through `get_question_feed()` |
| Answers and author bylines | `answers` joined to `Profiles` |
| Real saved answers | `saved_answers`, private to the saving account |
| Fictional-answer saves | Account-specific AsyncStorage |
| Contacts | `circle_contacts`, private `(user_id, guide_id)` membership |
| Requests and chat | `guidance_requests`, `guidance_messages` |
| Schedules and accepted calendar reservations | `check_ins`, private `check_in_bookings` |
| Recipient-proposed new times | `check_in_time_proposals` |

The root remounts personal providers on account changes to discard stale forms and results. `AuthProvider` owns session restoration/refresh. `ProfileProvider` owns profile edits; `PeopleProvider` loads directory profiles and saves opt-in listings. `AdviceProvider`, `AnswersProvider`, and `SavedAdviceProvider` share advice state. `NetworkProvider` loads Circle/inbox/chat/invitations/proposals, serializes mutations and refreshes, and ignores late account results. The API/SQL preserve the account that initiated a write.

Requests, messages, and proposals reuse in-memory retry tokens after an uncertain response. Reloading loses those tokens; inspect Circle/chat before manually resending. Profile database writes and Auth metadata updates are separate operations; retry a failed profile save to reconcile partial completion. Legacy device-wide/local account data remains untouched.

### Validation and handoff

Teammates testing the shared backend should start with the
[step-by-step database testing guide](teammate-database-testing.md), covering
app setup, two accounts, SQL scripts, expected results and troubleshooting.

```sh
npm run typecheck
npm test
npm run web
```

The latest implementation checks passed **82 automated tests**, TypeScript, whitespace validation, and a web export. These checks cover shared data, account isolation, failures/retries, chat, invitation decisions, and proposal acceptance/rejection; they do not establish deployed authorization or a final phone rehearsal.

Developer reports and screenshots establish live backend task behavior. Earlier advice/contact/request SQL checks and the baseline check-in permissions test passed; separate PASS results for the newer directory/delivery/proposal scripts have not been recorded. Run any outstanding [permissions checks](database-permissions.md), then complete the [final rehearsal checklist](checkpoint.md). Those are verification tasks, not remaining backend wiring.

Feature guides: [contacts](circle-contacts.md), [People](people-directory.md), [requests](guidance-requests.md), [chat/invitations](request-delivery.md), [check-ins](check-ins.md), and [new-time proposals](check-in-time-proposals.md).

## First-time setup for each teammate

### 1. Install the basic tools

- A [GitHub account](https://github.com/) with access to the team repository. If it is private, accept the collaborator invitation first.
- [Git](https://git-scm.com/downloads) for downloading code and recording contributions.
- An LTS version of [Node.js](https://nodejs.org/). npm comes with Node.js.
- A code editor such as VS Code or Cursor.

Open Terminal on macOS or PowerShell on Windows and confirm the installations:

```sh
git --version
node --version
npm --version
```

If a command is not recognized, finish installing that tool and reopen the terminal. A global Expo CLI installation is unnecessary; the project uses its local CLI through npm scripts and `npx`.

### 2. Clone the existing repository

In a terminal, move to the parent folder where you keep projects, then run:

```sh
git clone https://github.com/Yujie8810/Transition-Explorers-.git
cd Transition-Explorers-
```

If the folder already exists because you cloned it earlier, open that folder instead of cloning into it again. Do not run `create-expo-app`: this repository already contains the app.

If GitHub requests authentication, follow its browser/credential-manager prompts. An account password is not an HTTPS Git credential; follow [GitHub’s authentication instructions](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/about-authentication-to-github) if prompted for credentials. A “repository not found” error can mean your GitHub account has not been granted access.

### 3. Install the project dependencies

Run this inside `Transition-Explorers-`, where `package.json` is located:

```sh
npm ci
```

`npm ci` installs the versions recorded in `package-lock.json`. Every teammate needs to run this on their own computer. Do not copy another person’s `node_modules` folder. After pulling changes that update either package file, run `npm ci` again.

### 4. Set your contribution identity and create a branch

Replace the example values with your own name and an email linked to your GitHub account (or your GitHub-provided private email):

```sh
git config user.name "Your Name"
git config user.email "your-github-email@example.com"
git switch -c feature/your-module
```

Use a descriptive branch name such as `feature/support-network`. These identity settings apply only to this repository. Each teammate should make their own commits so contributions are recorded correctly.

## Choose how to run the app

The project uses Expo libraries and tooling in every option below. **Running without Expo Go** means installing the app itself or using a browser; removing Expo from this codebase would require a separate migration.

| Option | What you need | Command | Best use |
| --- | --- | --- | --- |
| Phone with Expo Go | Phone + Expo Go + network connection | `npm start` | Quick mobile development |
| Browser, without Expo Go | Desktop browser | `npm run web` | Quick layout/navigation preview |
| Android app, without Expo Go | Android Studio + Android SDK/JDK + emulator or USB device | `npx expo run:android` | Native Android testing |
| iOS app, without Expo Go | Mac + Xcode + simulator | `npx expo run:ios` | Native iOS testing |
| Installable Android APK | Team-configured EAS project/build | See APK instructions below | Sharing a demo without a development server |

### Option A: Phone with Expo Go

1. Install [Expo Go](https://expo.dev/go) on your phone.
2. Run `npm start` in the repository.
3. Connect the phone and computer to the same Wi-Fi.
4. Scan the terminal QR code using Expo Go on Android or the Camera app on iPhone.
5. Leave the terminal running. Save a screen change to see it refresh on the phone.

If Expo Go asks you to sign in, run `npx expo login` on your computer and sign in to that account in Expo Go. Follow [Expo’s device instructions](https://docs.expo.dev/get-started/start-developing/) for account or connection errors.

This project uses **Expo SDK 58**. Use Expo Go with SDK 58 support on Android and iOS. After pulling this upgrade, stop any existing Expo server and run `npm ci`, then `npx expo start --go --clear`. If the phone cannot reach the computer over Wi-Fi, use `npx expo start --go --tunnel ngrok --clear` and scan the new QR code. Coordinate future SDK upgrades with the team; do not independently upgrade React Native or Expo packages.

### Option B: Browser preview without Expo Go

```sh
npm run web
```

Open the local URL printed in the terminal. In your browser’s developer tools, enable the device/mobile viewport to approximate a phone-sized layout. This is useful for development, but touch behavior, native controls, and keyboard handling still need testing on the target mobile platform. This local preview does not publish a website.

### Option C: Native app without Expo Go

For Android, complete the [Android environment setup](https://docs.expo.dev/workflow/android-studio-emulator/), including Android Studio, the SDK/JDK, and a running emulator. For a physical Android phone, enable USB debugging and connect it to your computer.

```sh
npx expo run:android
```

For iOS, use a Mac with Xcode and its simulator tools:

```sh
npx expo run:ios
```

These commands generate the native project, compile/install a debug app, and start Metro. Debug apps still need the development server. Rebuild after native dependency/configuration changes. Generated `android/` and `ios/` folders are ignored by this repository. See [Expo’s local build guide](https://docs.expo.dev/guides/local-app-development/).

`npm run android` and `npm run ios` only start Expo and open a device/simulator; they do not compile a standalone native app.

### Optional: Android APK for a demo

The app is linked to an EAS project and its website is hosted on Expo. This checkout has no `eas.json` for native builds. If an Android APK is needed, one coordinator should configure native builds using the existing Expo project:

```sh
npx eas-cli@latest login
npx eas-cli@latest build:configure
```

Set a unique Android package identifier when prompted. In the generated `eas.json`, add a `preview` build profile with `android.buildType` set to `apk`, preserving any existing profiles:

```json
{
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

Then run:

```sh
npx eas-cli@latest build --platform android --profile preview
```

This uploads the project to EAS and produces an installable APK. Share the download link with teammates. The preview APK embeds JavaScript and runs without Expo Go or Metro; rebuild it for code changes. Coordinate account access, signing, build limits, and generated configuration. Follow [Expo’s APK guide](https://docs.expo.dev/build-reference/apk/). These are optional future steps, not setup already completed in this repository.

## Update the hosted website

Live app: <https://career-commons.expo.app>

From the repository root, with the shared Supabase values configured in `.env.local`, run:

```sh
npx expo export --platform web
npx eas-cli@latest deploy --prod
```

Re-export before each deployment so the uploaded `dist/` contains the latest code. Use an Expo account with access to the existing EAS project. These commands publish local files; a GitHub push is not required for this manual deployment. Commit and push changes separately to keep the team repository current.

## Troubleshooting and useful commands

| Problem | What to try |
| --- | --- |
| `package.json` not found | Open the repository folder before running npm commands. |
| Missing packages after cloning/pulling | Stop the server and run `npm ci`. |
| Phone cannot reach the server | Check Wi-Fi/firewall settings or use a personal hotspot. Try `npx expo start --tunnel ngrok`; it may request a tunnel helper installation. |
| Old code or Metro cache issues | Stop the server and run `npx expo start --clear`. |
| Expo Go SDK mismatch | Compare the installed app version with this repository’s SDK and coordinate the fix with the team. |
| Emulator/simulator not found | Set up Android Studio or Xcode, or use the phone/browser options instead. |
| Port is already in use | Stop the previous server or accept Expo’s offered alternative port. |

Stop a running server with Ctrl+C. Configure `.env.local` using the Supabase setup above before running the app; register a real account through Signup. Expo services and physical-iPhone Expo Go access may require an Expo account as described above.

```sh
npm run typecheck
npm test
```

Run these commands to check TypeScript and the automated tests before sharing changes. They do not replace manually testing your task flow.

## Where each teammate works

| Owner | Main files | Area |
| --- | --- | --- |
| Aproteem | `src/features/auth/`, `src/features/explore/` | Login/signup/logout, home layout; coordinate shared navigation changes |
| Mourede | `src/features/advice/`, `src/features/ask/` | Search, discussions/answers, question posting, saving advice |
| Yujie Duan (Yuji) | `src/features/people/`, auth backend integration through `src/features/auth/` | People/directory, graduate profiles, guidance requests, and backend integration with Aproteem |
| Hoa | `src/features/network/` | Connections, guidance chat, check-in invitations and rescheduling |
| Aalvee | `src/features/profile/`, `src/components/`, `src/theme.ts` | User profile, posted-question management, shared components, testing support |
| Agree together | `src/features/saved/` | Saved advice shared by the advice and network flows |

Yujie owns Ask for Help and coordinates backend integration with Aproteem; follow the [Supabase authentication setup](#supabase-authentication-setup) before changing auth contracts, routing, or account IDs. Mourede and Hoa should coordinate edits to the shared Saved flow. Existing feature implementations should be extended in their owners’ modules.

### Folder map

```text
src/
  app/                 Routes and shared session/navigation wiring
    (tabs)/            Four bottom tabs
    advice/[id].tsx    Selected discussion route
    people/            Graduate profile and request routes
    network/           Circle, guidance chat, check-ins and proposal routes
    my-questions/      Posted-question list and edit routes
  features/            Actual screens, grouped by module
  components/          Shared screen, button, and DM Sans typography components
  data/sampleData.ts   Fictional graduates, questions, and answers used by the screens
  state/               Shared profile and saved-advice providers
  types/index.ts       Shared TypeScript contracts
  theme.ts             Shared colors and spacing
```

Search for `need to implment` in `src/` to find comments describing unfinished work and the responsible teammate. The spelling is intentional so everyone can search for the same marker.

Routes re-export feature screens to keep team edits separate. Implement the UI inside your feature folder, replacing `FeaturePlaceholder` as you go. Add more routes/screens for review, confirmation, mentor details, or progress when your flow needs them.

Use `useLocalSearchParams` from `expo-router` to read an `[id]` route parameter and look up the selected record. Advice and graduate profiles use this pattern with database IDs and fictional IDs from `sampleData.ts`.

## Shared development rules

- Reuse `Screen`, `AppButton`, and `theme`; coordinate edits to these shared files. Import `Text` and `TextInput` from `src/components/Typography.tsx` to keep DM Sans and its weight mapping consistent. The root layout loads the bundled font faces before displaying the app.
- Keep route files small. Put feature-specific components and logic inside the feature folder.
- Reuse `AdviceProvider`, `AnswersProvider`, `SavedAdviceProvider`, `NetworkProvider`, `PeopleProvider`, and `ProfileProvider` for shared data. Questions, real answers/saves, Profile, directory listings and all Circle features use Supabase; fresh projects need the full ordered migration chain above. Only demo saves still use account-specific AsyncStorage. `AnswersProvider` inherits its account boundary from the root; the other providers accept `accountId`. The root mounts these providers only for a signed-in account and remounts them when the account changes; preserve that boundary to prevent stale data or drafts appearing for another account. `AdviceProvider` exposes `postedQuestions`, `postQuestion`, `updateQuestion`, and `deleteQuestion`; use these shared operations so Explore and Profile stay in sync. Question mutations wait for loading and persist through the API; saves block overlapping changes. Coordinate session or storage changes with Aproteem.
- Import seed data rather than duplicating the same people/posts in multiple modules. Expand the data enough to support realistic tasks.
- Stack screens receive a back button when pushed from another screen. Test returning without losing drafts.
- Keep implementation status accurate in developer documentation and use normal product copy in the app. Do not store real passwords in seed data or the local account registry.
- Replace placeholder icons/assets before the final demo as needed. Assets are Expo defaults.

## Daily Git workflow for each teammate

### Start a new piece of work

With your previous changes committed and your working tree clean (`git status`):

```sh
git switch main
git pull --ff-only
git switch -c feature/your-next-task
```

Choose a new descriptive branch name each time. Work in your assigned feature folder. Coordinate changes to shared components, navigation, shared types, and dependencies before editing them.

### Check, commit, and push your work

Run `npm run typecheck`, then run the app and manually exercise the flow, including back navigation, selected tabs, editable inputs, and confirmation feedback.

```sh
git status
git diff
```

Stage only the files you worked on. For example, Hoa might use:

```sh
git add src/features/network/
git commit -m "Add support network contact list"
git push -u origin feature/support-network
```

Replace the path, message, and branch name with your actual work. If you changed route files or shared files too, review and stage those explicitly. Do not commit `node_modules`, `.expo`, credentials, or generated native folders. Commit `package-lock.json` alongside intentional package changes.

### Open a pull request and merge

On [the GitHub repository](https://github.com/Yujie8810/Transition-Explorers-), open a pull request from your feature branch into `main`. Describe what works, what remains unfinished, and how you tested it. Ask a teammate to review, then merge after resolving any issues. Pushing a feature branch alone does not add its code to `main`.

### Bring teammates’ changes into an active branch

Commit your current work first, then run:

```sh
git fetch origin
git merge origin/main
```

If there are conflicts, open the listed files, work with the relevant teammate to keep the intended changes, remove conflict markers, stage the resolved files, and commit the merge. Run `npm ci` if package files changed, then repeat the checks. Do not force-push or discard another teammate’s work to bypass conflicts.

After your pull request is merged, switch to `main`, pull the latest code, and create a fresh branch for your next task.

## Historical November 3 checkpoint

This section records an earlier course checkpoint; it is not the current submission checklist.

The checkpoint needs 2–3 slides and a live demo within **5 minutes**. At least one of the three tasks must work end to end on the chosen mobile platform.

- The earlier checkpoint slide deck is not present in this checkout. Prepare the final presentation separately.
- Rehearsal, phone checks, and proposed timeline: [checkpoint guide](checkpoint.md).
- Main demo: **Explore → filter/search → open a question → save one answer → Saved → reopen the question**.
- Before class: test on the presentation phone, verify persistence after restarting, and confirm the live connection. Browser testing and successful bundling do not establish physical-device readiness.
- That checkpoint build used fictional/local data. The current Supabase implementation and remaining limitations are documented above; do not present the historical checkpoint status as current.

## References

- [Figma Application Page](https://www.figma.com/design/ylCgauMWXkjb4IL3b4zdQA/?node-id=42-2)
- [Expo project setup and Expo Go SDK guidance](https://docs.expo.dev/get-started/create-a-project/)
- [Expo Router setup](https://docs.expo.dev/router/installation/)
- [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/)

Course deliverables (Source, ReadMe, and Team PDFs, presentation, and narrated/subtitled video) are managed separately. This teammate guide does not track their submission status.

## Verification

Latest implementation validation: **82 automated tests**, TypeScript, whitespace checks, and a web Expo export passed. Backend flows, including chat and recipient rescheduling, are developer-reported working on the shared project. See the [verification record](backend-status.md) for recorded SQL results and remaining final QA. Exports do not establish an installed native build or completed presentation rehearsal.

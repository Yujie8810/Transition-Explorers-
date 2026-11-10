# Transition Explorers · Career Commons

CS 4352 DP4 mobile app for UTD students and recent graduates seeking workplace advice and support.

Team: Aalvee Ahtav, Aproteem Majumder, Hoa Doan, Mourede Otchere, Yujie Duan.

## Current implementation

- **Accounts:** Supabase email/password signup/login, session restoration/refresh, confirmation feedback, and logout. Main screens require a session.
- **Profile:** name/program read and save to the case-sensitive `public."Profiles"` table. Student/Graduate affiliation is self-reported Auth metadata, not verified membership.
- **Explore and Ask:** shared Supabase questions, topic/search filters, review/publish, author names for public posts, anonymous labels, and ownership-specific Profile lists with editing/deletion. Deleting an original leaves its follow-ups independent.
- **Answers:** Supabase answer posting and shared answer counts, text, and author profiles. Real answer authors display a byline; their People profile/request routes are not implemented yet.
- **Saved:** real answer saves use Supabase, with per-account loading, retry, duplicate prevention, Remove, and Undo. Fictional demo answer saves stay in account-specific AsyncStorage.
- **People and Circle:** seven fictional graduates, reviewed guidance requests, contacts, and check-in scheduling/rescheduling/cancellation/history. Contacts, requests, and check-ins are local personal records; there is no request delivery, messaging, or cross-device Circle synchronization.

The app retains **13 fictional questions and 30 fictional answers** alongside live database content. Fictional IDs are not UUIDs, so posting answers or follow-ups is supported only on database questions. New questions initially have no answers.

**Verification status:** the developer reported successful mobile-app tests of signup/login/logout, profile edits and later login, two-account public/anonymous question sharing, ownership-specific lists, question edits/deletion, answer posting/author display/counts, and remote Saved behavior. Profile RLS testing confirmed an owner update returns one row and a different user's update returns zero. These checks do not establish deployed question/answer/save RLS or anonymous feed masking; those remain pending, along with cross-device persistence and a full rehearsal on the presentation phone. See [checkpoint](docs/checkpoint.md).

## Supabase authentication setup

**Owners:** Aproteem maintains the auth frontend; Yujie Duan (Yuji) handles backend integration. Coordinate profile work with Aalvee and advice/Saved changes with Mourede and Hoa.

1. Run `npm ci` to install the recorded dependencies.
2. Copy `.env.example` to `.env.local` and fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the team's project. Use a publishable key (`sb_publishable_...`). Never put secret/admin keys in the app. `.env.local` is ignored; `.env.example` contains placeholders suitable for Git.
3. Use the existing team Supabase project, where the tables have already been created. For a **fresh project only**, execute [supabase/profiles.sql](supabase/profiles.sql) first, then [supabase/migrations/advice.sql](supabase/migrations/advice.sql) in the Supabase SQL Editor. These are manual setup scripts, not idempotent migrations: rerunning them on an initialized database will fail. Saving a SQL file locally does not execute it. These instructions do not use `supabase db push`.
4. Keep RLS enabled. Profiles are readable by signed-in users, with owner-only insertion/update. Questions/answers have owner-only mutations; saves are private to their user. The feed function returns community questions while masking anonymous author IDs. The client looks up names only for public questions. Verify these deployed permissions using ordinary authenticated roles, not the dashboard's admin role.
5. Enable email/password signup. If confirmation is enabled, configure email delivery and a working Site URL; confirm the email link, then return to password login. Email-link session handling and password recovery are not implemented. Confirmation/email-delivery behavior still needs live verification for the team's configuration.
6. Restart Expo with `npx expo start --clear`, sign up with an email you control, and test the full flow. Restart after environment or integration changes if the phone is running stale code.

All profile columns are readable by signed-in users under the current policy. Keep private account data out of `Profiles` unless access rules change. The existing project uses `Profiles` with a capital P; do not rename it independently.

### Implementation and data ownership

| Data | Source of truth |
| --- | --- |
| Credentials and sessions | Supabase Auth; native session persistence uses AsyncStorage, web uses browser storage |
| Name and program | `Profiles.full_name` and `Profiles.major` |
| Self-reported affiliation | Auth `user_metadata.affiliation` |
| Shared questions | `questions`, read through `get_question_feed()` |
| Real answers and author bylines | `answers` joined to `Profiles` |
| Real saved answers | `saved_answers`, keyed by `(user_id, answer_id)` |
| Fictional demo saves | `transition-explorers.saved-advice.v1.<accountId>` in AsyncStorage |
| Circle contacts/requests/check-ins | `transition-explorers.network.v1.<accountId>` in AsyncStorage |

- `AuthProvider` manages restoration, session events, and native foreground refresh. `accountStore.ts` contains validation/user mapping; it no longer stores demo credentials. Logout ends this device's session, leaving other devices signed in.
- `ProfileProvider` reads the user's row and inserts defaults only if it is missing. An existing signup trigger can coexist with this behavior. Profile database writes and Auth metadata updates are separate operations; retry a failed save to reconcile partial completion.
- `AdviceProvider` fetches shared questions; `isMine` controls the personal list and UI actions. UI ownership checks supplement database RLS. `AnswersProvider` shares real and fictional answers across counts/details/Saved.
- `SavedAdviceProvider` loads remote saves and local demo saves. It blocks overlapping mutations and changes visible state after persistence succeeds. It does not silently upload earlier local real-answer saves: those remain on disk, and users should save them again to create remote records.
- Root remounts personal providers on account ID changes to discard old forms and in-memory data. Old device-wide keys and `local-...` demo identities remain untouched, without automatic migration based on email.
- Questions load on login and after mutations; answers have a Refresh action. There are no realtime subscriptions or automatic live updates from other devices. Answer loading currently fetches all available answers; pagination remains future work.

### Validation and handoff checklist

```sh
npm run typecheck
npm test
npm run web
```

Automated tests mock the backend. They cover Ask validation, Auth/profile behavior, shared-question mapping/mutations/retries, author labels and client-side anonymous masking, remote saves and local demo saves, failed writes, account boundaries, and late responses. They do not prove server authorization or live email delivery.

Still verify before the final demo, using the [permissions and cross-device checklist](docs/database-permissions.md):

- Anonymous feed entries return `author_id: null` and `author_name: null` to another signed-in user. A client's masking alone is not proof that the server withheld the ID.
- Direct requests cannot edit/delete another user's questions or answers, or read/create/delete another user's saves. Signed-out access is denied. Authenticated profile/community reads are intentionally allowed.
- Same-account login on another device restores the profile, owned questions, and real saves; Circle and demo saves stay local.
- Confirmation, invalid credentials, expired/revoked sessions, offline retries, protected deep links, and back navigation behave correctly.
- Complete the physical-phone navigation, keyboard, accessibility, presentation-network, and rehearsal checks in [checkpoint](docs/checkpoint.md).

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

This skeleton has no EAS project or `eas.json` yet. When the team is ready, one coordinator should configure EAS using an Expo account:

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

| Owner | Main files | Work to implement |
| --- | --- | --- |
| Aproteem | `src/features/auth/`, `src/features/explore/` | Login/signup/logout, home layout; coordinate shared navigation changes |
| Mourede | `src/features/advice/`, `src/features/ask/` | Search, discussions/answers, question posting, saving advice |
| Yujie Duan (Yuji) | `src/features/people/`, auth backend integration through `src/features/auth/` | People search/filtering, graduate profiles, editable guidance requests; connect Aproteem's login/signup/session frontend to the backend |
| Hoa | `src/features/network/` | Connections, mentor details, check-in scheduling and progress |
| Aalvee | `src/features/profile/`, `src/components/`, `src/theme.ts` | User profile, posted-question management, shared components, testing support |
| Agree together | `src/features/saved/` | Saved advice shared by the advice and network flows |

Yujie owns Ask for Help and is implementing backend authentication with Aproteem; follow the [Supabase authentication setup](#supabase-authentication-setup) before changing auth contracts, routing, or account IDs. Mourede and Hoa should coordinate edits to the shared Saved flow. Existing feature implementations should be extended in their owners’ modules.

### Folder map

```text
src/
  app/                 Routes and shared session/navigation wiring
    (tabs)/            Four bottom tabs
    advice/[id].tsx    Selected discussion route
    people/            Graduate profile and request routes
    network/           Circle and check-in routes
    my-questions/      Posted-question list and edit routes
  features/            Actual screens, grouped by module
  components/          Shared Screen, AppButton, FeaturePlaceholder
  data/sampleData.ts   Fictional graduates, questions, and answers used by the screens
  state/               Shared profile and saved-advice providers
  types/index.ts       Shared TypeScript contracts
  theme.ts             Shared colors and spacing
```

Search for `need to implment` in `src/` to find comments describing unfinished work and the responsible teammate. The spelling is intentional so everyone can search for the same marker.

Routes re-export feature screens to keep team edits separate. Implement the UI inside your feature folder, replacing `FeaturePlaceholder` as you go. Add more routes/screens for review, confirmation, mentor details, or progress when your flow needs them.

Use `useLocalSearchParams` from `expo-router` to read an `[id]` route parameter and look up the selected record. Advice and graduate profiles already use this pattern with IDs from `sampleData.ts`.

## Shared development rules

- Reuse `Screen`, `AppButton`, and `theme`; coordinate edits to these shared files.
- Keep route files small. Put feature-specific components and logic inside the feature folder.
- Reuse `AdviceProvider`, `AnswersProvider`, `SavedAdviceProvider`, `NetworkProvider`, and `ProfileProvider` for shared data. Questions, real answers/saves, and Profile use Supabase; Circle and demo saves use account-specific AsyncStorage. `AnswersProvider` inherits its account boundary from the root; the other providers accept `accountId`. The root mounts these providers only for a signed-in account and remounts them when the account changes; preserve that boundary to prevent stale data or drafts appearing for another account. `AdviceProvider` exposes `postedQuestions`, `postQuestion`, `updateQuestion`, and `deleteQuestion`; use these shared operations so Explore and Profile stay in sync. Question mutations wait for loading and persist through the API; saves block overlapping changes. Coordinate session or storage changes with Aproteem.
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

## November 3 checkpoint

The checkpoint needs 2–3 slides and a live demo within **5 minutes**. At least one of the three tasks must work end to end on the chosen mobile platform.

- Presentation: [DP4-Checkpoint.pptx](docs/DP4-Checkpoint.pptx).
- Rehearsal, phone checks, and proposed timeline: [checkpoint guide](docs/checkpoint.md).
- Main demo: **Explore → filter/search → open a question → save one answer → Saved → reopen the question**.
- Before class: test on the presentation phone, verify persistence after restarting, and confirm the live connection. Browser testing and successful bundling do not establish physical-device readiness.
- That checkpoint build used fictional/local data. The current Supabase implementation and remaining limitations are documented above; do not present the historical checkpoint status as current.

## References

- [Figma Application Page](https://www.figma.com/design/ylCgauMWXkjb4IL3b4zdQA/?node-id=42-2)
- [Expo project setup and Expo Go SDK guidance](https://docs.expo.dev/get-started/create-a-project/)
- [Expo Router setup](https://docs.expo.dev/router/installation/)
- [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/)

The final Source, ReadMe, and Team PDFs, final presentation, and narrated/subtitled video still need to be prepared by the assigned team members. This repository README is a development guide, not a replacement for those submissions.

## Verification

November 10 integration checks passed: TypeScript, all 33 automated tests, whitespace checks, and Android/iOS/web Metro exports. The suite mocks Supabase; developer-reported live checks and still-pending server permission/physical-phone checks are distinguished above and in [checkpoint](docs/checkpoint.md).

Earlier October 29 and November 9 bundle/browser checks apply to earlier builds. An export is not an installed native build, a live database test, or a completed presentation-phone rehearsal.

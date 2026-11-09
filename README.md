# Transition Explorers · Career Commons

CS 4352 DP4 mobile app for UTD students and recent graduates seeking workplace advice and support.

Team: Aalvee Ahtav, Aproteem Majumder, Hoa Doan, Mourede Otchere, Yujie Duan.

## Current implementation

- **Explore:** connected discussion feed, keyword search, topic filters, and question details. The active bottom tab has a centered icon/label inside a rounded lime highlight.
- **Advice and Saved:** individual answer saving, author attribution, saved-state feedback, removal, and undo.
- **Ask:** editable questions, similar experiences, review/edit/publish, and linked follow-ups.
- **People:** graduate search/filtering, profiles, and guidance requests with review/edit/confirm.
- **Your Circle:** contacts, saved requests, check-in scheduling, review, rescheduling, cancellation, and history.
- **Accounts:** signup, email-only login, persisted sessions, and logout from Profile. Signup collects name, email, program, and Student/Graduate affiliation. The app opens Login when signed out and Explore when signed in. Main tabs and detail routes require a session. The backend integration is assigned to Yuji; see the handoff below.
- **Profile:** the current account's editable identity, links to Saved/Your Circle, and **View your posted questions** to view/edit/delete local posts. Edits persist and update Explore; deletion requires confirmation and leaves any follow-ups as independent posts. Seeded community questions cannot be edited or deleted.
- **Storage:** AsyncStorage keeps profile, questions, saved tips, contacts, requests, and check-ins on the device/browser, separated by a stable local account ID.

**Integration status:** the frontend is implemented, but the current authentication adapter uses AsyncStorage. Email alone selects a locally registered account; credential verification, tokens, server-side authorization, email verification, and remote session revocation are not implemented. No backend service or auth SDK is configured in this checkout. Guidance requests and check-ins also remain local, with no messaging or cross-device synchronization. Existing pre-account device-wide data is preserved under its original keys and is not assigned to new accounts. These implementation notes belong in developer documentation; the app's screens use normal product copy.

The shared dataset contains **7 graduates, 13 questions, and 30 answers**. Posted questions are local additions, initially without answers.

## Authentication backend handoff — Yuji

**Owners:** Aproteem maintains the login/signup frontend and shared navigation integration. Yujie Duan (Yuji) is implementing the authentication backend integration. Coordinate profile changes with Aalvee and personal-data changes with the relevant feature owners.

### Start with these files

| File | Current responsibility | Backend integration work |
| --- | --- | --- |
| [LoginScreen.tsx](src/features/auth/LoginScreen.tsx) | Email input, validation, loading/error feedback, signup link | Connect through `useAuth().signIn`; add credential or verification inputs if the chosen flow needs them. |
| [SignupScreen.tsx](src/features/auth/SignupScreen.tsx) | Name, email, program, affiliation, validation, submit state | Keep the existing profile fields; add any required credentials or verification step with Aproteem. |
| [accountStore.ts](src/features/auth/accountStore.ts) | Local account registry, email normalization, registration validation, serialized writes | Replace the local account operations with an auth-service adapter. There are no HTTP calls or API routes here yet. |
| [AuthProvider.tsx](src/features/auth/AuthProvider.tsx) | Shared account/session state and async actions | Restore verified sessions, handle session changes/expiry, and expose service results through the existing hook. |
| [Root layout](src/app/_layout.tsx) | Startup loading/retry screen, `Stack.Protected`, account-provider mounting | Preserve signed-out routing and the provider remount boundary keyed by account ID. |
| [ProfileContext.tsx](src/state/ProfileContext.tsx) | Initial signup identity and persistent profile edits | Connect reads/updates to the backend profile with Aalvee; profile edits are currently local only. |
| [ProfileScreen.tsx](src/features/profile/ProfileScreen.tsx) | Profile display/edit and logout | Continue using `useAuth().signOut()`; no direct backend calls are needed in this screen. |
| [Auth tests](tests/auth.test.cjs) | Local account behavior and account-isolation checks | Replace adapter-specific tests as needed and retain the account-isolation regression checks. |

### Existing frontend contract

These are the current shapes, not a proposed HTTP API:

```ts
type UserProfile = {
  name: string;
  affiliation: 'Student' | 'Graduate';
  program: string;
};

type Registration = UserProfile & { email: string };

// Currently named DemoAccount internally; that name is not displayed in the UI.
type DemoAccount = {
  id: string;
  email: string;
  initialProfile: UserProfile;
};

// useAuth() returns:
type AuthContextValue = {
  account: DemoAccount | null;
  ready: boolean;
  busy: boolean;
  loadError: string;
  reload: () => void;
  signIn: (email: string) => Promise<void>;
  signUp: (input: Registration) => Promise<void>;
  signOut: () => Promise<void>;
};
```

The hook's actions update context and return no account value to the screens. `AuthProvider` currently calls the store's `restore()`, `signIn(email)`, `signUp(input)`, and `signOut()`, which return an account or `null`. Keep service calls behind this boundary so feature screens do not each manage sessions.

- `ready` stays false until startup restoration succeeds. A successful restore with no active session sets `account` to `null` and `ready` to true; a restoration failure exposes `loadError` and a retry button.
- `busy` covers login/signup/logout. Duplicate submissions are blocked; action errors are thrown to the calling screen, which displays them and preserves its inputs.
- Today, successful signup immediately signs in. For a backend that requires verification, keep `account` null until verification establishes a valid session; add the required pending-verification state and screen rather than opening protected tabs early.
- Screens do not manually push Explore after login. The root reacts to `account` and changes the available routes. Keep this behavior when connecting the backend.
- Frontend validation trims name/program, requires 1–80 name characters and 1–100 program characters, normalizes email by trimming/lowercasing, checks email format with a 254-character maximum, and accepts only `Student` or `Graduate`. Repeat validation on the server. There is currently no UTD-domain restriction or membership verification.

### Integration order and decisions

1. **Agree on the authentication method with Aproteem.** The current screens do not collect passwords, request a code, or handle an email callback. Decide whether the service uses passwords, email codes/links, or another method, then update the input contract and any verification/recovery screens together. The existing email-only lookup must be replaced by actual identity verification.
2. **Add the backend client/adapter.** Implement registration, sign-in/verification, session restoration, and sign-out against the selected service. Map its user to a stable backend-issued `id`, email, and initial profile. The local parser only accepts IDs beginning with `local-`; do not pass backend IDs through that parser. Rename the internal account type if useful, updating its imports in the provider and root layout together.
3. **Connect the session lifecycle.** Update `AuthProvider` on login, logout, token/session refresh, expiry, and revocation. Use the selected service's supported persistence mechanism for each platform; the current account registry is not a token store. Handle unavailable networking separately from an expired/invalid session, and map failures to readable UI messages. Define logout behavior for failed remote revocation versus local session cleanup; the existing local adapter keeps the session when its storage write fails.
4. **Connect profile creation and edits.** Ensure a new authenticated user has a complete `UserProfile` before the main account screens open. Handle partial signup/profile failures so retrying does not create a duplicate account. `initialProfile` currently seeds the profile only; later `updateProfile()` edits do not change the auth registry. Coordinate a backend profile source of truth with Aalvee so later logins do not restore stale signup details.
5. **Preserve account boundaries.** Use the backend user's stable ID for personal-data namespaces. `Stack.Protected` controls navigation only; the server must authorize requests using the verified session and enforce record ownership. A client-provided account ID, email, or `authorId: 'you'` is not proof of ownership.
6. **Document the chosen setup in this README.** Add the actual backend location, service/API contract, required SDK/dependencies, environment variable names, local startup steps, and test-account setup once selected. None are defined in this checkout. Add `.env.example` with placeholders; `.env` and `.env.*` are already ignored and `.env.example` is allowed. Keep server secrets/admin credentials out of the app and repository. If using email links, configure the existing `careercommons` scheme from `app.json` and the applicable web callback URLs.

### Account data and migration

The root mounts personal-data providers only when signed in, under `AccountProviders key={account.id}`. Changing accounts or logging out destroys their in-memory state, forms, and navigation history. Preserve this boundary, including when adding backend session listeners. Token refresh for the same user should retain that user's stable ID.

| Data | Current AsyncStorage key |
| --- | --- |
| Account registry and active session | `transition-explorers.demo-accounts.v1` |
| Profile | `transition-explorers.profile.v1.<accountId>` |
| Posted questions | `transition-explorers.advice.v1.<accountId>` |
| Saved answers | `transition-explorers.saved-advice.v1.<accountId>` |
| Contacts, guidance requests, check-ins | `transition-explorers.network.v1.<accountId>` |

Logging out currently retains each account's saved data for its next login. Pending writes retain the original account's storage key, even after a switch. Backend requests and cached responses must likewise stay attached to the user that started them and must not update a different user's state.

Keys without an account ID belong to the earlier device-wide implementation and are untouched. Local `local-...` account IDs will also differ from backend IDs. Define an explicit migration policy; do not silently erase old records or assign them to a backend account based only on matching email. Connecting authentication alone will not synchronize Profile, questions, Saved, or Circle across devices; those providers still need their own backend data integration. Questions currently use the local ownership marker `authorId: 'you'`; backend records need ownership derived from the authenticated user.

### Validation and handoff checklist

```sh
npm run typecheck
npm test
npm run web
```

`tests/auth.test.cjs` currently covers normalized/duplicate emails, invalid signup, session persistence, logout, failed writes, corrupt storage, all four providers' account isolation, legacy-key preservation, and writes finishing after a switch. These tests exercise the local adapter/providers; they do not establish backend connectivity, token security, or server authorization.

Before merging backend auth, verify on web and the target phone:

- Signup/verification completes once, opens Explore only with a valid session, and Profile shows the registered identity.
- Valid credentials work; invalid credentials, duplicates, service/network failures, and verification failures leave recoverable input/error states.
- Restart restores a valid session. Expired/revoked sessions are handled without leaving protected screens accessible, and session refresh does not switch or reset the user's identity.
- Logout returns to Login. Back navigation and protected deep links cannot reopen tabs, Profile, advice, requests, check-ins, or posted questions while signed out.
- Account A's edited profile, questions, Saved, and Circle remain separate from account B, including when a request finishes after logout or switching accounts.
- Profile edits persist through the backend and subsequent login. Failed signup/profile creation can be retried without a duplicate account or incomplete profile.
- Server-side access checks reject attempts to read/change another user's private records, independently of the route guards.

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

Stop a running server with Ctrl+C. The current local setup needs no backend, API keys, or preconfigured app test credentials; register an account through Signup. Yuji should add the backend-auth environment and startup requirements here when integrating the service. Expo services and physical-iPhone Expo Go access may require an Expo account as described above.

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

Yujie owns Ask for Help and is implementing backend authentication with Aproteem; follow the [authentication backend handoff](#authentication-backend-handoff--yuji) before changing auth contracts, routing, or account IDs. Mourede and Hoa should coordinate edits to the shared Saved flow. Existing feature implementations should be extended in their owners’ modules.

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
- Reuse `AdviceProvider`, `SavedAdviceProvider`, `NetworkProvider`, and `ProfileProvider` for their respective shared data. Each requires an `accountId` and uses AsyncStorage keys ending in that ID. The root mounts these providers only for a signed-in account and remounts them when the account changes; preserve that boundary to prevent stale data or drafts appearing for another account. `AdviceProvider` exposes `postedQuestions`, `postQuestion`, `updateQuestion`, and `deleteQuestion`; use these shared operations so Explore and Profile stay in sync. Question mutations wait for loading and serialize storage writes. Coordinate session or storage changes with Aproteem.
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
- State limitations honestly: fictional data, local storage, simulated accounts and requests/check-ins, and no verified membership or secure authentication.

## References

- [Figma Application Page](https://www.figma.com/design/ylCgauMWXkjb4IL3b4zdQA/?node-id=42-2)
- [Expo project setup and Expo Go SDK guidance](https://docs.expo.dev/get-started/create-a-project/)
- [Expo Router setup](https://docs.expo.dev/router/installation/)
- [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/)

The final Source, ReadMe, and Team PDFs, final presentation, and narrated/subtitled video still need to be prepared by the assigned team members. This repository README is a development guide, not a replacement for those submissions.

## Verification

November 9 account integration: TypeScript, the Ask/Network/Auth automated tests, and Android/iOS/web Metro exports passed. Mobile-sized Chromium checks passed for login validation, signup, profile initialization/edit/persistence, session restoration after reload, logout/back navigation, protected deep links, and switching between accounts, with no observed browser runtime errors. Automated provider checks cover personal-data isolation for Profile, questions, Saved, and Circle, including an old account's write finishing after a switch. After the frontend copy/button cleanup, TypeScript, automated tests, web export, and mobile-sized browser checks also passed, including guidance request review/save and check-in navigation. Physical-phone testing is still required using the [auth handoff checklist](#validation-and-handoff-checklist).

After the SDK 58 upgrade, TypeScript checking, all 20 Expo Doctor checks, and Metro exports for Android, iOS, and web passed. Physical-device testing still needs to be done by the team. npm install reports 8 dependency advisories (5 low and 3 high). These remain unresolved; review compatible fixes separately before applying dependency changes.

Latest integration checks (October 29): TypeScript and Android/iOS/web Metro exports passed. Mobile-sized Chromium checks passed for the complete advice flow, profile validation/edit/cancel/persistence, request review/edit/confirmation, and request-to-Circle-to-check-in integration, with no observed browser runtime errors. Posted-question checks also passed for publication, edit validation, text/topic/visibility changes, persistence, cancel/discard, Explore synchronization, seed protection, and delete confirmation/persistence. The tab alignment was visually checked in a phone-sized browser preview; the red delete styling passed TypeScript checks. See `docs/checkpoint.md` for detailed checks and the physical-phone checklist still to complete.

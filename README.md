# Transition Explorers · Career Commons

CS 4352 DP4 mobile app for UTD students and recent graduates seeking workplace advice and support.

Team: Aalvee Ahtav, Aproteem Majumder, Hoa Doan, Mourede Otchere, Yujie Duan.

## Current implementation

- **Explore:** connected discussion feed, keyword search, topic filters, and question details. The active bottom tab has a centered icon/label inside a rounded lime highlight.
- **Advice and Saved:** individual answer saving, author attribution, saved-state feedback, removal, and undo.
- **Ask:** editable questions, similar experiences, review/edit/publish, and linked follow-ups.
- **People:** graduate search/filtering, profiles, and guidance requests with review/edit/confirm.
- **Your Circle:** contacts, saved requests, check-in scheduling, review, rescheduling, cancellation, and history.
- **Accounts:** local demo signup, email-only login, persisted sessions, and logout from Profile. Signup collects name, email, program, and Student/Graduate affiliation. The app opens Login when signed out and Explore when signed in. Main tabs and detail routes require a demo session.
- **Profile:** the current demo account's editable identity, links to Saved/Your Circle, and **View your posted questions** to view/edit/delete local posts. Edits persist and update Explore; deletion requires confirmation and leaves any follow-ups as independent posts. Seeded community questions cannot be edited or deleted.
- **Storage:** AsyncStorage keeps profile, questions, saved tips, contacts, requests, and check-ins on the device/browser, separated by a stable local account ID.

**Accounts are a simulation, not secure authentication.** Use made-up emails such as `aproteem@example.test`. No passwords are collected, no email is sent, and UTD membership is not verified. Anyone using the same device/browser can open a registered demo account by entering its email. Requests are simulated locally; they do not send messages. Check-ins are personal plans, not confirmed mentor availability. There is no backend or cross-device synchronization. Existing pre-account device-wide data is preserved under its original storage keys, but is not assigned to any new account.

The shared dataset contains **7 graduates, 13 questions, and 30 answers**. Posted questions are local additions, initially without answers.

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

Stop a running server with Ctrl+C. No backend, API keys, or app test credentials are needed for the skeleton. Expo services and physical-iPhone Expo Go access may require an Expo account as described above.

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
| Yujie Duan | `src/features/people/` | People search/filtering, graduate profiles, editable guidance requests |
| Hoa | `src/features/network/` | Connections, mentor details, check-in scheduling and progress |
| Aalvee | `src/features/profile/`, `src/components/`, `src/theme.ts` | User profile, posted-question management, shared components, testing support |
| Agree together | `src/features/saved/` | Saved advice shared by the advice and network flows |

Yujie owns Ask for Help. Mourede and Hoa should coordinate edits to the shared Saved flow. Existing feature implementations should be extended in their owners’ modules.

### Folder map

```text
src/
  app/                 Route registration only
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
- Keep account simulation explicit; do not store real passwords in seed data.
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

### Local account/session integration

`src/features/auth/AuthProvider.tsx` exports `AuthProvider` and `useAuth()` with `account`, `ready`, `busy`, `loadError`, `reload`, `signUp`, `signIn`, and `signOut`. The account registry and active session share one AsyncStorage entry, `transition-explorers.demo-accounts.v1`. Account writes are serialized; failed writes leave the last committed session intact. Unreadable account storage shows a retry screen instead of silently discarding accounts.

`src/state/ProfileContext.tsx` exports `UserProfile`, `ProfileProvider`, and `useProfile()`. Signup supplies the initial profile. Edits persist under `transition-explorers.profile.v1.<accountId>`. `updateProfile` validates and saves name, program, and Student/Graduate affiliation. The signup email identifies the account and is not changed by editing the profile.

Advice, Saved, and Network retain their existing key prefixes and append `.<accountId>`. The `authorId: 'you'` marker is interpreted within that account's private local questions. Seed questions and answers remain shared fictional content. Logging out preserves personal data for the next login, removes access to protected routes, and unmounts account providers and forms. Pending writes keep their original account's namespace. Legacy keys without an account ID are left untouched and are not automatically migrated.

Automated checks cover registration validation, normalized/duplicate emails, session restoration, logout, failed storage writes, corrupt storage, account isolation across all four providers, and writes completing after an account switch.

Manual account checks on the target phone:

1. Start signed out, open signup, check invalid/empty input, and register `aproteem@example.test`.
2. Confirm Explore opens and Profile shows the signup identity. Edit the profile, post a question, save advice, and add a Circle contact.
3. Restart the app; confirm the session and personal data restore.
4. Log out from Profile. Back navigation and direct links to Profile, advice, and other protected routes must return to Login.
5. Create a second account; confirm its profile, questions, Saved, and Circle start independently.
6. Log out and log back into the first account; confirm its edits and personal data remain.

## References

- [Figma Application Page](https://www.figma.com/design/ylCgauMWXkjb4IL3b4zdQA/?node-id=42-2)
- [Expo project setup and Expo Go SDK guidance](https://docs.expo.dev/get-started/create-a-project/)
- [Expo Router setup](https://docs.expo.dev/router/installation/)
- [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/)

The final Source, ReadMe, and Team PDFs, final presentation, and narrated/subtitled video still need to be prepared by the assigned team members. This repository README is a development guide, not a replacement for those submissions.

## Verification

November 9 account integration: TypeScript, the Ask/Network/Auth automated tests, and Android/iOS/web Metro exports passed. Mobile-sized Chromium checks passed for login validation, signup, profile initialization/edit/persistence, session restoration after reload, logout/back navigation, protected deep links, and switching between accounts, with no observed browser runtime errors. Automated provider checks cover personal-data isolation for Profile, questions, Saved, and Circle, including an old account's write finishing after a switch. Physical-phone testing is still required using the account checklist above.

After the SDK 58 upgrade, TypeScript checking, all 20 Expo Doctor checks, and Metro exports for Android, iOS, and web passed. Physical-device testing still needs to be done by the team. npm install reports 8 dependency advisories (5 low and 3 high). These remain unresolved; review compatible fixes separately before applying dependency changes.

Latest integration checks (October 29): TypeScript and Android/iOS/web Metro exports passed. Mobile-sized Chromium checks passed for the complete advice flow, profile validation/edit/cancel/persistence, request review/edit/confirmation, and request-to-Circle-to-check-in integration, with no observed browser runtime errors. Posted-question checks also passed for publication, edit validation, text/topic/visibility changes, persistence, cancel/discard, Explore synchronization, seed protection, and delete confirmation/persistence. The tab alignment was visually checked in a phone-sized browser preview; the red delete styling passed TypeScript checks. See `docs/checkpoint.md` for detailed checks and the physical-phone checklist still to complete.

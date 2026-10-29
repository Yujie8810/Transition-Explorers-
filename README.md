# Transition Explorers · Career Commons

CS 4352 DP4 mobile app for UTD students and recent graduates seeking workplace advice and support.

Team: Aalvee Ahtav, Aproteem Majumder, Hoa Doan, Mourede Otchere, Yujie Duan.

## What this starter contains

- Expo + React Native + TypeScript, with Expo Router navigation.
- Explore, Ask, People, and Saved tabs; a Profile entry in the header.
- Placeholder routes for advice, graduate profiles, requests, Your Circle, check-ins, login, and signup.
- Shared screen/button components and a color palette based on our Figma prototype.
- Shared data types and a small fictional seed dataset.

**This is a skeleton. No task is fully implemented yet.** Search, filtering, saving, posting, account management, help requests, scheduling, and persistence are team implementation work. Preview buttons only navigate. The app starts on Explore so everyone can work before authentication is implemented. This bypass is not a login system.

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

On a physical iPhone, current Expo guidance requires Expo CLI and Expo Go to use the same Expo account. Run `npx expo login` on your computer and sign in to that account in Expo Go. Follow [Expo’s device instructions](https://docs.expo.dev/get-started/start-developing/) for account or connection errors.

This starter uses **Expo SDK 57**. Coordinate SDK upgrades with the team if Expo Go reports a mismatch; do not independently upgrade React Native or Expo packages.

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
| Phone cannot reach the server | Check Wi-Fi/firewall settings or use a personal hotspot. Try `npx expo start --tunnel`; it may request a tunnel helper installation. |
| Old code or Metro cache issues | Stop the server and run `npx expo start --clear`. |
| Expo Go SDK mismatch | Compare the installed app version with this repository’s SDK and coordinate the fix with the team. |
| Emulator/simulator not found | Set up Android Studio or Xcode, or use the phone/browser options instead. |
| Port is already in use | Stop the previous server or accept Expo’s offered alternative port. |

Stop a running server with Ctrl+C. No backend, API keys, or app test credentials are needed for the skeleton. Expo services and physical-iPhone Expo Go access may require an Expo account as described above.

```sh
npm run typecheck
```

Run that command to check TypeScript before sharing changes. It does not replace manually testing your task flow.

## Where each teammate works

| Owner | Main files | Work to implement |
| --- | --- | --- |
| Aproteem | `src/features/auth/`, `src/features/explore/` | Login/signup/logout, home layout; coordinate shared navigation changes |
| Mourede | `src/features/advice/`, `src/features/ask/` | Search, discussions/answers, question posting, saving advice |
| Yujie Duan | `src/features/people/` | People search/filtering, graduate profiles, editable guidance requests |
| Hoa | `src/features/network/` | Connections, mentor details, check-in scheduling and progress |
| Aalvee | `src/features/profile/`, `src/components/`, `src/theme.ts` | User profile, shared components, testing support |
| Agree together | `src/features/saved/` | Saved advice shared by the advice and network flows |

The Ask for Help owner is intentionally unassigned because the planning document left it blank. Assign it before work begins.

### Folder map

```text
src/
  app/                 Route registration only
    (tabs)/            Four bottom tabs
    advice/[id].tsx    Selected discussion route
    people/            Graduate profile and request routes
    network/           Circle and check-in routes
  features/            Actual screens, grouped by module
  components/          Shared Screen, AppButton, FeaturePlaceholder
  data/sampleData.ts   Fictional example records; currently not wired into screens
  types/index.ts       Shared TypeScript contracts
  theme.ts             Shared colors and spacing
```

Search for `need to implment` in `src/` to find comments describing unfinished work and the responsible teammate. The spelling is intentional so everyone can search for the same marker.

Routes re-export feature screens to keep team edits separate. Implement the UI inside your feature folder, replacing `FeaturePlaceholder` as you go. Add more routes/screens for review, confirmation, mentor details, or progress when your flow needs them.

Use `useLocalSearchParams` from `expo-router` to read an `[id]` route parameter and look up the selected record. The starter's preview routes use `first-week` and `taylor`, matching IDs in `sampleData.ts`. They do not yet render the records.

## Shared development rules

- Reuse `Screen`, `AppButton`, and `theme`; coordinate edits to these shared files.
- Keep route files small. Put feature-specific components and logic inside the feature folder.
- Agree on a shared state/persistence approach before wiring saved advice, requests, sessions, or connections. The starter deliberately does not choose a backend or implement storage.
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

The checkpoint needs 2–3 slides and a live demo within 5 minutes. **At least one of the three tasks must work end to end. This starter alone does not meet that requirement.**

Suggested next steps for the team:

1. Confirm ownership for Ask for Help and Saved, and choose the checkpoint task.
2. A practical first task is Explore → select a topic/post → read advice → save a specific answer → reopen it in Saved.
3. Agree on the sample data and how saving state will be shared between Explore and Saved.
4. Implement that complete flow and resolve its DP3 issues: back navigation, clear save selection, visible saved state, and consistent author names/initials.
5. Show honest progress on other modules and document remaining work through November 15.
6. Prepare slides with title, platform/tools, three tasks, implementation status/timeline, hardcoded data, and GitHub URL.

Do not add extra features just to fill the skeleton. Prioritize the agreed task flows and DP3 feedback.

## References

- [Figma Application Page](https://www.figma.com/design/ylCgauMWXkjb4IL3b4zdQA/?node-id=42-2)
- [Expo project setup and Expo Go SDK guidance](https://docs.expo.dev/get-started/create-a-project/)
- [Expo Router setup](https://docs.expo.dev/router/installation/)
- [Expo Router navigation](https://docs.expo.dev/router/basics/navigation/)

The final Source, ReadMe, and Team PDFs, final presentation, and narrated/subtitled video still need to be prepared by the assigned team members. This repository README is a development guide, not a replacement for those submissions.

## Verification at setup

TypeScript checking and Metro exports for Android, iOS, and web passed. Physical-device testing still needs to be done by the team. npm audit reports 11 dependency advisories, including high-severity findings propagated from Zod through Expo CLI. Its suggested forced fix downgrades Expo across SDK versions, so it was not applied. Review compatible upstream fixes when updating the SDK.

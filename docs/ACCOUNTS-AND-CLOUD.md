# Optional accounts and cloud connections

All PDF features work as a guest. Account and cloud buttons become active only when real owner-controlled public configuration is provided. There are no fake sign-in sessions, embedded shared credentials, or document-upload processing servers.

Copy `.env.example` to an ignored `.env.local`, or edit `public/pocket-config.json` with public browser values. For deployment, prefer repository/build variables. No browser configuration should contain a client secret, service-account key, or admin credential.

## Firebase Authentication

Create a Firebase project on the Spark plan if it is available for your account. Firebase lists no-payment-method options for email and social authentication; phone/SMS is a different billed feature and is not used here. [Pricing](https://firebase.google.com/pricing), [web setup](https://firebase.google.com/docs/auth/web/start).

1. Register a web app and copy its `apiKey`, `authDomain`, `projectId`, and `appId` into `VITE_FIREBASE_CONFIG` as one JSON object, or the `firebase` object in `pocket-config.json`.
2. Enable Email/Password and optionally Google in Authentication → Sign-in method.
3. Add the production website hostname to authorized domains. Add `localhost` explicitly for local testing if needed.
4. Configure email templates, email deliverability, rate limits, and any account protections required by your deployment.
5. Test sign-up, sign-in, verification, password reset, sign-out, and an unauthorized-domain failure using test accounts.

The app uses the official Firebase browser SDK with session persistence. A signed-in profile does not synchronize local documents or annotation drafts. Optional cloud file connections below are separate from the app account.

## Google Drive

Google’s [Picker guide](https://developers.google.com/workspace/drive/picker/guides/web-picker-sample) requires a Cloud project, enabled Drive/Picker APIs, a browser API key, an OAuth web client ID, and the project number. Configure the consent screen and exact authorized JavaScript origins. Restrict the API key to your website origins and intended APIs.

Set `VITE_GOOGLE_CLIENT_ID`, `VITE_GOOGLE_API_KEY`, and `VITE_GOOGLE_APP_ID` (the project number). Pocket requests the non-sensitive `drive.file` scope, which limits access to selected/created files. Picker lets users choose source files; native Google documents are exported to PDF for import. Outputs upload directly to Drive using resumable upload chunks and unique names. Tokens stay in memory for the current app session.

Provider testing/publishing requirements and organizational policies can affect who can connect. [Scopes](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [browser token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [uploads](https://developers.google.com/workspace/drive/api/guides/manage-uploads).

## Microsoft OneDrive

Register an application in Microsoft Entra. Choose the supported account types you need and register the **Single-page application** redirect:

```text
https://YOUR-ACTUAL-ORIGIN/redirect.html
```

Set `VITE_MICROSOFT_CLIENT_ID` and optionally `VITE_MICROSOFT_TENANT` (`common` by default). Do not create or embed a SPA client secret. Pocket uses official MSAL Browser v5 authorization-code/PKCE popup flows and its dedicated redirect bridge. The bridge must not be wrapped in the React application or served with COOP headers. [MSAL bridge](https://learn.microsoft.com/en-us/entra/msal/javascript/browser/redirect-bridge), [authorization-code flow](https://learn.microsoft.com/en-us/entra/identity-platform/v2-oauth2-auth-code-flow).

Import requests delegated `Files.Read`; export requests `Files.ReadWrite`. An organizational tenant may require administrator approval. Users can browse folders and import selected files. Saving creates a uniquely named copy in their drive. The current folder list shows up to 200 items; use narrower folders or the system picker for larger collections. [Graph uploads](https://learn.microsoft.com/en-us/graph/api/driveitem-put-content).

## iCloud, Dropbox, and other device providers

The Files option uses the operating system’s file picker/share sheet. It can access providers installed and enabled by the user on that device. This does not claim that Pocket implements a separate Dropbox or iCloud OAuth service. Availability depends on the OS and browser.

## Verification boundary

Type checking, build checks, and local UI checks do not prove live OAuth correctness. A configured owner-owned project and real test-provider account are required to verify each sign-in/import/export flow. Leave unconfigured services clearly marked until that setup is complete.

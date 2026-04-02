# FE-BE Auth Integration Log

## Session Date
- 2026-04-01

## Objective
- Connect frontend and backend authentication flow for user registration and login.
- Remove frontend local auth fallback for production-like integration.

## Changes Implemented

### 1) Frontend auth provider now uses backend-only auth flow
- File: `Main_Project/FE/src/stores/AuthContext.jsx`
- Removed local auth fallback (`localDataStore`) for `login` and `register`.
- `register` now calls `POST /api/auth/register` then performs real `login`.
- Added profile hydration via `GET /api/auth/me` after login and on app startup.
- Session persistence now uses a dedicated helper to avoid inconsistent token/user state.

### 1.1) Auth context/hook split for stable React Fast Refresh
- File: `Main_Project/FE/src/stores/authContextObject.js`
- File: `Main_Project/FE/src/stores/useAuth.js`
- Kept provider logic inside `AuthContext.jsx` and moved context object + hook to dedicated modules.
- Updated imports in pages/components to use `useAuth` from `src/stores/useAuth.js`.

### 2) Axios client now supports automatic token refresh
- File: `Main_Project/FE/src/api/httpClient.js`
- Added response interceptor to handle `401` on protected APIs.
- Added single-flight refresh flow using `POST /api/auth/refresh`.
- Updated local storage tokens when refresh succeeds.
- Clears auth session when refresh fails.

### 3) Environment template for API base URL
- File: `Main_Project/FE/.env.example`
- Added `VITE_API_BASE_URL=http://localhost:8000`.

## Backend contract used in this implementation
- `POST /api/auth/register` -> creates user (returns user model)
- `POST /api/auth/login` -> returns `{ access_token, refresh_token, token_type }`
- `POST /api/auth/refresh` -> returns new tokens
- `GET /api/auth/me` -> returns current user profile

## Verification checklist (for manual run)
- [ ] Backend running and DB connected.
- [ ] Frontend has `.env` with correct `VITE_API_BASE_URL`.
- [ ] Register a new account from frontend.
- [ ] Login redirects to protected pages.
- [ ] Refresh page keeps session.
- [ ] Expired access token triggers auto refresh.
- [ ] Invalid refresh token logs user out.

## Completed verification in this session
- Lint check on modified auth files: PASS.
- Command used: `npx eslint src/stores/AuthContext.jsx src/stores/useAuth.js src/stores/authContextObject.js src/api/httpClient.js src/App.jsx src/pages/LoginPage.jsx src/pages/SignUpPage.jsx src/pages/AccountSettingsPage.jsx src/components/management/ManagementSidebar.jsx`

## Runtime connectivity check (2026-04-01)
- Backend started successfully with MySQL connected.
- Backend terminal id: `54e53117-ac48-4aaa-85f9-5d52bc73e3bf`.
- Backend URL: `http://127.0.0.1:8000`.
- Frontend started successfully and points to backend via environment variable.
- Frontend terminal id: `727ef8cc-6492-4a1a-b5cb-06516f812295`.
- Frontend URL: `http://127.0.0.1:5173/`.

### API E2E evidence
- Flow tested: `register -> login -> me`.
- Result:
	- `registered_email`: `autotest_20260401_150046@example.com`
	- `login_access_token`: `True`
	- `login_refresh_token`: `True`
	- `me_email`: `autotest_20260401_150046@example.com`
- Conclusion: backend auth endpoints are connected and functional for signup/signin flow.

## Next planned implementation steps
- Standardize auth error message mapping in UI.
- Add backend tests for auth endpoints and token lifecycle.
- Add FE integration test cases for login/register/refresh/logout.

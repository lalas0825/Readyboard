# Mobile Build Checklist — Expo SDK 52 + Turborepo Monorepo

Every step in order. Skip nothing.

## Pre-Build Setup

### 1. Node Version — USE NODE 20 LTS
```bash
nvm install 20
nvm use 20
node --version  # must be v20.x.x
```
**Why:** Node 25 (and 23+) breaks `exports` maps in metro-cache, metro-transform-worker, and @expo/metro-config. Expo SDK 52 is only compatible with Node 18-20.

**How to apply:** Always switch to Node 20 before any Expo/EAS work. Install nvm-windows from https://github.com/coreybutler/nvm-windows/releases

### 2. Monorepo Dependencies — Fix Hoisting Issues
Add these to ROOT `package.json` dependencies:
```json
{
  "dependencies": {
    "ajv": "^8.18.0",
    "schema-utils": "^4.3.3"
  }
}
```
**Why:** Expo plugins (expo-router, expo-location, expo-camera) get hoisted to monorepo root. They require `ajv` and `schema-utils` which don't get hoisted with them. EAS CLI resolves plugins from root and crashes with "Cannot find module".

**How to apply:** Never add `expo` or `metro-*` packages to root — only add the missing transitive deps that plugins need.

### 3. Expo Must Be in Mobile Workspace
Verify `expo` is in `apps/mobile/package.json` dependencies:
```json
{ "dependencies": { "expo": "~52.0.0" } }
```
**Why:** `expo install --fix` can accidentally remove `expo` from dependencies. Without it, `expo/config-plugins` can't resolve and EAS CLI fails.

### 4. EAS CLI — Install Locally, Not Just Global
```bash
cd apps/mobile
npm install eas-cli --save-dev
npx eas build ...  # use npx, not global eas
```
**Why:** Global EAS CLI resolves modules from its own install path, not from your project. Local install resolves from workspace node_modules correctly.

### 5. EAS Init — Create Project First
```bash
cd apps/mobile
eas init  # creates project on expo.dev, generates UUID
```
**Why:** Running `eas build` without init fails with "EAS project not configured". The init creates `extra.eas.projectId` in app.json with a valid UUID. Don't set it manually — let `eas init` generate it.

## app.json Required Fields
```json
{
  "expo": {
    "name": "AppName",
    "slug": "appname",
    "version": "0.1.0",
    "icon": "./assets/icon.png",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#0f172a"
    },
    "android": {
      "package": "com.company.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      }
    },
    "ios": {
      "bundleIdentifier": "com.company.app",
      "buildNumber": "1"
    },
    "extra": {
      "eas": { "projectId": "uuid-from-eas-init" }
    }
  }
}
```

## Assets Required
| Asset | Size | Purpose |
|-------|------|---------|
| `icon.png` | 1024x1024 | App icon (both platforms) |
| `adaptive-icon.png` | 1024x1024 | Android adaptive foreground (with safe zone margins) |
| `splash.png` | 1284x2778 | Splash screen |
| `notification-icon.png` | 96x96 | Push notification (white on transparent) |

Generate with sharp if no designer assets available:
```js
const sharp = require('sharp');
sharp(Buffer.from(svgString)).png().toFile('assets/icon.png');
```

## eas.json Configuration
```json
{
  "cli": { "version": ">= 12.0.0", "appVersionSource": "local" },
  "build": {
    "preview": {
      "distribution": "internal",
      "node": "18.18.0",
      "android": { "buildType": "apk" },
      "ios": { "simulator": true },
      "env": {
        "EXPO_PUBLIC_SUPABASE_URL": "https://xxx.supabase.co",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "eyJ..."
      }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "autoIncrement": true }
    }
  },
  "submit": { "production": {} }
}
```
**Critical:** `env` block in eas.json is required! EAS Build does NOT read `.env` files. Without env vars, the app crashes with "supabaseUrl is required".

**Critical:** Don't leave empty strings in submit config (`"appleId": ""`). EAS validates and rejects them.

## Build Commands
```bash
cd apps/mobile

# Preview (APK for testing)
npx eas build --profile preview --platform android

# Production (AAB for Play Store)
npx eas build --profile production --platform android

# iOS (requires Apple Developer $99/yr)
npx eas build --profile preview --platform ios
```

## Post-Build Issues

### App Crashes Immediately — "supabaseUrl is required"
**Fix:** Add env vars to `eas.json` preview profile `env` block.

### White Screen — "Attempted to navigate before mounting Root Layout"
**Fix:** Replace imperative `router.replace()` in layouts with declarative `<Redirect href="..." />` from expo-router.
```tsx
// BAD — crashes
useEffect(() => { if (!session) router.replace('/login'); }, []);

// GOOD — works
if (!session) return <Redirect href="/login" />;
```

### Status Bar Overlap on Android
**Fix:** Replace `SafeAreaView` with `View` + manual padding:
```tsx
import { StatusBar, Platform } from 'react-native';
// In styles:
paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 4 : 0
```

### "No areas assigned" / "Offline"
**Fix:** PowerSync configuration in dashboard:
1. Client Auth → check "Use Supabase Auth" → paste JWT Secret from Supabase Settings → JWT Keys → Legacy
2. Sync Rules → deploy valid sync rules (no JOINs in parameter queries, no subqueries in data queries)

## PowerSync Sync Rules — What Works
PowerSync has very limited SQL:
- Parameter queries: single table only, no JOINs, no aliases
- Data queries: single table with `WHERE column = bucket.param`, no subqueries, no JOINs

**Working pattern:**
```yaml
bucket_definitions:
  by_user:
    parameters:
      - SELECT token_parameters.user_id as id
    data:
      - SELECT * FROM users WHERE id = bucket.id
      - SELECT * FROM user_assignments WHERE user_id = bucket.id

  by_area:
    parameters:
      - SELECT user_assignments.area_id as id FROM user_assignments WHERE user_assignments.user_id = token_parameters.user_id
    data:
      - SELECT * FROM areas WHERE id = bucket.id
      - SELECT * FROM area_trade_status WHERE area_id = bucket.id
      - SELECT * FROM area_tasks WHERE area_id = bucket.id
      - SELECT * FROM delay_logs WHERE area_id = bucket.id
```

**Does NOT work:**
- `SELECT a.id FROM areas a INNER JOIN ...` in parameters (no aliases)
- `WHERE area_id IN (SELECT ...)` in data queries (no subqueries)
- Multi-table JOINs anywhere

## Auth — Creating Demo Users
Never INSERT directly into `auth.users` — the password hash and identity records won't work.
Always use Admin API:
```js
const { data } = await supabase.auth.admin.createUser({
  email: 'demo@app.com',
  password: 'Password123!',
  email_confirm: true,
  user_metadata: { name: 'Demo User', role: 'foreman' }
});
```
Then update the profile in `public.users` with correct role/org.

## Error Reference
| Error | Cause | Fix |
|-------|-------|-----|
| `Cannot find module 'expo/config-plugins'` | expo not in workspace deps | Add `expo` to mobile package.json |
| `Package subpath './src/stores/FileStore'` | Node 25 incompatible | `nvm use 20` |
| `Cannot find module 'ajv/dist/compile/codegen'` | Hoisting gap in monorepo | Add `ajv` + `schema-utils` to root |
| `eas.json is not valid` (empty fields) | Empty strings in submit config | Remove or fill submit.ios fields |
| `EAS project not configured` | Missing projectId | Run `eas init` first |
| `supabaseUrl is required` (runtime crash) | No env vars in build | Add `env` block to eas.json |
| `Attempted to navigate before mounting` | Imperative router in layout | Use `<Redirect>` component |
| `Database error querying schema` (auth) | User created via SQL INSERT | Use `supabase.auth.admin.createUser()` |
| PowerSync "Offline" forever | JWT Secret not configured | Client Auth → Use Supabase Auth → paste JWT secret |

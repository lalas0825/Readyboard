# EAS Build — Monorepo Setup Guide

> Documentación de la configuración que funciona para ReadyBoard.
> Referencia para futuros proyectos con Turborepo + Expo SDK 52.

## El Problema

En monorepos con npm workspaces, npm "hoistea" las dependencias a la raíz.
Expo plugins (`expo-router`, `expo-location`, etc.) se resuelven desde la raíz,
pero sus transitive dependencies (`expo/config-plugins`, `ajv`, `schema-utils`, `metro-cache`)
no están ahí. EAS CLI falla con "Cannot find module" errors en cadena.

## La Solución (4 pasos)

### 1. Node 20 LTS (obligatorio)

Expo SDK 52 NO es compatible con Node 25. Instalar NVM:
- Windows: https://github.com/coreybutler/nvm-windows/releases
- Mac/Linux: `curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash`

```bash
nvm install 20
nvm use 20
node --version  # debe ser v20.x.x
```

### 2. Dependencias en la raíz del monorepo

Agregar en `package.json` raíz las deps que los Expo plugins necesitan resolver:

```json
{
  "dependencies": {
    "ajv": "^8.18.0",
    "schema-utils": "^4.3.3"
  }
}
```

NO agregar `expo`, `metro`, o `metro-*` en la raíz — causan conflictos de versión.

### 3. `expo` en el workspace del mobile

Asegurar que `expo` está en `apps/mobile/package.json` dependencies:

```json
{
  "dependencies": {
    "expo": "~52.0.0"
  }
}
```

### 4. EAS CLI local (no global)

Instalar en el workspace para que resuelva módulos correctamente:

```bash
cd apps/mobile
npm install eas-cli --save-dev
npx eas build --profile preview --platform android
```

## eas.json que funciona

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "local"
  },
  "build": {
    "preview": {
      "distribution": "internal",
      "node": "18.18.0",
      "android": { "buildType": "apk" },
      "ios": { "simulator": true }
    },
    "production": {
      "android": { "buildType": "app-bundle" },
      "ios": { "autoIncrement": true }
    }
  }
}
```

Nota: `"node": "18.18.0"` en preview fuerza Node 18 en el build server de EAS.

## app.json campos requeridos

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "splash": { "image": "./assets/splash.png", "backgroundColor": "#0f172a" },
    "android": {
      "package": "com.your.app",
      "versionCode": 1,
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#0f172a"
      }
    },
    "ios": {
      "bundleIdentifier": "com.your.app",
      "buildNumber": "1"
    },
    "extra": {
      "eas": { "projectId": "uuid-from-eas-init" }
    }
  }
}
```

## Assets requeridos

| Asset | Tamaño | Uso |
|-------|--------|-----|
| `icon.png` | 1024x1024 | App icon (ambas plataformas) |
| `adaptive-icon.png` | 1024x1024 | Android adaptive icon foreground |
| `splash.png` | 1284x2778 | Splash screen |
| `notification-icon.png` | 96x96 | Push notification icon (blanco sobre transparente) |

## Comandos

```bash
# Primer setup
cd apps/mobile
eas init                    # crea proyecto en Expo
eas login                   # si no estás logueado

# Build preview (APK para testing)
npx eas build --profile preview --platform android

# Build producción (AAB para Play Store)
npx eas build --profile production --platform android

# Build iOS (requiere Apple Developer $99/yr)
npx eas build --profile preview --platform ios
```

## Troubleshooting

| Error | Causa | Fix |
|-------|-------|-----|
| `Cannot find module 'expo/config-plugins'` | expo no está en dependencies | `npm install expo` en mobile workspace |
| `Package subpath './src/stores/FileStore'` | Node 25 incompatible | `nvm use 20` |
| `Cannot find module 'ajv/dist/compile/codegen'` | Hoisting roto en monorepo | Agregar `ajv` + `schema-utils` en raíz |
| `eas.json is not valid` (empty fields) | Campos vacíos en submit | Quitar o llenar `submit.production.ios` |

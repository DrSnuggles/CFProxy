# Cloudflare worker proxy

## Why
Started from the need to have own proxy to circumvent problems caused by CORS and mixed content.

## Build
npm install --save-dev webpack

npm install --save uzip

npm run build

## History
  - v5: Unzip using UZIP
  - v4: Try unzip using JSZip
  - v3: Try to unzip use imaya
  - v2: Following 301 perm moved status and try to unzip use imaya
  - v1: Simple proxy following 302 temp. moved status

## Licenses
UZIP is licensed under MIT, so do i

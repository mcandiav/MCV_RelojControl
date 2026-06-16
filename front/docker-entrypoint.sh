#!/bin/sh
set -e

BUILD_PATH="${VUE_APP_BUILD_PATH:-default}"
VERSION="${VUE_APP_BUILD_VERSION:-}"

if [ -z "$VERSION" ] && [ -f /usr/share/nginx/html/BUILD_VERSION.txt ]; then
  VERSION="$(tr -d '\r\n' < /usr/share/nginx/html/BUILD_VERSION.txt)"
fi

{
  printf "window.__CRONOMETRO_BUILD_PATH__='%s';\n" "$BUILD_PATH"
  printf "window.__CRONOMETRO_BUILD_VERSION__='%s';\n" "$VERSION"
} > /usr/share/nginx/html/build-config.js

exec nginx -g 'daemon off;'

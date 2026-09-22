#!/bin/sh
set -eu
envsubst '$PORT' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf
# Sidecar for Tagline Scout (admin → /.netlify/functions/tagline-search)
# Server resolves ../netlify/functions relative to scripts/ under /opt/keyhole
cd /opt/keyhole
node /opt/keyhole/scripts/tagline-search-server.js &
exec nginx -g 'daemon off;'

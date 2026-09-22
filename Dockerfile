FROM nginx:alpine
RUN apk add --no-cache nodejs
COPY . /usr/share/nginx/html/
# Sidecar sources live outside the public web root
RUN mkdir -p /opt/keyhole \
 && cp -R /usr/share/nginx/html/scripts /opt/keyhole/scripts \
 && cp -R /usr/share/nginx/html/netlify /opt/keyhole/netlify \
 && chmod +x /opt/keyhole/scripts/docker-start.sh /opt/keyhole/scripts/tagline-search-server.js
ARG BACKEND_ORIGIN=https://sorority-house-production-aeb5.up.railway.app
# Only $PORT is left for runtime substitution (Railway's start command substitutes just that).
RUN rm -f /etc/nginx/conf.d/default.conf \
 && envsubst '$BACKEND_ORIGIN' < /usr/share/nginx/html/nginx.conf.template > /etc/nginx/default.conf.template \
 && rm /usr/share/nginx/html/nginx.conf.template
ENV PORT=80
ENV TAGLINE_SCOUT_PORT=3456
ENV TAGLINE_SCOUT_HOST=127.0.0.1
EXPOSE 80
CMD ["/bin/sh", "/usr/share/nginx/html/scripts/docker-start.sh"]

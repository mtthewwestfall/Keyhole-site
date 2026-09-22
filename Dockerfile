FROM nginx:alpine
COPY . /usr/share/nginx/html/
ARG BACKEND_ORIGIN=https://sorority-house-production-aeb5.up.railway.app
# Only $PORT is left for runtime substitution (Railway's start command substitutes just that).
RUN rm -f /etc/nginx/conf.d/default.conf \
 && envsubst '$BACKEND_ORIGIN' < /usr/share/nginx/html/nginx.conf.template > /etc/nginx/default.conf.template \
 && rm /usr/share/nginx/html/nginx.conf.template
ENV PORT=80
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]

FROM nginx:alpine
COPY . /usr/share/nginx/html/
RUN rm -f /etc/nginx/conf.d/default.conf && mv /usr/share/nginx/html/nginx.conf.template /etc/nginx/default.conf.template
ENV PORT=80
ENV BACKEND_ORIGIN=https://sorority-house-production-aeb5.up.railway.app
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '$PORT $BACKEND_ORIGIN' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]

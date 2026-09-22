FROM nginx:alpine
COPY . /usr/share/nginx/html/
RUN rm -f /etc/nginx/conf.d/default.conf && printf 'server {\n  listen ${PORT};\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/default.conf.template
ENV PORT=80
EXPOSE 80
CMD ["/bin/sh", "-c", "envsubst '$PORT' < /etc/nginx/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]

FROM nginx:alpine
COPY . /usr/share/nginx/html/
RUN rm -f /etc/nginx/conf.d/default.conf && mkdir -p /etc/nginx/templates && printf 'server {\n  listen ${PORT};\n  server_name _;\n  root /usr/share/nginx/html;\n  index index.html;\n  location / { try_files $uri $uri/ /index.html; }\n}\n' > /etc/nginx/templates/default.conf.template
ENV PORT=80
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]


FROM nginx:stable-alpine

COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY public/ /usr/share/nginx/html/

ENV BACKEND_URL=http://backend:8080
EXPOSE 80

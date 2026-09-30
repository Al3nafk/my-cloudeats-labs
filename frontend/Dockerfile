# Start from the official nginx image (Alpine Linux variant)
FROM nginx:alpine

# Copy your HTML and CSS files into nginx's web root
COPY html/ /usr/share/nginx/html/
COPY css/  /usr/share/nginx/html/css/

# Tell Docker this container listens on port 80
EXPOSE 80
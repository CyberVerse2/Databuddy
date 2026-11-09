FROM nginx:1.29-alpine
ARG TRACKER_API_URL=https://databuddy-basket.cyberverse.cloud
COPY openship/tracker/dist/ /usr/share/nginx/html/
RUN for f in /usr/share/nginx/html/*.js; do { printf 'window.databuddyConfig={apiUrl:"%s",...window.databuddyConfig};\n' "$TRACKER_API_URL"; cat "$f"; } > "$f.tmp" && mv "$f.tmp" "$f"; done
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q --spider http://127.0.0.1/databuddy.js || exit 1

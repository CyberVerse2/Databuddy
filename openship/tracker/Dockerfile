FROM oven/bun:1.4.1-slim AS builder
WORKDIR /app
COPY package.json bun.lock turbo.json ./
COPY packages ./packages
COPY apps ./apps
COPY tsconfig ./tsconfig
RUN bun install --frozen-lockfile --ignore-scripts
RUN bun run --cwd packages/tracker build
ARG TRACKER_API_URL=https://databuddy-basket.cyberverse.cloud
# Configure the official tracker's documented global options for existing snippets.
RUN bun -e 'const fs=require("fs"); const dir="packages/tracker/dist"; const prefix="window.databuddyConfig={apiUrl:"+JSON.stringify(process.env.TRACKER_API_URL)+",...window.databuddyConfig};\n"; for(const f of fs.readdirSync(dir).filter(f=>f.endsWith(".js"))) fs.writeFileSync(dir+"/"+f,prefix+fs.readFileSync(dir+"/"+f,"utf8"));'
FROM nginx:1.29-alpine
COPY --from=builder /app/packages/tracker/dist/ /usr/share/nginx/html/
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 CMD wget -q --spider http://127.0.0.1/databuddy.js || exit 1

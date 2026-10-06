# syntax=docker/dockerfile:1

FROM node:25-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npm run build

# Alpine (slim-app-image): an 8 MB base instead of Debian's 108 MB. better-sqlite3 ships
# its musl build. The converter's image is Alpine too (ffmpeg, poppler).
FROM node:26-alpine
WORKDIR /app
# Where users find this version's source code (AGPL): the repository, and the commit.
ARG SOURCE_URL=""
ARG GIT_COMMIT=""
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/data/norless.db \
  SOURCE_URL=$SOURCE_URL GIT_COMMIT=$GIT_COMMIT
# Plain Node: files from people and the internet are read by the converter's image
# (src/converter, add-converter).
RUN mkdir /data && chown node:node /data
VOLUME /data
COPY package.json package-lock.json .npmrc ./
# Then what only installing needs goes: npm, corepack and yarn (the image runs `node`
# and `sh` only), and better-sqlite3's SQLite sources and other platforms' builds.
RUN npm ci --omit=dev && npm cache clean --force \
  && cd node_modules/better-sqlite3 \
  && rm -rf deps src binding.gyp \
  && find prebuilds lib -maxdepth 1 \( -name 'darwin-*' -o -name 'linux-*' -o -name 'win32-*' \) -delete \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack /opt/yarn* \
    /usr/local/bin/yarn /usr/local/bin/yarnpkg /root/.npm
COPY --from=build /app/dist ./dist
COPY migrations ./migrations
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "dist/server/index.js"]

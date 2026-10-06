# syntax=docker/dockerfile:1
# The converter (add-converter): the tools that read files from people and the internet,
# apart from the app's image and its data. Built from this folder only:
#   docker build -t norless-converter src/converter
# Alpine (pdf-only-slides): its ffmpeg is a quarter of Debian's, which pulls in X11 and
# Vulkan; with PDFs only, no LibreOffice.
FROM node:24-alpine
# ffmpeg: recordings and pictures; poppler and fonts metric-compatible with Arial and
# Times New Roman, for PDFs that don't embed theirs: slides from files.
RUN apk add --no-cache ffmpeg poppler-utils font-liberation font-dejavu
WORKDIR /converter
COPY server.ts ./
# The root is read-only: fontconfig writes its cache to /tmp.
ENV NODE_ENV=production PORT=3900 HOME=/tmp
USER node
EXPOSE 3900
HEALTHCHECK --interval=30s --timeout=5s \
  CMD node -e "fetch('http://127.0.0.1:3900/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["node", "server.ts"]

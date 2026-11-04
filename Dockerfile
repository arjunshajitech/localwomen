# Localwomen has no npm dependencies, so the image only needs the Node runtime.
# Plain Alpine + the nodejs package (no npm/yarn/corepack) is much smaller than node:alpine.
FROM alpine:3.22

RUN apk add --no-cache nodejs \
 && adduser -D -H -u 1000 app

ENV HOST=0.0.0.0 PORT=3000
WORKDIR /app
COPY server.js ./
COPY public ./public

USER app
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:$PORT/ >/dev/null || exit 1

CMD ["node", "server.js"]

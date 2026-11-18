FROM oven/bun:1.2-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

FROM base AS runtime
RUN addgroup -S metaflux && adduser -S metaflux -G metaflux && mkdir -p /data && chown metaflux:metaflux /data
COPY --from=deps /app/node_modules ./node_modules
COPY package.json tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
COPY docs ./docs
COPY README.md LICENSE ./
USER metaflux
ENV HOST=0.0.0.0 PORT=8787 METAFLUX_DB=/data/metaflux.sqlite METAFLUX_LOG=info
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["bun", "src/index.ts"]

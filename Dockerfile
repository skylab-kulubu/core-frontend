FROM --platform=linux/amd64 node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
ENV HUSKY=0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM --platform=linux/amd64 node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1 HUSKY=0
ARG NEXT_PUBLIC_API_URL=https://api.yildizskylab.com
ARG NEXT_PUBLIC_CMS_URL=https://api.yildizskylab.com/api
ARG NEXT_PUBLIC_APP_URL=https://admin.yildizskylab.com
ARG NEXT_PUBLIC_OAUTH2_CLIENT_ID=
ARG NEXT_PUBLIC_OAUTH2_REDIRECT_URI=https://admin.yildizskylab.com/api/auth/callback
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CMS_URL=$NEXT_PUBLIC_CMS_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_OAUTH2_CLIENT_ID=$NEXT_PUBLIC_OAUTH2_CLIENT_ID
ENV NEXT_PUBLIC_OAUTH2_REDIRECT_URI=$NEXT_PUBLIC_OAUTH2_REDIRECT_URI
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm run build

FROM --platform=linux/amd64 node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

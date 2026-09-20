FROM --platform=linux/amd64 node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
ENV HUSKY=0
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

FROM --platform=linux/amd64 node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
ENV NEXT_TELEMETRY_DISABLED=1 HUSKY=0
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_CMS_URL
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_FORMS_ADMIN_URL
ARG NEXT_PUBLIC_MAIL_URL
ARG NEXT_PUBLIC_SHORT_ORIGIN
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CMS_URL=$NEXT_PUBLIC_CMS_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_FORMS_ADMIN_URL=$NEXT_PUBLIC_FORMS_ADMIN_URL
ENV NEXT_PUBLIC_MAIL_URL=$NEXT_PUBLIC_MAIL_URL
ENV NEXT_PUBLIC_SHORT_ORIGIN=$NEXT_PUBLIC_SHORT_ORIGIN
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN test -n "$NEXT_PUBLIC_API_URL" \
    && test -n "$NEXT_PUBLIC_CMS_URL" \
    && test -n "$NEXT_PUBLIC_ADMIN_URL" \
    && test -n "$NEXT_PUBLIC_FORMS_ADMIN_URL" \
    && test -n "$NEXT_PUBLIC_MAIL_URL" \
    && test -n "$NEXT_PUBLIC_SHORT_ORIGIN" \
    && pnpm run build

FROM --platform=linux/amd64 node:22-alpine
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

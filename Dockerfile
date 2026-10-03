# Build the skylcn-ui playground into the image only with --build-arg
# NEXT_PUBLIC_INCLUDE_PLAYGROUND=true (the sandbox workflow does; production
# never does). Anything but true or false stops the build.
ARG NEXT_PUBLIC_INCLUDE_PLAYGROUND=false

FROM --platform=linux/amd64 node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
ENV HUSKY=0
# pnpm-workspace.yaml carries the install policy (allowed builds, release-age exceptions)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile --ignore-scripts

# The skylcn-ui playground, served under /playground until the club wiki takes
# it over. It runs its own dependency tree and install scripts and /playground
# shares this app's origin, so it is built in only when the flag above is true;
# otherwise BuildKit never runs this stage. Pinned to a skylcn-ui commit: bump
# SKYLCN_UI_REF to update it; to remove it for good, drop the two playground
# stages, their COPY line below, the rewrites in next.config.ts and the
# Playground entry in AdminSidebar.tsx.
FROM --platform=linux/amd64 node:22-alpine AS playground-true
WORKDIR /src
RUN apk add --no-cache git && corepack enable
ARG SKYLCN_UI_REF=cd97bacc38670be9e0535d29c3e231204429efd0
ARG NEXT_PUBLIC_ADMIN_URL
ARG NEXT_PUBLIC_FORMS_ADMIN_URL
ARG NEXT_PUBLIC_MAIL_URL
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_DOCS_HOST=admin \
    NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL \
    NEXT_PUBLIC_FORMS_ADMIN_URL=$NEXT_PUBLIC_FORMS_ADMIN_URL \
    NEXT_PUBLIC_MAIL_URL=$NEXT_PUBLIC_MAIL_URL
RUN git init -q ui && cd ui \
    && git fetch -q --depth 1 https://github.com/skylab-kulubu/skylcn-ui.git "$SKYLCN_UI_REF" \
    && git checkout -q FETCH_HEAD \
    && pnpm install --frozen-lockfile \
    && pnpm --filter @skylab-kulubu/skylcn-ui build \
    && pnpm --filter docs build \
    && mkdir -p /out/playground-assets \
    && mv apps/docs/out/playground apps/docs/out/playground.html apps/docs/out/playground.txt /out/ \
    && mv apps/docs/out/_next /out/playground-assets/_next

# No playground: an empty /out for the final COPY
FROM --platform=linux/amd64 node:22-alpine AS playground-false
RUN mkdir /out

FROM playground-${NEXT_PUBLIC_INCLUDE_PLAYGROUND} AS playground

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
# Optional: the dashboard hides its GitHub section without it
ARG NEXT_PUBLIC_GITHUB_ACTIVITY_URL
ARG NEXT_PUBLIC_INCLUDE_PLAYGROUND
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_CMS_URL=$NEXT_PUBLIC_CMS_URL
ENV NEXT_PUBLIC_ADMIN_URL=$NEXT_PUBLIC_ADMIN_URL
ENV NEXT_PUBLIC_FORMS_ADMIN_URL=$NEXT_PUBLIC_FORMS_ADMIN_URL
ENV NEXT_PUBLIC_MAIL_URL=$NEXT_PUBLIC_MAIL_URL
ENV NEXT_PUBLIC_SHORT_ORIGIN=$NEXT_PUBLIC_SHORT_ORIGIN
ENV NEXT_PUBLIC_GITHUB_ACTIVITY_URL=$NEXT_PUBLIC_GITHUB_ACTIVITY_URL
ENV NEXT_PUBLIC_INCLUDE_PLAYGROUND=$NEXT_PUBLIC_INCLUDE_PLAYGROUND
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
COPY --from=playground /out ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
EXPOSE 3000
CMD ["node", "server.js"]

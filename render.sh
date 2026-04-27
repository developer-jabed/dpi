set -o errexit

pnpm install --frozen-lockfile && \
pnpm prisma generate && \
pnpm run build && \
pnpm prisma migrate deploy
FROM node:20-alpine AS base
WORKDIR /app
RUN corepack enable

# Backend dependencies
FROM base AS backend-deps
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

# Frontend dependencies
FROM base AS frontend-deps
COPY client/package.json client/package-lock.json ./client/
RUN cd client && npm ci --ignore-scripts

# Build frontend
FROM frontend-deps AS frontend-build
COPY client ./client
RUN cd client && npm run build

# Production image
FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp

COPY --from=backend-deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY src ./src
COPY scripts ./scripts
COPY --from=frontend-build /app/client/dist ./client/dist

RUN npx prisma generate

ENV PORT=3000
EXPOSE 3000

USER nodeapp

CMD ["npm", "start"]

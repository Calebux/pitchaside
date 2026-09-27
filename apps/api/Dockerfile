FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/api/package.json apps/api/
COPY packages/shared/package.json packages/shared/
RUN npm ci
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN cd apps/api && npx nest build

FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/shared ./packages/shared
COPY apps/api/package.json ./
EXPOSE 3001
CMD ["node", "dist/main.js"]

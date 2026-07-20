# --- Build stage: install everything and compile TypeScript ---
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# --- Production stage: only prod deps + compiled output ---
FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist
COPY --from=build /app/public ./public

# Hosts (Render/Railway) inject PORT; the app reads process.env.PORT.
EXPOSE 3000
CMD ["node", "dist/main.js"]

FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Production runtime stage
FROM node:22-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000
ENV DATA_DIR=/app/data
ENV EPRINTS_DOCUMENTS_PATH=/eprints/documents

COPY package*.json ./
# Copy node_modules directly from builder to avoid recompilation
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# Create necessary mount points
RUN mkdir -p /app/data /eprints/documents

EXPOSE 5000

CMD ["node", "dist/index.js"]

FROM node:22-alpine

WORKDIR /app

COPY package.json /app/package.json

# Install only this workspace package's deps
RUN npm install

COPY tsconfig.json /app/tsconfig.json
COPY src /app/src

RUN npm run build

ENV HOST=0.0.0.0
ENV PORT=2345
ENV DATA_DIR=/data

EXPOSE 2345

HEALTHCHECK --interval=10s --timeout=5s --retries=3 CMD wget --quiet --tries=1 --spider http://localhost:${PORT}/health || exit 1

CMD ["node", "dist/index.js"]


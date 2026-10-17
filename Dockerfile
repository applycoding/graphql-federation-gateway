FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json eslint.config.mjs ./
COPY schemas ./schemas
COPY src ./src
RUN npm run build
ENV NODE_ENV=production
USER node
EXPOSE 4100
CMD ["node", "dist/dev.js"]

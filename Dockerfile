# build environment
FROM node:22-alpine AS build
WORKDIR /app

# Install deps
COPY package.json /app/package.json
COPY yarn.lock /app/yarn.lock
COPY .yarnrc.yml /app/.yarnrc.yml

RUN corepack enable
RUN yarn install --frozen-lockfile

# Copy source
COPY graphql /app/graphql
COPY prisma /app/prisma
COPY scrapers /app/scrapers
COPY scripts /app/scripts
COPY serializers /app/serializers
COPY services /app/services
COPY twilio /app/twilio
COPY types /app/types
COPY utils /app/utils
COPY infrastructure/prod /app
COPY babel.config.json /app

RUN yarn build
RUN rm -rf node_modules

# Get RDS Certificate
RUN apk update && apk add wget && rm -rf /var/cache/apk/* \
    && wget "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"
ENV dbCertPath=/app/rds-ca-2019-root.pem

ENV NODE_ENV=prod

ENTRYPOINT ["/app/entrypoint.sh"]

EXPOSE 4000 8080
CMD ["node", "dist/graphql/index.js"]

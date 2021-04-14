# build environment
FROM node:12.16-alpine as build
WORKDIR /app
# Install deps
COPY package.json /app/package.json
COPY yarn.lock /app/yarn.lock
RUN yarn install --frozen-lockfile
# Copy source
COPY graphql /app/graphql
COPY prisma /app/prisma
COPY scrapers /app/scrapers
COPY scripts /app/scripts
COPY serializers /app/serializers
COPY services /app/services
COPY types /app/types
COPY utils /app/utils
COPY infrastructure/prod /app

RUN yarn build
RUN rm -rf node_modules

# Get RDS Certificate
RUN apk update && apk add wget && rm -rf /var/cache/apk/* \
&& wget "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"
ENV dbCertPath /app/rds-ca-2019-root.pem

ENV NODE_ENV=prod

ENTRYPOINT ["/app/entrypoint.sh"]

EXPOSE 4000
CMD ["yarn", "prod"]

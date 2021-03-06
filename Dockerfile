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
COPY serializers /app/serializers
COPY services /app/services
COPY types /app/types
COPY utils /app/utils

RUN yarn build

# FROM node:12.16-alpine
# WORKDIR /root
# Get RDS Certificate
RUN apk update && apk add wget && rm -rf /var/cache/apk/* \
&& wget "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"
ENV dbCertPath /app/rds-ca-2019-root.pem
# COPY --from=build /app/package.json /app/yarn.lock ./
# COPY --from=build /app/dist ./dist
# COPY --from=build /app/public ./public
ENV NODE_ENV=prod
# RUN yarn install --production

COPY infrastructure/prod /app
ENTRYPOINT ["/app/entrypoint.sh"]

EXPOSE 4000
CMD ["yarn", "prod"]

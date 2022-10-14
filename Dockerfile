# build environment container -------------------------------------------------- #

FROM node:14.19.0-alpine as build
WORKDIR /app
# Install deps
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Copy source
COPY . .
RUN yarn build


# final container -------------------------------------------------- #

FROM node:14.19.0-alpine
WORKDIR /app
COPY --from=build /app/dist /app/dist
COPY infrastructure/prod /app
COPY prisma .
COPY package.json yarn.lock ./

# Get RDS Certificate
RUN apk update && apk add wget && rm -rf /var/cache/apk/* \
    && wget "https://s3.amazonaws.com/rds-downloads/rds-ca-2019-root.pem"
ENV dbCertPath /app/rds-ca-2019-root.pem

ENV NODE_ENV=prod

ENTRYPOINT ["/app/entrypoint.sh"]

EXPOSE 4000 8080
CMD ["yarn", "prod"]
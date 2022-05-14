#!/bin/sh

cd dist
yarn install --production --frozen-lockfile
yarn prod:db:migrate
yarn db:refresh
cd ..

exec "$@"

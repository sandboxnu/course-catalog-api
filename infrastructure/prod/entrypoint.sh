#!/bin/sh

cd dist
yarn install --production
yarn prod:db:migrate
yarn db:refresh
cd ..
echo "$@"
exec "$@"

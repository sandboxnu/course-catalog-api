#!/bin/sh

cd dist
yarn prod:db:migrate
yarn db:refresh
cd ..

exec "$@"

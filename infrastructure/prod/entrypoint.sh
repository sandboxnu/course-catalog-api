#!/bin/sh

yarn prod:db:migrate
yarn db:refresh
rm -rf dist/node_modules
cp -r node_modules dist/
cp prisma/.env dist/prisma/.env


exec "$@"

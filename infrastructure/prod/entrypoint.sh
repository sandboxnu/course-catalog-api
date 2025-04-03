#!/bin/sh

cd dist
yarn install --production
# echo "resolving migrations"
# yarn prisma migrate resolve --applied "20250402143554_"
echo "migrating"
yarn prod:db:migrate
yarn db:refresh
cd ..

exec "$@"

#!/bin/sh

# Run a production prisma migration
yarn prisma migrate deploy --preview-feature
yarn db:refresh

exec "$@"

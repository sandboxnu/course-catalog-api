#!/bin/sh

cd dist
# TODO: This should be a `yarn workspaces focus --production` but
# the dev and non-dev deps are a tangled mess rn
yarn workspaces focus
yarn prod:db:migrate
yarn db:refresh
cd ..

exec "$@"

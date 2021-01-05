#!/bin/sh

yarn prod:db:migrate
yarn db:refresh


exec "$@"

#!/bin/sh

npm run prettify:check
status_code=$?
echo STATUS_CODE=$status_code > $GITHUB_ENV
exit $status_code

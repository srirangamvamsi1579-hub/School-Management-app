#!/usr/bin/env bash
# Build the app and publish it to S3 + CloudFront.
# Usage: deploy/aws/deploy.sh dev|preprod|prod [aws-region]
set -euo pipefail
ENV="${1:?usage: deploy.sh dev|preprod|prod [region]}"
REGION="${2:-ap-south-1}"
STACK="school-app-web-${ENV}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

echo "▶ Creating/updating stack ${STACK} in ${REGION}"
aws cloudformation deploy --region "$REGION" --stack-name "$STACK" \
  --template-file "$ROOT/deploy/aws/static-site.yaml" --parameter-overrides EnvName="$ENV" --no-fail-on-empty-changeset

out() { aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET="$(out BucketName)"; DIST="$(out DistributionId)"; LINK="$(out WebLink)"

echo "▶ Building app"
( cd "$ROOT/app" && npm ci && npm test && npm run build )

echo "▶ Uploading to s3://${BUCKET}"
aws s3 sync "$ROOT/app/dist" "s3://${BUCKET}" --delete --cache-control "public,max-age=31536000,immutable" --exclude index.html --exclude manifest.webmanifest
aws s3 cp "$ROOT/app/dist/index.html" "s3://${BUCKET}/index.html" --cache-control "no-cache"
aws s3 cp "$ROOT/app/dist/manifest.webmanifest" "s3://${BUCKET}/manifest.webmanifest" --cache-control "no-cache"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths /index.html /manifest.webmanifest >/dev/null

echo "✔ ${ENV} is live: ${LINK}"

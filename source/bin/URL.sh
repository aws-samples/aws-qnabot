#! /bin/bash
__dirname="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export AWS_PROFILE=$(node -e "console.log(require('$__dirname'+'/../config.json').profile)")
# If profile specified from config file does not exist, allow cli to move on to using instance profile
aws configure list --profile $AWS_PROFILE || unset AWS_PROFILE
export AWS_DEFAULT_REGION=$(node -e "console.log(require('$__dirname'+'/../config.json').region)")

OUTPUT=$($__dirname/exports.js dev/bootstrap)
BUCKET=$( echo $OUTPUT | $__dirname/json.js Bucket)
PREFIX=$( echo $OUTPUT | $__dirname/json.js Prefix)
PUBLIC_BUCKET=$( cat $__dirname/../config.json | $__dirname/json.js publicBucket)
PUBLIC_PREFIX=$( cat $__dirname/../config.json | $__dirname/json.js publicPrefix)
REGION=$AWS_DEFAULT_REGION

MASTER="http://$BUCKET.s3.$REGION.amazonaws.com/$PREFIX/templates/master.json"
PUBLIC="http://$PUBLIC_BUCKET.s3.$REGION.amazonaws.com/$PUBLIC_PREFIX/templates/public.json"

echo "========================Master=============="
echo "template url:"
echo "$MASTER"
echo ""
echo "console launch url:"
echo "https://console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks/new?stackName=QnABot&templateURL=$MASTER"
echo ""
echo ""
echo "========================Public=============="
echo "template url:"
echo "$PUBLIC"
echo ""
echo "console launch url:"
echo "https://console.aws.amazon.com/cloudformation/home?region=$REGION#/stacks/new?stackName=QnABot&templateURL=$PUBLIC"


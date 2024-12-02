#!/bin/bash

# Stop immediately when any commands fail
[ "$DEBUG" == 'true' ] && set -x
set -e -o pipefail

print_usage() {
	cat << EOF
Usage: $(basename $0) [--dry-run|--run|--ignore-bucket-ownership-validation]

The script performs 'npm run upload' and then uploads assets from the solution
development bucket to the solution public bucket using 'aws s3 cp' command.

The bucket names for development bucket and public bucket are taken from the
config.json configuration file.

optional arguments:
  --help show this help message and exit

  --dryrun  display the operations that would be performed using the specified
            command without actually running them.

  --run perform 'npm run upload' followed by 'aws s3 cp' operation to build and
            update assets in the solution public bucket

  --ignore-bucket-ownership-validation	bypass bucket ownership validation. Only
            use this option if you trust owner of the bucket as being in another
            account. You should use caution before attempting to upload to this bucket.
            Alternatively, you can set the environment variable
            QNABOT_IGNORE_BUCKET_OWNERSHIP_VALIDATION=1 for enabling the same bypass.

EOF
}

parse_arguments() {
    RUN=0
    DRY_RUN=0
    IGNORE_BUCKET_OWNERSHIP=0
    while [ $# -gt 0 ]
    do
        ARG=$1
        case $ARG in
            --help)
                print_usage
                exit 0
                ;;
            --dry-run|--dryrun)
                DRY_RUN=1
                ;;
            --run)
                RUN=1
                ;;
            --ignore-bucket-ownership-validation)
                IGNORE_BUCKET_OWNERSHIP=1
                ;;
            *)
                # strictly fail on any unexpected options or arguments
                echo "Parameter validation error: invalid argument '$ARG'"
                exit 1
                ;;
        esac
        shift
    done
    if [[ ${DRY_RUN} -eq 1 && ${RUN} -eq 1 ]]; then
        echo "Parameter validation error: options --dryrun and --run can not be used together."
        exit 1
    fi
    if [[ "${QNABOT_IGNORE_BUCKET_OWNERSHIP_VALIDATION}" = "1" ]]; then
        export QNABOT_IGNORE_BUCKET_OWNERSHIP_VALIDATION
        IGNORE_BUCKET_OWNERSHIP=1
    fi
}

validate_expected_bucket_owner() {
    bucket_src=$1
    bucket_dst=$2

    if [[ ${IGNORE_BUCKET_OWNERSHIP} -eq 1 ]]; then
        node $__dirname/check_bucket_ownership --ignore-bucket-ownership-validation
        return
    fi

    for bucket in $1 $2; do
        node $__dirname/check_bucket_ownership --bucket ${bucket}
    done
}

parse_arguments $@

__dirname="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export AWS_PROFILE=$(node -e "console.log(require('$__dirname'+'/../config.json').profile)")
# If profile specified from config file does not exist, allow cli to move on to using instance profile
aws configure list --profile $AWS_PROFILE || unset AWS_PROFILE
export AWS_DEFAULT_REGION=$(node -e "console.log(require('$__dirname'+'/../config.json').region)")

OUTPUT=$($__dirname/exports.js dev/bootstrap)
DEVBUCKET=$( echo $OUTPUT | $__dirname/json.js Bucket)
PREFIX=$( echo $OUTPUT | $__dirname/json.js Prefix)
REGION=$AWS_DEFAULT_REGION

echo $DEVBUCKET

PUBLICBUCKET=$(node -e "console.log(require('$__dirname'+'/../config.json').publicBucket)")
PUBLICPREFIX=$(node -e "console.log(require('$__dirname'+'/../config.json').publicPrefix)")

if [[ ${DRY_RUN} -eq 1 || ${RUN} -eq 1 ]]; then
    validate_expected_bucket_owner $DEVBUCKET $PUBLICBUCKET
fi

if [[ ${DRY_RUN} -eq 1 ]]; then
    echo "dry run"
    aws s3 cp s3://$DEVBUCKET/$PREFIX s3://$PUBLICBUCKET/$PUBLICPREFIX --recursive --dryrun --acl public-read
elif [[ ${RUN} -eq 1 ]]; then
    npm run upload
    aws s3 cp s3://$DEVBUCKET/$PREFIX s3://$PUBLICBUCKET/$PUBLICPREFIX --recursive --acl public-read
    $__dirname/URL.sh
fi

echo https://$PUBLICBUCKET.s3.$REGION.amazonaws.com/$PUBLICPREFIX/templates/master.json
echo https://$PUBLICBUCKET.s3.$REGION.amazonaws.com/$PUBLICPREFIX/templates/public.json
echo https://$PUBLICBUCKET.s3.$REGION.amazonaws.com/$PUBLICPREFIX/templates/public-vpc-support.json

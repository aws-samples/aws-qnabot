#!/bin/bash

# Stop immediately when any commands fail
[ "$DEBUG" == 'true' ] && set -x
set -e -o pipefail

print_usage() {
	cat << EOF
Usage: $(basename $0) [--ignore-bucket-ownership-validation]

The script uploads local build assets from <project-home>/build directory to
solution S3 bucket using 'aws s3 sync --delete' command.

The bucket name is taken from config.json configuration file.

optional arguments:
  --help show this help message and exit

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
    if [[ "${QNABOT_IGNORE_BUCKET_OWNERSHIP_VALIDATION}" = "1" ]]; then
        export QNABOT_IGNORE_BUCKET_OWNERSHIP_VALIDATION
        IGNORE_BUCKET_OWNERSHIP=1
    fi
}

validate_expected_bucket_owner() {
    bucket=$1

    if [[ ${IGNORE_BUCKET_OWNERSHIP} -eq 1 ]]; then
        node $__dirname/check_bucket_ownership.js --ignore-bucket-ownership-validation
        return
    fi

    node $__dirname/check_bucket_ownership --bucket ${bucket}
}

parse_arguments $@

__dirname="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
export AWS_PROFILE=$(node -e "console.log(require('$__dirname'+'/../config.json').profile)")
# If profile specified from config file does not exist, allow cli to move on to using instance profile
aws configure list --profile $AWS_PROFILE || unset AWS_PROFILE
export AWS_DEFAULT_REGION=$(node -e "console.log(require('$__dirname'+'/../config.json').region)")

OUTPUT=$($__dirname/exports.js dev/bootstrap)
BUCKET=$( echo $OUTPUT | $__dirname/json.js Bucket)
PREFIX=$( echo $OUTPUT | $__dirname/json.js Prefix)

BLUE=$(tput setaf 4)
RESET=$(tput sgr0)
echo bootstrap bucket is $BLUE$BUCKET/$PREFIX$RESET

validate_expected_bucket_owner $BUCKET
aws s3 sync $__dirname/../build/ s3://$BUCKET/$PREFIX/ --delete

"""
Associates a versioned Lambda@Edge ARN with the CloudFront distribution's
default cache behavior on the viewer-request event.

Called by deploy-edge.yml after a new Lambda version is published.
Requires CLOUDFRONT_DISTRIBUTION_ID and LAMBDA_ARN env vars.
"""

import boto3
import os
import sys

cf = boto3.client('cloudfront', region_name='us-east-1')

dist_id    = os.environ['CLOUDFRONT_DISTRIBUTION_ID']
lambda_arn = os.environ['LAMBDA_ARN']

try:
    resp   = cf.get_distribution_config(Id=dist_id)
    config = resp['DistributionConfig']
    etag   = resp['ETag']

    config['DefaultCacheBehavior']['LambdaFunctionAssociations'] = {
        'Quantity': 1,
        'Items': [{
            'LambdaFunctionARN': lambda_arn,
            'EventType': 'viewer-request',
            'IncludeBody': False,
        }],
    }

    cf.update_distribution(
        DistributionConfig=config,
        Id=dist_id,
        IfMatch=etag,
    )

    print(f'Associated {lambda_arn} with distribution {dist_id}')

except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)

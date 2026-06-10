"""
Associates a CloudFront Function (or Lambda@Edge) with the distribution's
default cache behavior on the viewer-request event.

Called by deploy-edge.yml after publishing a new function.
Reads CLOUDFRONT_DISTRIBUTION_ID and either FUNCTION_ARN (CF Function)
or LAMBDA_ARN (Lambda@Edge) from environment.
"""

import boto3
import os
import sys

cf      = boto3.client('cloudfront', region_name='us-east-1')
dist_id = os.environ['CLOUDFRONT_DISTRIBUTION_ID']

function_arn = os.environ.get('FUNCTION_ARN')
lambda_arn   = os.environ.get('LAMBDA_ARN')

try:
    resp     = cf.get_distribution_config(Id=dist_id)
    config   = resp['DistributionConfig']
    etag     = resp['ETag']
    behavior = config['DefaultCacheBehavior']

    if function_arn:
        behavior['FunctionAssociations'] = {
            'Quantity': 1,
            'Items': [{'FunctionARN': function_arn, 'EventType': 'viewer-request'}],
        }
        behavior['LambdaFunctionAssociations'] = {'Quantity': 0, 'Items': []}
        print(f'Associating CloudFront Function: {function_arn}')

    elif lambda_arn:
        behavior['LambdaFunctionAssociations'] = {
            'Quantity': 1,
            'Items': [{'LambdaFunctionARN': lambda_arn, 'EventType': 'viewer-request', 'IncludeBody': False}],
        }
        print(f'Associating Lambda@Edge: {lambda_arn}')

    else:
        print('Error: set FUNCTION_ARN or LAMBDA_ARN', file=sys.stderr)
        sys.exit(1)

    cf.update_distribution(DistributionConfig=config, Id=dist_id, IfMatch=etag)
    print(f'Distribution {dist_id} updated')

except Exception as e:
    print(f'Error: {e}', file=sys.stderr)
    sys.exit(1)

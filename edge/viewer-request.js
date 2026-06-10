'use strict';

// WARN: CF headers are not available in free-plan

const MANIFEST_MAP = {
    JP: '/manifest-JP.json',
    US: '/manifest-US.json',
    IN: '/manifest-IN.json',
    NL: '/manifest-NL.json',
};

// CloudFront injects CloudFront-Viewer-Country on every request
exports.handler = async (event) => {
    const request = event.Records[0].cf.request;

    if (request.uri === '/manifest.json') {
        const countryHeader = request.headers['cloudfront-viewer-country'];
        const country = countryHeader?.[0]?.value;
        const resolved = MANIFEST_MAP[country] ?? '/manifest.json';
        console.log(request.headers);
        console.log(`[geo-router] country=${country} uri=${resolved}`);
        request.uri = resolved;
    }

    return request;
};

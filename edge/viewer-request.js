'use strict';

// Maps ISO 3166-1 alpha-2 country codes to their regional manifest file.
// CloudFront injects CloudFront-Viewer-Country on every request.
// Unmapped countries fall through to manifest.json (global fallback).
const MANIFEST_MAP = {
    JP: '/manifest-JP.json',
    US: '/manifest-US.json',
    IN: '/manifest-IN.json',
    NL: '/manifest-NL.json',
};

exports.handler = async (event) => {
    const request = event.Records[0].cf.request;

    if (request.uri === '/manifest.json') {
        const countryHeader = request.headers['cloudfront-viewer-country'];
        const country = countryHeader?.[0]?.value;
        request.uri = MANIFEST_MAP[country] ?? '/manifest.json';
    }

    return request;
};

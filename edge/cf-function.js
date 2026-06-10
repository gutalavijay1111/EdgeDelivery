var MANIFEST_MAP = {
    JP: '/manifest-JP.json',
    US: '/manifest-US.json',
    IN: '/manifest-IN.json',
    NL: '/manifest-NL.json',
};

function handler(event) {
    var request = event.request;

    // Debug endpoint — visit /debug-country to see what CloudFront detects
    if (request.uri === '/debug-country') {
        var countryHeader = request.headers['cloudfront-viewer-country'];
        var detected = countryHeader ? countryHeader.value : null;
        return {
            statusCode: 200,
            headers: { 'content-type': { value: 'application/json' } },
            body: JSON.stringify({
                detected_country: detected,
                in_manifest_map: !!(detected && MANIFEST_MAP[detected]),
                would_serve: (detected && MANIFEST_MAP[detected]) || '/manifest.json',
            }),
        };
    }

    if (request.uri === '/manifest.json') {
        var countryHdr = request.headers['cloudfront-viewer-country'];
        var country = countryHdr ? countryHdr.value : null;
        request.uri = (country && MANIFEST_MAP[country]) || '/manifest.json';
    }

    return request;
}

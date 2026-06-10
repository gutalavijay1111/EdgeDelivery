const MANIFEST_MAP = {
    JP: '/manifest-JP.json',
    US: '/manifest-US.json',
    IN: '/manifest-IN.json',
    NL: '/manifest-NL.json',
};

function handler(event) {
    const request = event.request;

    if (request.uri === '/manifest.json') {
        const countryHeader = request.headers['cloudfront-viewer-country'];
        const country = countryHeader?.value;
        request.uri = MANIFEST_MAP[country] ?? '/manifest.json';
    }

    return request;
}

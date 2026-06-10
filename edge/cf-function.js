var MANIFEST_MAP = {
    JP: '/manifest-JP.json',
    US: '/manifest-US.json',
    IN: '/manifest-IN.json',
    NL: '/manifest-NL.json',
};

function handler(event) {
    var request = event.request;

    if (request.uri === '/manifest.json') {
        var countryHeader = request.headers['cloudfront-viewer-country'];
        var country = countryHeader ? countryHeader.value : null;
        request.uri = (country && MANIFEST_MAP[country]) || '/manifest.json';
    }

    return request;
}

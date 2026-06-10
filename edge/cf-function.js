var MANIFEST_MAP = {
    JP: '/manifest-JP.json',
    US: '/manifest-US.json',
    IN: '/manifest-IN.json',
    NL: '/manifest-NL.json',
};

function handler(event) {
    var request = event.request;

    if (request.uri === '/manifest.json') {
        // ?country=XX overrides geo-detection — useful for testing without VPN
        var qs = request.querystring;
        var override = qs && qs['country'] && qs['country'].value;

        var countryHeader = request.headers['cloudfront-viewer-country'];
        var detected = countryHeader ? countryHeader.value : null;

        var country = override || detected;
        request.uri = (country && MANIFEST_MAP[country]) || '/manifest.json';
    }

    return request;
}


const url = require('node:url');
const path = require('node:path');

function decodePolyline(polyline, precision = 5) {
  for (var n = 0, r = 0, c = 0, h = [], u = 0, s = 0, p = null, y, m, x = Math.pow(10, Number.isInteger(precision) ? precision : 5); n < polyline.length;) {
    p = null, u = 1, s = 0;
    do p = polyline.charCodeAt(n++) - 63, s += (p & 31) * u, u *= 32;
    while (p >= 32);
    y = s & 1 ? (-s - 1) / 2 : s / 2, u = 1, s = 0;
    do p = polyline.charCodeAt(n++) - 63, s += (p & 31) * u, u *= 32;
    while (p >= 32);
    m = s & 1 ? (-s - 1) / 2 : s / 2, r += y, c += m, h.push([r / x, c / x])
  }
  return h;
}

function buildDirectionsUrl(config, waypoints) {
  const baseUrl = 'baseUrl' in config ? config.baseUrl : 'https://api.mapbox.com';
  const basePath = '/directions/v5/mapbox';
  const modePath = parseMode(config);
  const coordinatesPath = buildCoordinates(config);
  let args = [
    'access_token=' + config.accessToken
  ];
  if ('annotations' in config) {
    args.push('annotations=' + config.annotations);
    args.push('overview=full');
  }
  if ('steps' in config) {
    args.push('steps=' + config.steps);
  }

  return new url.URL(
    path.join(
      basePath,
      modePath,
      coordinatesPath
    ) + '?' + args.join('&'),
    baseUrl
  );
}

function buildStaticMapUrl(config, geojson) {
  const baseUrl = 'baseUrl' in config ? config.baseUrl : 'https://api.mapbox.com';
  const style = config.map?.style ?? 'mapbox/dark-v11';
  const imageSize = config.map?.imageSize ?? '400x400@2x';
  const basePath = `/styles/v1/${style}/static/`;
  const geojsonPath = `geojson(${geojson})`;
  const contextPath = "auto";
  const sizePath = `${imageSize}.jpeg`;
  let args = [
    'access_token=' + config.accessToken
  ];

  return new url.URL(
    path.join(
      basePath,
      geojsonPath,
      contextPath,
      sizePath
    ) + '?' + args.join('&'),
    baseUrl
  );
}

function parseMode(config) {
  return config.mode == 'driving' ? 'driving-traffic' : config.mode;
}

function buildCoordinates(config) {
  // Build coordinates string with optional waypoints
  let coordinates = config.originCoords;
  if (config.waypoints && config.waypoints.length > 0) {
    coordinates += ';' + config.waypoints.join(';');
  }
  coordinates += ';' + config.destinationCoords;
  return coordinates;
}

module.exports = {
  buildDirectionsUrl,
  buildStaticMapUrl,
  decodePolyline
}
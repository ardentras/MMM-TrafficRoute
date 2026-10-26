
const url = require('node:url');
const path = require('node:path');

function buildDirectionsUrl(config) {
  let baseUrl = 'baseUrl' in config ? config.baseUrl : 'https://api.mapbox.com';
  let basePath = '/directions/v5/mapbox';
  let modePath = parseMode(config);
  let coordinatesPath = buildCoordinates(config);
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
  buildDirectionsUrl
}
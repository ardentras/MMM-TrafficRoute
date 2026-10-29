
const url = require('node:url');
const path = require('node:path');

// https://geocoordinate.site/polyline-decoder/
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

function encodeCongestion(congestion) {
  let count = 1;
  let curr = last = null;
  let encoded = [];
  for (elem of congestion) {
    if (curr === null) {
      curr = elem;
    } else {
      last = curr;
      curr = elem;
    }

    if (last === curr) {
      count++;
    } else if (last !== null) {
      encoded.push({ level: last, count });
      count = 1;
    }
  }
  encoded.push({ level: last, count });

  return encoded;
}

function calculateSeverities(congest, rawLengthCongestion, geo, simplegeo) {
  let sgIdxs = []
  simplegeo.forEach((val) => {
    sgIdxs.push(geo.findIndex((elem) => {
      return Math.round(elem[0] * 100000) === Math.round(val[0] * 100000)
        && Math.round(elem[1] * 100000) === Math.round(val[1] * 100000)
    }))
  })

  let segSev = [];
  let sevIdx = 0;
  let sevSum = congest[sevIdx].count;
  let sgIdx = 0;
  let sevs = [sevIdx];
  const sevRanking = {
    unknown: 0,
    low: 1,
    moderate: 2,
    heavy: 3,
    severe: 4
  }

  for (sgIdx = 0; sgIdx < sgIdxs.length;) {
    if (sgIdxs[sgIdx] < sevSum || sevSum == rawLengthCongestion) {
      let sevMax = 0;
      for (i in sevs) {
        idxLevel = sevRanking[congest[i].level];
        if (idxLevel > sevMax)
          sevMax = idxLevel;
      }
      segSev.push({ index: sgIdxs[sgIdx], level: Object.keys(sevRanking)[sevMax] });
      sgIdx++;
      sevs = [sevIdx];
    } else {
      sevIdx++;
      sevSum += congest[sevIdx]?.count ?? 0;
      sevs.push(sevIdx);
    }
  }

  return segSev;
}

module.exports = {
  buildDirectionsUrl,
  buildStaticMapUrl,
  decodePolyline,
  encodeCongestion,
  calculateSeverities
}
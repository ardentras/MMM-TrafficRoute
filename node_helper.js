const NodeHelper = require("node_helper");
const helpers = require('./helpers');
const Log = require("logger");
const simplify_geo = require('simplify-geojson');
const mime = require('mime-types');
const { base64ArrayBuffer } = require("./base64ArrayBuffer");

module.exports = NodeHelper.create({
  start: function () {
    Log.log(`Starting node helper for: ${this.name}`);
  },

  updateCommute: function (payload) {
    Log.log('updating commute');
    this.originCoords = payload.originCoords;
    this.destinationCoords = payload.destinationCoords;
    const directionsUrl = helpers.buildDirectionsUrl(payload);

    this.getCommute(directionsUrl);
  },

  getCommute: function (api_url) {
    fetch(api_url)
      .then((res) => {
        if (!res.ok) {
          return res.json().then((json) => {
            throw new Error(
              json.message || `API Error - ${res.status} ${res.statusText}`,
            );
          });
        }
        return res.json();
      })
      .then((json) => {
        const duration = Math.round(json.routes[0].duration / 60);
        let allCongestion = [];
        json.routes[0].legs.forEach((leg) => {
          allCongestion = allCongestion.concat(leg.annotation.congestion)
        });
        const congestion = helpers.encodeCongestion(allCongestion);

        this.sendSocketNotification("UPDATE-COMMUTE-COMPLETE", {
          originCoords: this.originCoords,
          destinationCoords: this.destinationCoords,
          loaded: true,
          duration,
          hours: Math.floor(duration / 60),
          leftoverMinutes: duration % 60,
          route: json.routes[0].legs[0].summary,
          polyline: json.routes[0].geometry,
          congestion,
          rawLengthCongestion: allCongestion.length,
          closures: json.routes[0].legs[0].closures ?? null
        });
      })
      .catch((e) => {
        this.sendSocketNotification("UPDATE-COMMUTE-COMPLETE", {
          errorMessage: 'Error fetching commute',
          errorDescription: e.message
        })
      });
  },

  updateStaticMap: function (payload) {
    Log.log('updating static map');
    this.originCoords = payload.originCoords;
    this.destinationCoords = payload.destinationCoords;

    let geometryCoordinates = helpers.decodePolyline(payload.polyline);
    geometryCoordinates.forEach(function (elem, idx) { this[idx] = elem.toReversed(); }, geometryCoordinates);
    const linestringElement = {
      type: "LineString",
      coordinates: geometryCoordinates
    };
    lineWidth = payload.map?.lineWidth ?? 3;
    lineColor = payload.map?.lineColor ?? "#fff";
    const geoJSONElement = {
      "type": "FeatureCollection",
      "features": [
        {
          "type": "Feature",
          "geometry": linestringElement
        }
      ]
    };
    let simplegeo = simplify_geo(geoJSONElement, 0.0001).features[0].geometry.coordinates;
    let severities = helpers.calculateSeverities(
      payload.congestion,
      payload.rawLengthCongestion,
      geometryCoordinates,
      simplegeo
    );

    let simplegeoJSONElement = {
      "type": "FeatureCollection",
      "features": [
      ]
    }

    const levelColors = {
      unknown: '#fff',
      low: '#6a3',
      moderate: '#a93',
      heavy: '#a63',
      severe: '#a33'
    }

    let lastLevel = severities[0].level;
    let feature = {
      "type": "Feature",
      "properties": {
        "stroke": levelColors[lastLevel],
        "stroke-width": 3
      },
      "geometry": {
        type: "LineString",
        coordinates: []
      }
    }
    for (i in simplegeo) {
      let level = severities[i].level
      if (level !== lastLevel) {
        simplegeoJSONElement.features.push(feature);
        feature = {
          "type": "Feature",
          "properties": {
            "stroke": levelColors[level],
            "stroke-width": 3
          },
          "geometry": {
            type: "LineString",
            coordinates: [feature.geometry.coordinates[feature.geometry.coordinates.length - 1]]
          }
        }
      }

      feature.geometry.coordinates.push(simplegeo[i]);
      lastLevel = level
    }
    simplegeoJSONElement.features.push(feature);

    Log.log(JSON.stringify(simplegeoJSONElement));

    linestring = encodeURIComponent(JSON.stringify(simplegeoJSONElement));

    const staticMapUrl = helpers.buildStaticMapUrl(payload, linestring);

    if (staticMapUrl.length > 8192) {
      const errMessage = 'Static Map request exceeded limit of 8192 characters'
      Log.log(errMessage);
      this.sendSocketNotification("UPDATE-STATIC-MAP-COMPLETE", {
        errorMessage: 'Error fetching commute',
        errorDescription: errMessage
      })
    }

    this.getStaticMap(staticMapUrl, payload);
  },

  getStaticMap: function (api_url) {
    fetch(api_url)
      .then((res) => {
        if (!res.ok) {
          return res.arrayBuffer().then((json) => {
            Log.log("ERROR: " + `API Error - ${res.status} ${res.statusText}`)
            throw new Error(
              json.message || `API Error - ${res.status} ${res.statusText}`,
            );
          });
        }

        return res.arrayBuffer();
      })
      .then((buffer) => {
        const imageB64 = `data:${mime.contentType('jpeg')};base64,${base64ArrayBuffer(buffer)}`;
        this.sendSocketNotification("UPDATE-STATIC-MAP-COMPLETE", {
          originCoords: this.originCoords,
          destinationCoords: this.destinationCoords,
          mapImage: imageB64
        });
        Log.log('UPDATE-STATIC-MAP-COMPLETE notification sent');
      })
      .catch((e) => {
        Log.log('something failed! ' + e);
        this.sendSocketNotification("UPDATE-STATIC-MAP-COMPLETE", {
          errorMessage: 'Error fetching commute',
          errorDescription: e.message
        })
      });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "UPDATE-COMMUTE") {
      this.updateCommute(payload);
    } else if (notification === "UPDATE-STATIC-MAP") {
      this.updateStaticMap(payload);
    }
  }
});
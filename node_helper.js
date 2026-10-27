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
        let duration = Math.round(json.routes[0].duration / 60);
        this.sendSocketNotification("UPDATE-COMMUTE-COMPLETE", {
          originCoords: this.originCoords,
          destinationCoords: this.destinationCoords,
          loaded: true,
          duration: duration,
          hours: Math.floor(duration / 60),
          leftoverMinutes: duration % 60,
          route: json.routes[0].legs[0].summary,
          polyline: json.routes[0].geometry
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
          "properties": {
            "stroke": lineColor,
            "stroke-width": lineWidth
          },
          "geometry": linestringElement
        }
      ]
    };
    let debugstring = JSON.stringify(simplify_geo(geoJSONElement, 0.0001));
    Log.log(debugstring);
    linestring = encodeURIComponent(debugstring);

    const staticMapUrl = helpers.buildStaticMapUrl(payload, linestring);

    this.getStaticMap(staticMapUrl, payload);
  },

  getStaticMap: function (api_url) {
    fetch(api_url)
      .then((res) => {
        Log.log('request complete!');
        if (!res.ok) {
          Log.log('request failed!');
          return res.arrayBuffer().then((json) => {
            Log.log("ERROR: " + `API Error - ${res.status} ${res.statusText}`)
            throw new Error(
              json.message || `API Error - ${res.status} ${res.statusText}`,
            );
          });
        }

        Log.log('request succeeded!');
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
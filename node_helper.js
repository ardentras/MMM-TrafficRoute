const NodeHelper = require("node_helper");
const helpers = require('./helpers');
const Log = require("logger");

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
          route: json.routes[0].legs[0].summary
        });
      })
      .catch((e) => {
        this.sendSocketNotification("UPDATE-COMMUTE-COMPLETE", {
          errorMessage: 'Error fetching commute',
          errorDescription: e.message
        })
      });
  },

  socketNotificationReceived: function (notification, payload) {
    if (notification === "UPDATE-COMMUTE") {
      this.updateCommute(payload);
    }
  }
});
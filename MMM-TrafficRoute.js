/* MagicMirror² Module: MMM-TrafficRoute
 *
 * By Shaun Rasmusen https://github.com/ardentras
 * MIT License.
 */

Module.register('MMM-TrafficRoute', {
  defaults: {
    interval: 300000,
    showSymbol: true,
    firstLine: 'Current duration is {duration} mins',
    loadingText: 'Loading...',
    language: config.language,
    mode: 'driving',
    days: [0, 1, 2, 3, 4, 5, 6],
    hoursStart: '00:00',
    hoursEnd: '23:59',
    waypoints: [],
  },

  start: function () {
    console.log('Starting module: ' + this.name);
    this.loading = true;
    this.internalHidden = false;
    this.firstResume = true;
    this.errorMessage = undefined;
    this.errorDescription = undefined;
    this.updateCommute = this.updateCommute.bind(this);
    this.getDom = this.getDom.bind(this);
    if (
      [
        this.config.originCoords,
        this.config.destinationCoords,
        this.config.accessToken,
      ].includes(undefined)
    ) {
      this.errorMessage = 'Config error';
      this.errorDescription =
        'You must set originCoords, destinationCoords, and accessToken in your config';
      this.updateDom();
    } else {
      this.updateCommute();
    }
  },

  updateCommute: function () {
    // only run getDom once at the start of a hidden period to remove the module from the screen, then just wait until time to unhide to run again
    if (this.shouldHide() && !this.internalHidden) {
      console.log(
        'Hiding MMM-TrafficRoute due to config options: days, hoursStart, hoursEnd',
      );
      this.internalHidden = true;
      this.updateDom();
    } else if (!this.shouldHide()) {
      this.internalHidden = false;
      this.sendSocketNotification("UPDATE-COMMUTE", this.config);
    }
    // no network requests are made when the module is hidden, so check every 30 seconds during hidden
    // period to see if it's time to unhide yet
    // setTimeout(
    //   this.updateCommute,
    //   this.internalHidden ? 3000 : this.config.interval,
    // );
  },

  socketNotificationReceived: function (notification, payload) {
    // check to see if the response was for us and used the same coordinates
    if (payload.originCoords === this.config.originCoords
      && payload.destinationCoords === this.config.destinationCoords) {
      if (notification === "UPDATE-COMMUTE-COMPLETE") {
        // we got some data so set the flag, stash the data to display then request the dom update
        this.loaded = payload.loaded;
        this.duration = payload.duration;
        this.hours = payload.hours;
        this.leftoverMinutes = payload.leftoverMinutes;
        this.route = payload.route;
        this.errorMessage = payload.errorMessage;
        this.loading = false;
        this.updateDom();

        this.sendSocketNotification("UPDATE-STATIC-MAP", {
          ...this.config,
          polyline: payload.polyline
        });
      } else if (notification === "UPDATE-STATIC-MAP-COMPLETE") {
        this.staticMapImage = payload.mapImage;
        this.updateDom();
      }
    }
  },

  getStyles: function () {
    return ['traffic.css', 'font-awesome.css'];
  },

  getScripts: function () {
    return ['moment.js'];
  },

  getDom: function () {
    var wrapper = document.createElement('div');

    // hide when desired (called once on first update during hidden period)
    if (this.internalHidden) return wrapper;

    // base divs
    var firstLineDiv = document.createElement('div');
    firstLineDiv.className = 'bright medium mmmtrafficroute-firstline';
    var secondLineDiv = document.createElement('div');
    secondLineDiv.className = 'normal small mmmtrafficroute-secondline';

    // display any errors
    if (this.errorMessage) {
      firstLineDiv.innerHTML = this.errorMessage;
      secondLineDiv.innerHTML = this.errorDescription;
      wrapper.append(firstLineDiv);
      wrapper.append(secondLineDiv);
      return wrapper;
    }

    let symbolString = 'car';
    if (this.config.mode == 'cycling') symbolString = 'bicycle';
    if (this.config.mode == 'walking') symbolString = 'walking';

    // symbol
    if (this.config.showSymbol) {
      var symbol = document.createElement('span');
      symbol.className = `fa fa-${symbolString} symbol`;
      firstLineDiv.appendChild(symbol);
    }

    // first line
    var firstLineText = document.createElement('span');
    firstLineText.innerHTML = this.loading
      ? this.config.loadingText
      : this.replaceTokens(this.config.firstLine);
    firstLineDiv.appendChild(firstLineText);
    wrapper.appendChild(firstLineDiv);
    if (this.loading) return wrapper;

    // second line
    if (this.config.secondLine) {
      secondLineDiv.innerHTML = this.replaceTokens(this.config.secondLine);
      wrapper.appendChild(secondLineDiv);
    }

    if (this.staticMapImage) {
      const img = document.createElement('img');

      img.src = this.staticMapImage;
      img.height = 400;
      img.width = 400;

      wrapper.appendChild(img);
    }

    return wrapper;
  },

  replaceTokens: function (text) {
    return text
      .replace(/{duration}/g, this.duration)
      .replace(/{hours}/g, this.hours)
      .replace(/{leftoverMinutes}/g, this.leftoverMinutes)
      .replace(/{route}/g, this.route);
  },

  shouldHide: function () {
    let hide = true;
    let now = moment();
    if (
      this.config.days.includes(now.day()) &&
      moment(this.config.hoursStart, 'HH:mm').isBefore(now) &&
      moment(this.config.hoursEnd, 'HH:mm').isAfter(now)
    ) {
      hide = false;
    }
    return hide;
  },
});

#!/usr/bin/env node

var http = require('http'),
  zlib = require('zlib'),
  url = require('url'),
  gtfsrt = require('gtfs-realtime-bindings'),
  program = require('commander');

console.error('GTFS-RT of iRail to linked connections converter use --help to discover more functions');

program
  .arguments('<url>', 'URL to gtfs-rt')
  .action(function (urlparam) {
    program.url = url.parse(urlparam);
  })
  .parse(process.argv);

if (!program.url) {
  console.error('Please provide a url to a GTFS-RT file');
  process.exit();
}

// When we have a response, parse the gtfsrt feed and create connections from them
var onResponse = function (error, response, body) {
  var output = [];

  /**
   * Base URI of iRail connections
   * @var iRailConnectionUrl
   */
  var iRailConnectionUrl = 'http://irail.be/connections/';

  var feed = gtfsrt.FeedMessage.decode(body);

  var mongoId = iRailConnectionUrl;

  feed.entity.forEach(function (entity) {
    // does the entity have updates?
    if (entity.trip_update) {
      var trip_update = entity.trip_update;
      var trip_id = trip_update.trip.trip_id;
      var gtfs_route = entity.trip_update.vehicle.id;

      /**
       * Check if train is canceled or not
       */
      var type = getConnectionType(entity);

      // foreach stop time update
      entity.trip_update.stop_time_update.forEach(function (stop_time, index) {
        var stop_times_length = trip_update.stop_time_update.length;
        var departureStop = stop_time.stop_id.split(':')[0];

        if (index + 1 == stop_times_length) {
          var arrivalStop = departureStop;
        } else {
          var arrivalStop = entity.trip_update.stop_time_update[index + 1].stop_id.split(':')[0];
        }
        var arrivalTime = null,
          departureTime = null;
        // Check whether arrival time and/or departure time is set
        if (stop_time.arrival && stop_time.arrival.time && stop_time.arrival.time.low) {
          arrivalTime = new Date(stop_time.arrival.time.low * 1000);
        }
        if (!stop_time.departure || !stop_time.departure.time || !stop_time.departure.time.low) {
          if (!arrivalTime) {
            // do nothing: both arrival as departure is not set: this stoptime is skipped?
          } else {
            departureTime = arrivalTime;
          }
        } else {
          departureTime = new Date(stop_time.departure.time.low * 1000);
          if (!arrivalTime) {
            arrivalTime = departureTime;
          }
        }

        var arrivalDelaySeconds = stop_time.arrival ? stop_time.arrival.delay : 0;
        var departureDelaySeconds = stop_time.departure ? stop_time.departure.delay : arrivalDelaySeconds;
        var mongoId = 'http://irail.be/connections/' + encodeURIComponent(departureStop) +
          '/' +
          encodeURIComponent(departureTime.toISOString().substr(0, 10)) + '/' + encodeURIComponent(gtfs_route);

        var obj = {
          '@id': mongoId,
          '@type': type,
          'departureStop': 'http://irail.be/stations/NMBS/00' + departureStop,
          'arrivalStop': 'http://irail.be/stations/NMBS/00' + arrivalStop,
          'arrivalTime': arrivalTime.toISOString(),
          'departureTime': departureTime.toISOString(),
          'arrivalDelay': arrivalDelaySeconds,
          'departureDelay': departureDelaySeconds,
          'gtfs:trip': 'http://irail.be/trips/' + trip_id,
          'gtfs:route': 'https://irail.be/vehicle/?id=' + gtfs_route
        };

        // print object
        console.log(JSON.stringify(obj));
      });
      // end foreach

      // reset mongoId
      mongoId = iRailConnectionUrl;
    } // end if
  });
};

/**
 * Get connection type
 * @author Serkan Yildiz
 * @param Object entity
 * @return string Connection|CanceledConnection
 */
function getConnectionType(entity) {
  if (entity.is_deleted) {
    return 'CanceledConnection';
  } else {
    return 'Connection';
  }
}

// Step 1: fetch the GTFS
http.request(program.url, function (res) {
  var encoding = res.headers['content-encoding'];
  var responseStream = res;
  if (encoding && encoding == 'gzip') {
    responseStream = res.pipe(zlib.createGunzip());
  } else if (encoding && encoding == 'deflate') {
    responseStream = res.pipe(zlib.createInflate());
  }
  var responseBody = '';
  var buffer = false;
  responseStream.on('data', function (chunk) {
    if (!buffer) {
      buffer = chunk;
    } else {
      buffer = Buffer.concat([buffer, chunk], buffer.length + chunk.length);
    }
  });
  res.on('error', function (error) {
    onResponse(error);
  });
  responseStream.on('end', function () {
    onResponse(null, res, buffer);
  });
}).end();

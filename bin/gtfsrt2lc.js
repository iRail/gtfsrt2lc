#!/usr/bin/env node

var program = require('commander'),
    http = require('http'),
    zlib = require('zlib'),
    gtfsrt = require('gtfs-realtime-bindings'),
    url = require('url'),
    fs = require('fs');

console.error("GTFS-RT of iRail to linked connections converter use --help to discover more functions");

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

//When we have a response, parse the gtfsrt feed and create connections from them
var onResponse = function (error, response, body) {
  var feed = gtfsrt.FeedMessage.decode(body);
  feed.entity.forEach(function(entity) {
    if (entity.trip_update) {
      entity.trip_update.stop_time_update.forEach(function (stop_time) {
        console.log(stop_time);
      });
    }
  });
};

//Step 1: fetch the GTFS
http.request(program.url, function (res) {
  var encoding = res.headers['content-encoding']
  var responseStream = res;
  if (encoding && encoding == 'gzip') {
    responseStream = res.pipe(zlib.createGunzip());
  } else if (encoding && encoding == 'deflate') {
    responseStream = res.pipe(zlib.createInflate())
  }
  var responseBody = '';
  var buffer = false;
  responseStream.on('data', function (chunk) {
    if (!buffer) {
      buffer = chunk;
    } else {
      buffer = Buffer.concat([buffer, chunk], buffer.length+chunk.length);
    }
  });
  res.on('error', function (error) {
    onResponse(error);
  });
  responseStream.on('end', function () {
    onResponse(null, res, buffer);
  })
}).end();


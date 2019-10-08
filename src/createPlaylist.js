'use strict';

const https = require('https');
const promise = require('promise');

const spotifyURLRoot = process.env.SPOTIFY_API_DOMAIN;
const searchTrackEndpoint = process.env.SPOTIFY_API_SEARCH_TRACK_ENDPOINT;

const noMatchMessage = process.env.STRING_NO_SETLIST_MATCH;
const errorMessage = process.env.STRING_ERROR;

let options, token;
let setlistInfo = {};

module.exports.handler = (event, context, callback) => {
    console.log('Request:' + JSON.stringify(event));

    // Find each song in setlist and create Spotify  playlist
    createPlaylist(event)
    .then( (result) => { doCallback( { success: true, message: result }, event, callback) })
    .catch( (error) => { doCallback( { success: false, message: error }, event, callback) });
};

function createPlaylist(event) {
  return new Promise((resolve, reject) => {

    if (event.body && event.body.message) {
      let body = event.body.message;

      if (body.token && body.setlist && body.artistName) {
        token = body.token;

        options = {
            headers: {
                'Authorization': 'Bearer ' + token
            }
        };

        setlistInfo.setlist = body.setlist;
        setlistInfo.artist = body.artistName;

        processEachSong()
        .then( (trackList) => { return processTrackList(trackList); })
        .then( (result) => { return createPlaylistOnSpotify(result); })
        .then( (uris) => { resolve(uris); })
        .catch( (error) => { reject(error); });
      } else {
        reject(errorMessage);
      }
    }
  });
}

function processEachSong() {
  return new Promise((resolve, reject) => {
    let trackList = [];
    let trackListPromises = [];
    
    setlistInfo.setlist.forEach( (item, index) => {
      trackListPromises[index] = new Promise( (innerResolve) => {
        searchForTrack(item.name).then( (trackUri) => {
          trackList[index] = trackUri;
          return innerResolve(trackUri);
        }).catch( (error) => { reject(error); });
      });
    });

    Promise.all(trackListPromises)
    .then( () => { resolve(trackList); });

  });
}

function searchForTrack(track) {
  return new Promise((resolve, reject) => {
        let query = formatSearchQuery(track);

        doRequest(spotifyURLRoot + searchTrackEndpoint + query, options)
        .then(function(result) { return processSearchResult(track, result); })
        .then(function (matchingUri) { resolve(matchingUri); }) // return the matching URI, or nada
        .catch(function(error) { console.log('catching'); reject(error); });
    });
}

function processSearchResult(songName, searchResult) {
  return new Promise((resolve, reject) => {
    if (searchResult && JSON.parse(searchResult).tracks) {
        let potentialMatches = JSON.parse(searchResult).tracks.items;

        if (potentialMatches.length) {  
          potentialMatches.forEach( (item, index) => {
              if (checkSongNameMatch(songName, item.name) && item.uri && item.name) {
                  resolve(item.uri);
              } else {
                if (index == potentialMatches.length) {
                  // TODO: Check for cover
                  console.log("No match for track \"" + songName + "\".");
                  resolve();
                }
              }
          });
        } else {
          console.log("No match for track \"" + songName + "\".");
          resolve();
        }
      }
  });
}

function processTrackList(trackList) {
  return new Promise((resolve, reject) => {
    let uris = '';

    let missingSongs = [];

    for (let i = 0; i < setlistInfo.setlist.length; i++) {
      if (trackList[i]) {
        uris += trackList[i];
        if (i < setlistInfo.setlist.length - 1) {
          uris += ',';
        }
      } else {
        missingSongs.push(setlistInfo.setlist[i].name);
      }
    }

    if (missingSongs.length < setlistInfo.setlist.length) {
      resolve({
        uris: uris,
        missingSongs: missingSongs
      });
    } else {
      reject("No tracks found.");
    }
  });
}

function createPlaylistOnSpotify(result) {
  return new Promise((resolve, reject) => {
    // just passing it back for now, should do something like create a playlist
    resolve(result.uris);
  });
}

function checkSongNameMatch(songNameToMatch, potentialMatch) {
  return potentialMatch.toLowerCase() == songNameToMatch.toLowerCase();
}

function formatName(name) {
    let splitName = name.split(' ');
    let formattedName = '';

    for (let i = 0; i < splitName.length; i++) {
        formattedName += splitName[i];

        if (i < splitName.length - 1) {
            formattedName += '+';
        }
    }
    return formattedName;
}

function formatSearchQuery(track) {
    return '?q=' + formatName(track) + '+' + formatName(setlistInfo.artist) + '&type=track';
}

function doRequest(url, options) {
  return new Promise((resolve, reject) => {

    https.get(url, options, (res) => {
      // console.log('Status Code:' + res.statusCode);
      // console.log('Headers:' + JSON.stringify(res.headers));

      res.setEncoding('utf8');

      let responseData = '';
      res.on('data', (d) => { responseData += d; });

      res.on('end', (e) => {
        let potentialError = JSON.parse(responseData).error;

        if (potentialError) { reject(potentialError.message); }
        else { resolve(responseData); }
      });

      res.on('error', (e) => { reject(e); });
    });
  });
}

function doCallback(m, e, cb) {
  cb(null, {
    statusCode: 200,
    body: JSON.stringify({
      message: m,
      input: e,
    },
    null,
    2),
  });
}


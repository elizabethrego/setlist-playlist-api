'use strict';

const https = require('https');
const promise = require('promise');

const spotifyURLRoot = process.env.SPOTIFY_API_DOMAIN;
const searchTrackEndpoint = process.env.SPOTIFY_API_SEARCH_TRACK_ENDPOINT;

const noMatchMessage = process.env.STRING_NO_SETLIST_MATCH;
const errorMessage = process.env.STRING_ERROR;

let options, token;
let setlistInfo = {};
let counter = 0;

module.exports.handler = (event, context, callback) => {
    console.log('Request:' + JSON.stringify(event));

    // Find artist matching search term via Setlist.fm API
    // Pass callback function to fulfill promise when finished
    createPlaylist(event, callback);
};

function createPlaylist(event, callback) {

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
      .then(function(trackList) {
        console.log('finished processing each song');
        processTrackList(trackList);
      }).then(function(result) {
        console.log('you got here');
        //createPlaylistOnSpotify(result.uris);
        // do something with the missing songs idk
      }).catch(function(error) {
        console.log("Error: " + error);
        // reject(error);
      });
    } else {
      console.log(errorMessage);
    }
  }

    /* (format for yr convenience)
    name: string,
    artistMbid: string,
    cover: {
      isCover: boolean
      originalAristMbid: string (optional),
      originalArtistName: string (optional)
    } */
}

function processEachSong() {
  return new Promise(function(resolve, reject) {
    let trackList = [];
    let trackListPromises = [];
    
    setlistInfo.setlist.forEach(function(item, index) {
      
      trackListPromises[index] = new Promise(function (innerResolve) {
        
        searchForTrack(item.name)
          .then(function(trackUri) {
            console.log('counter: ' + counter);
      counter++;
            console.log('saving trackUri ' + trackUri + ' for song ' + item.name + ' at index ' + index);
            trackList[index] = trackUri;
            return innerResolve(trackUri);
          }).catch(function(error) {
            console.log("Error for index " + index + ": " + error);
          });
      });
    });

    Promise.all(trackListPromises)
    .then(function() {
      console.log('done');
      resolve(trackList);
    });

    setlistInfo.setlist.forEach(function(item, index) {
      searchForTrack(item.name)
        .then(function(trackUri) {
            trackList[index] = trackUri;
            console.log('saving trackUri ' + trackUri + ' for song ' + item.name + ' at index ' + index);

            if (index == setlistInfo.setlist.length) {
              resolve(trackList); // trackList.join(',');
            }
        }).catch(function(error) {
            console.log("Error for index " + index + ": " + error);
        });
    });

    // always empty
    return trackList.join(',');
  });
}

function processTrackList(trackList) {
  return new Promise(function(resolve, reject) {
    let uris = '';

    let missingSongs = [];

    for (let i = 0; i < setlistInfo.setlist.length; i++) {
      if (trackList[i]) {
        uris += trackList[i];
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

function searchForTrack(track) {
    return new Promise(function(resolve, reject) {
        let query = formatSearchQuery(track);

        doRequest(spotifyURLRoot + searchTrackEndpoint + query, options)
        .then(function(result) {
          return processSearchResult(track, result);
        }).then(function (matchingUri) {
          // console.log('searchForTrack: matchingUri: ' + matchingUri);

          if (matchingUri) {
              resolve(matchingUri);
          } else {
              reject("3No match for track \"" + track + "\".");
          }
        }).catch(function(error) {
            reject(error);
        });
    });
}

function createPlaylistOnSpotify(uris) {
  return new Promise(function(resolve, reject) {

  });
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
    let query = '?q=' + formatName(track) + '+' + formatName(setlistInfo.artist) + '&type=track';
    return query;
}

function processSearchResult(songName, searchResult) {
  return new Promise(function(resolve, reject) {
    if (searchResult) {
        let potentialMatches = JSON.parse(searchResult).tracks.items;

        if (potentialMatches.length && checkSongNameMatch(songName, potentialMatches[0].name) && potentialMatches[0].uri) {
            resolve(potentialMatches[0].uri);
        } else {
            if (potentialMatches.length > 1) {
                // loop thru the rest
                let foundMatch = false;
                
                potentialMatches.forEach(function(item, index) {
                    if (checkSongNameMatch(songName, item.name)) {
                        resolve(item.uri);
                    } else {
                      if (index == potentialMatches.length) {
                        reject("1No match for track \"" + songName + "\".");
                      }
                    }
                });
            } else {
              reject("2No match for track \"" + songName + "\".");
            }
        }
    }
  });
}

function checkSongNameMatch(songNameToMatch, potentialMatch) {
  // console.log('checkSongNameMatch: checking \"' + songNameToMatch.toLowerCase() + "\" and \"" + potentialMatch.toLowerCase() + "\".");
  
  let result = false;
  if (potentialMatch.toLowerCase() == songNameToMatch.toLowerCase()) {
    result = true;
    // console.log('checkSongNameMatch: it\'s a match'); 
  } else {
    // console.log('checkSongNameMatch: it\'s not a match');
  }
  return result;
}

function doRequest(url, options) {
  return new Promise(function(resolve, reject) {

    https.get(url, options, (res) => {
      // console.log('Status Code:' + res.statusCode);
      // console.log('Headers:' + JSON.stringify(res.headers));

      res.setEncoding('utf8');

      let responseData = '';

      res.on('data', (d) => {
        responseData += d;
      });

      res.on('end', (e) => {
        // console.log('end response' /* + JSON.stringify(responseData) */ );
        resolve(responseData);
        //doCallback(setlist, event, callback);
      });

      res.on('error', (e) => {
        console.log('Error:' + e);
        reject(e);
        //doCallback(errorMessage, event, callback);
      });
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


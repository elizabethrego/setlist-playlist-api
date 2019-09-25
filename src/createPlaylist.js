'use strict';

const https = require('https');

const spotifyURLRoot = process.env.SPOTIFY_API_DOMAIN;
const searchTrackEndpoint = process.env.SPOTIFY_API_SEARCH_TRACK_ENDPOINT; 

const noMatchMessage = process.env.STRING_NO_SETLIST_MATCH;
const errorMessage = process.env.STRING_ERROR;

const options = {
  headers: {
    'Accept': 'application/json',
    'x-api-key': process.env.SETLISTFM_API_KEY
  }
};

let setlist, artist;

module.exports.handler = (event, context, callback) => {
  console.log('Request:' + JSON.stringify(event));

  // Find artist matching search term via Setlist.fm API
  // Pass callback funftion to fulfill promise when finished
  createPlaylist(event, callback);
};

function createPlaylist(event, callback) {

  if (event.queryStringParameters && event.queryStringParameters.setlist && event.queryStringParameters.artist) {
    setlist =  event.queryStringParameters.artistMbid;
    artist =  event.queryStringParameters.artistName;
    console.log('Setlist: ' + setlist);
    console.log('Artist: ' + artist);

            /* (format for yr convenience)
        name: string,
        artistMbid: string,
        cover: {
          isCover: boolean
          originalAristMbid: string (optional),
          originalArtistName: string (optional)
        } */

  } else {
    //doCallback(errorMessage, event, callback);
  }
}

function createPlaylistFromTrackList(trackList) {
  //  /v1/playlists/{playlist_id}/tracks
  // comma separated list of track URIs
  // path parameter: playlist_id (spotify id for playlist)
  // body: uris (comma separated list of track URIs)
}

function buildTrackList(setlist) {
  let trackList = []; // might need not to initialize

  let track = {};

  setlist.forEach(function (item, index) {
    track = searchForTrack(item);

    if (track) { // do a better check here
      trackList.push(track);
    } else {
      // what if we didn't find the song?
    }

  });

  return trackList.join(',');
}

function searchForTrack() {

}

function doRequest (URL, options) {


  https.get(url, options, (res) => {
    console.log('Status Code:' + res.statusCode);
    console.log('Headers:' + JSON.stringify(res.headers));

    res.setEncoding('utf8');
    
    let responseData = '';

    res.on('data', (d) => {
      console.log('we got a live one!');
      responseData += d;
    });
    
    res.on('end', (e) => {
      let setlist = findMostRecentSetlist(JSON.parse(responseData).setlist);
      console.log('setlist: ' + setlist.toString());
      
      doCallback(setlist, event, callback);
    });
    
    res.on('error', (e) => {
      console.log('Error:'+ e);
      
      doCallback(errorMessage, event, callback);
    });
  });
}

function doCallback(m, e, cb) {
  cb(null, {
    statusCode: 200,
    body: JSON.stringify(
      {
        message: m,
        input: e,
      },
      null,
      2
    ),
  });
}
'use strict';

const https = require('https');

const spotifyURLRoot = process.env.SPOTIFY_API_DOMAIN;
const searchTrackEndpoint = process.env.SPOTIFY_API_SEARCH_TRACK_ENDPOINT; 

const noMatchMessage = process.env.STRING_NO_SETLIST_MATCH;
const errorMessage = process.env.STRING_ERROR;

let options, token, setlist, artist;

module.exports.handler = (event, context, callback) => {
  console.log('Request:' + JSON.stringify(event));

  // Find artist matching search term via Setlist.fm API
  // Pass callback funftion to fulfill promise when finished
  createPlaylist(event, callback);
};

function createPlaylist(event, callback) {

  if (event.queryStringParameters 
    && event.queryStringParameters.token
    && event.queryStringParameters.setlist 
    && event.queryStringParameters.artist) {
    token = event.queryStringParameters.token;

    options = {
      headers: {
        'Authorization': 'Bearer ' + token;
      }
    };

    setlist =  event.queryStringParameters.setlist;
    artist =  event.queryStringParameters.artistName;
    
    console.log('Token:' + token);
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

function searchForTrack(track) {

  let query = formatSearchQuery;
  doRequest(query, options)

}

function formatName(name) {
  let splitName = name.split(' ');
  let formattedName = '';

  for (let i = 0; i < splitName.length; i++){
    formattedName += splitName[i];

    if (i < splitName.length - 1) {
      formattedName += '+';
    }
  }

  console.log('formatted name: ' + formattedName);
  return formattedName;
}

function formatSearchQuery(track) {
  let query = '?q=' + formatName(track) + '+' + formatName(artistName) + '&type=track';

  console.log('query: ' + query);
  return query;
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
      console.log('end response: ' + JSON.stringify(responseData));
      //let setlist = findMostRecentSetlist(JSON.parse(responseData).setlist);
      //console.log('setlist: ' + setlist.toString());
      
      //doCallback(setlist, event, callback);
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
'use strict';

const https = require('https');

const searchSetlistURL = process.env.SETLISTFM_SEARCH_SETLIST_ENDPOINT; 

const noMatchMessage = process.env.STRING_NO_SETLIST_MATCH;
const errorMessage = process.env.STRING_ERROR;

const options = {
  headers: {
    'Accept': 'application/json',
    'x-api-key': process.env.SETLISTFM_API_KEY
  }
};

let artistMbid, artistName;

module.exports.handler = (event, context, callback) => {
  console.log('Request:' + JSON.stringify(event));

  // Find artist matching search term via Setlist.fm API
  // Pass callback funftion to fulfill promise when finished
  searchForSetlist(event, callback);
};

function searchForSetlist(event, callback) {

  if (event.queryStringParameters && event.queryStringParameters.artistMbid && event.queryStringParameters.artistName) {
    artistMbid =  event.queryStringParameters.artistMbid;
    artistName =  event.queryStringParameters.artistName;
    console.log('Searching for Setlists for Artist Name & MBID:' + artistName + ', ' + artistMbid);

    https.get(searchSetlistURL + artistMbid, options, (res) => {
      console.log('Status Code:' + res.statusCode);
      console.log('Headers:' + JSON.stringify(res.headers));

      res.setEncoding('utf8');
      
      let responseData = '';

      res.on('data', (d) => {
        responseData += d;
      });
      
      res.on('end', (e) => {
        let setlist = findMostRecentSetlist(JSON.parse(responseData).setlist);
        
        if (setlist) {
          console.log('setlist: ' + setlist.toString());
        
          doCallback(setlist, event, callback);
        } else {
          console.log('No setlist found.');

          doCallback(errorMessage, event, callback);
        }
        
        /* (format for yr convenience)
        name: string,
        artistMbid: string,
        cover: {
          isCover: boolean
          originalAristMbid: string (optional),
          originalArtistName: string (optional)
        } */
      });
      
      res.on('error', (e) => {
        console.log('Error:'+ e);
        
        doCallback(errorMessage, event, callback);
      });
    });

  } else {
    doCallback(errorMessage, event, callback);
  }
}


function findMostRecentSetlist(setlists) {
  let setlist, foundSetlist;

  if (setlists && setlists.length > 0) {
    // Check each setlist until we find one with at least one song
    setlists.forEach(function (item) {
      if (item.sets.set.length > 0 && item.sets.set[0].song.length > 0 && !foundSetlist) {
           setlist = processSetlist(item.sets.set);
           foundSetlist = true;
       }
    });
  }

  return setlist; 
}

function processSetlist(setlistToProcess) {
  let setlist = [];
  
  setlistToProcess.forEach(function (item, index) {
    item.song.forEach(function (i, x) {
      setlist.push({
        name: getSongName(i),
        artistMbid: artistMbid,
        // do we need the artist name here?
        cover: getSongCoverDetails(i)
      });
    });
  });
  
  return setlist;
}

function getSongName(song) {
  let name = '';
      
  if (song.name) {
    name = song.name;
  } else if (song.info) {
    if (song.info.charAt(0) == '"') {
      name = song.info.substring(1, song.info.length - 1);
    } else {
      name = song.info;
    } 
  }
  return name.toLowerCase();
}

function getSongCoverDetails(song) {
  if (song.cover && song.cover.mbid /* cover artist mbid */ && song.cover.name) {
    return {
      isCover: true,
      originalArtistMbid: song.cover.mbid,
      originalArtistName: song.cover.name
    }
  } else return { isCover: false }      
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
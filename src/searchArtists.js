'use strict';

const https = require('https');

const searchArtistURL = process.env.SETLISTFM_SEARCH_ARTIST_ENDPOINT; 

const noMatchMessage = process.env.STRING_NO_ARTIST_MATCH;
const noArtistProvidedMessage = process.env.STRING_NO_ARTIST_PROVIDED;
const errorMessage = process.env.STRING_ERROR;

const options = {
  headers: {
    'Accept': 'application/json',
    'x-api-key': process.env.SETLISTFM_API_KEY
  }
};

module.exports.handler = (event, context, callback) => {
  console.log('Request:', JSON.stringify(event));

  // Find artist matching search term via Setlist.fm API
  // Pass callback funftion to fulfill promise when finished
  searchForArtist(event, callback);
};

function searchForArtist(event, callback) {

  if (event.queryStringParameters && event.queryStringParameters.artist) {
      let searchTermForArtist =  event.queryStringParameters.artist;
      console.log('Searching for Artist:', searchTermForArtist);

      https.get(searchArtistURL + searchTermForArtist, options, (res) => {

        console.log('Status Code:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers));

        res.setEncoding('utf8');

        res.on('data', (d) => {
          if (JSON.parse(d) && JSON.parse(d).artist) {
            let matchingArtist = findMatchingArtist(JSON.parse(d).artist, searchTermForArtist);
            
            if (matchingArtist && matchingArtist.mbid) {
              console.log('Matching Artist: ', matchingArtist);

              doCallback(matchingArtist, event, callback);
            } else {
              doCallback(noMatchMessage, event, callback);
            }

          } else {
            doCallback(noMatchMessage, event, callback);
          }
        });

        }).on('error', (e) => {
          console.log('Error:', e);
          
          doCallback(errorMessage, event, callback);
        });

    } else {
      // No artist was provided to search for
      doCallback(noArtistProvidedMessage, event, callback);
    }
}

function findMatchingArtist(artists, searchTerm) {
  let match;

  if (artists && artists.length > 0) {
    
    // Check each search result until we find an exact match (of lowercasers)
    artists.forEach(function (item, index) {
      if (checkArtistMatch(searchTerm, item.name)) {
          // Matching artist found
          match = {
            mbid: item.mbid,
            name: item.name
          };

          // Quit once a match is found
          return;
      }
    });
  }

  return match; 
}

function checkArtistMatch(searchedArtist, potentialMatch) {
  return searchedArtist.toLowerCase() == potentialMatch.toLowerCase();
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
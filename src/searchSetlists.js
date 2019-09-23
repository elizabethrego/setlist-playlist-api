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

module.exports.handler = (event, context, callback) => {
  console.log('Request:' + JSON.stringify(event));

  // Find artist matching search term via Setlist.fm API
  // Pass callback funftion to fulfill promise when finished
  searchForSetlist(event, callback);
};

function searchForSetlist(event, callback) {

  if (event.queryStringParameters && event.queryStringParameters.artistMbid) {
    let artistMbid =  event.queryStringParameters.artistMbid;
    console.log('Searching for Setlists for Artist MBID:' + artistMbid);
    
    let responseData = new Array(50);

    https.get(searchSetlistURL + artistMbid, options, (res) => {

      console.log('Status Code:' + res.statusCode);
      console.log('Headers:' + JSON.stringify(res.headers));

      res.setEncoding('utf8');
      
      
      res.on('data', (d) => {
        responseData.push(d);
      });
      
      res.on('end', (e) => {
        let fullResponse = responseData.join();
        
        console.log('fullResponse: ' + fullResponse);
        
        
        doCallback('coming soon', event, callback);
      });
      
      res.on('error', (e) => {
        console.log('Error:'+ e);
        
        doCallback(errorMessage, event, callback);
      });
      
    });

  } else {
    // This should never happen (lol)
    doCallback(errorMessage + ' lol', event, callback);
  }
}


function findMostRecentSetlist(setlists) {
  let validSetlist;

  if (setlists && setlists.length > 0) {
    
    // Check each setlist until we find one with at least one song
    //setlists.forEach(function (item, index) {
      //if (item.sets.set.length > 0 && item.sets.set[0].song.length > 0) {
          // console.log('Success!!!!');

          // validSetlist = item.sets.set[0].song; 
          // processSetlist(validSetlist);

          // Quit once a valid setlist is found
          // return;
      // }
    //});
  }

  return validSetlist; 
}

/*

function processSetlist(setlistToProcess) {
  // do something here with the array of songs: objects with name, maybe info props
}

*/


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
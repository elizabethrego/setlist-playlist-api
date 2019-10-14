'use strict'

const https = require('https')

const processEvent = (eventToProcess) => {
  if (eventToProcess.queryStringParameters) {
    
    let params = eventToProcess.queryStringParameters
    if (params.artistName && params.artistMbid) { 
      return params
    } else return false
  } else return false
}

const doGetRequest = (url, options) => {
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      res.setEncoding('utf8')

      let responseData = ''

      res.on('data', (d) => responseData += d )

      res.on('end', (e) => {
        let potentialError = JSON.parse(responseData).error

        if (potentialError) reject(potentialError.message)
        else resolve(responseData)
      })

      res.on('error', (e) => reject(e) )
    })
  })
}

const searchForSetlist = (artistInfo) => {
  return new Promise((resolve, reject) => {
    let errorMessage = process.env.STRING_ERROR
    
    if (artistInfo) {
      let setlistSearch = new SetlistSearch(artistInfo.artistName, artistInfo.artistMbid)

      console.log(`Searching for Setlists for Artist Name & MBID:
        ${setlistSearch.artist.name}, ${setlistSearch.artist.mbid}`)

      doGetRequest(setlistSearch.strings.searchSetlistURL + setlistSearch.artist.mbid, setlistSearch.httpOptions)
      .then( (searchResults) => {
        let potentialSetlists = JSON.parse(searchResults)
        
        if (potentialSetlists.setlist) {
          let setlist = setlistSearch.findMostRecentSetlist(potentialSetlists.setlist)
          if (setlist) resolve(setlist)
          else reject(setlistSearch.strings.noMatchMessage)
        } else reject(errorMessage)
      })
      .catch( () => reject(errorMessage) )
    } else reject(errorMessage);
  })
}

const getSongName = (song) => {
  let name = '';
      
  if (song.name) name = song.name;
  else if (song.info) {
    if (song.info.charAt(0) == '"') {
      name = song.info.substring(1, song.info.length - 1);
    } else name = song.info;
  }
  
  return name.toLowerCase();
}

const getSongCoverDetails = (song) => {
  if (song.cover && song.cover.mbid && song.cover.name) {
    return {
      isCover: true,
      originalArtistMbid: song.cover.mbid,
      originalArtistName: song.cover.name
    }
  } else return { isCover: false }      
}

class SetlistSearch {
  constructor(artistName = '', artistMbid = '') {
    this.httpOptions = {
      headers: {
        'Accept': 'application/json',
        'x-api-key': process.env.SETLISTFM_API_KEY
      }
    }

    this.artist = {
      name: artistName,
      mbid: artistMbid
    }

    this.strings = {
        searchSetlistURL: process.env.SETLISTFM_SEARCH_SETLIST_ENDPOINT,
        noMatchMessage: process.env.STRING_NO_SETLIST_MATCH
    } 
  }

  processSetlist(setlistToProcess, artistMbid) {
    let setlist = []
    let setlistInfo = this;
    
    setlistToProcess.forEach(function (item, index) {
      item.song.forEach(function (i, x) {
        setlist.push({
          name: getSongName(i),
          artistMbid: setlistInfo.artist.mbid,
          cover: getSongCoverDetails(i)
        })
      })
    })
    
    return setlist;
  }
  
  findMostRecentSetlist(setlists = []) {
    let setlist, foundSetlist
    let setlistInfo = this;

    if (setlists.length > 0) {
      // Check each setlist until we find one with at least one song 
      setlists.forEach(function (item) {
        if (item.sets.set.length > 0 && item.sets.set[0].song.length > 0 && !foundSetlist) {
             setlist = setlistInfo.processSetlist(item.sets.set) 
             foundSetlist = true
         }
      });
    }
    return setlist; 
  }
}

module.exports.handler = (event, context, callback) => {
  let processedEvent = processEvent(event)

  // Find artist matching search term via Setlist.fm API
  searchForSetlist(processedEvent)
  .then( (setlist) => callback(null, setlist) )
  .catch( (error) =>  callback(error) )
}
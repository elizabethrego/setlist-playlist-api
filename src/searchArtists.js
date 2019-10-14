'use strict'

const https = require('https')

const processEvent = (eventToProcess) => {
  if (eventToProcess.queryStringParameters && eventToProcess.queryStringParameters.artist) {
    return eventToProcess.queryStringParameters.artist
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

const searchForArtist = (searchTerm) => {
  return new Promise((resolve, reject) => {
    console.log(`Searching for Artist: ${searchTerm}`)

    const searchArtistURL = process.env.SETLISTFM_SEARCH_ARTIST_ENDPOINT
    const noMatchMessage = process.env.STRING_NO_ARTIST_MATCH

    let artistSearch = new ArtistSearch(searchTerm)
    let matchingArtist
  
    doGetRequest(searchArtistURL + artistSearch.name, artistSearch.httpOptions)
    .then( (searchResults) => {
      let potentialArtists = JSON.parse(searchResults).artist
      matchingArtist = artistSearch.findMatchingArtist(potentialArtists)
      
      if (matchingArtist) resolve(matchingArtist)
      else reject(noMatchMessage)
    }).catch( (error) => reject(error) )
  })
}

const checkArtistMatch = (searchedArtist = '', potentialMatch = '') => {
  if (searchedArtist.length && potentialMatch.length) {
    return searchedArtist.toLowerCase() == potentialMatch.toLowerCase()
  } else return false
}

class ArtistSearch {
  constructor(name = '') {
    this.httpOptions = {
      headers: {
        'Accept': 'application/json',
        'x-api-key': process.env.SETLISTFM_API_KEY
      }
    }

    this.name = name
    this.strings = {} 
  }

  findMatchingArtist(artists) {
    let match, foundMatch

    if (artists && artists.length > 0) {
      // Check each search result until we find an exact match (of lowercasers)
      for (let i = 0; i < artists.length; i++) {
        if (!foundMatch && checkArtistMatch(this.name, artists[i].name)) {
          // Matching artist found
          match = {
            mbid: artists[i].mbid,
            name: artists[i].name
          }
          foundMatch = true
        }
      } return match
    }
  }
}

module.exports.handler = (event, context, callback) => {
  // console.log('Request:', JSON.stringify(event));
  let processedEvent = processEvent(event)

  // Find artist matching search term via Setlist.fm API
  searchForArtist(processedEvent)
  .then( (artist) => callback(null, artist) )
  .catch( (error) =>  callback(error) )
};

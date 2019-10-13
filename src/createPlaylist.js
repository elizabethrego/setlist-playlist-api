'use strict'

const https = require('https')
const promise = require('promise')

const processEvent = (eventToProcess) => {
  if (eventToProcess.body && eventToProcess.body.message) {
    let message = eventToProcess.body.message
     
    if (message.token  && message.artistName && message.songs) return message
    else return false
  }
}

const createPlaylist = (setlistInfo) => {
  return new Promise((resolve, reject) => {
    if (setlistInfo) {
      let mySetlistInfo = new SetlistInfo(setlistInfo.token, setlistInfo.artistName, setlistInfo.songs)

      mySetlistInfo.stageSongsForPlaylist()
        .then( (trackUris) => {
          if (trackUris) return mySetlistInfo.processTrackUris(trackUris)  
          else reject(process.env.STRING_ERROR)
        }) 
        .then( (result) => createPlaylistOnSpotify(result) )
        .then( (urisForSpotify) => resolve(urisForSpotify) )
        .catch( (error) => reject(error) )
    } else reject(process.env.STRING_ERROR)
  })
}

const createPlaylistOnSpotify = (result) => {
  return new Promise((resolve, reject) => {
    // just passing it back for now, should do something like create a playlist
    resolve(result.uris)
  })
}

const checkSongNameMatch = (firstName = '', secondName = '') => {
  return firstName.toLowerCase() == secondName.toLowerCase()
}

const formatArtistOrSongName = (name = '') => {
  let splitName = name.split(' ')
  let formattedName = ''
  let numNamePieces = splitName.length
  
  for (let i = 0; i < numNamePieces; i++) {
      formattedName += splitName[i]
      formattedName += i < numNamePieces - 1  ? '+' :  '' // can we comment out last part?
  }
  
  return formattedName
}

const doRequest = (url, options) => {
  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      res.setEncoding('utf8')

      let responseData = ''

      res.on('data', (d) => { responseData += d } )

      res.on('end', (e) => {
        let potentialError = JSON.parse(responseData).error

        if (potentialError) {
          reject(potentialError.message)
        }
        else resolve(responseData)
      })

      res.on('error', (e) => reject(e) )
    })
  })
}

class SetlistInfo {
  constructor(token = '', artist = '', songs = []) {
    this.httpOptions = {
      headers: {
          'Authorization': `Bearer ${token}`
      }
    }
    
    this.artist = artist
    this.songs = songs
    this.missingSongs = []
    
    this.strings = {
      spotifyURLRoot: process.env.SPOTIFY_API_DOMAIN,
      searchTrackEndpoint: process.env.SPOTIFY_API_SEARCH_TRACK_ENDPOINT
    }
  }
  
  stageSongsForPlaylist() {
    return new Promise((resolve, reject) => {
      let songPromises = []
      let trackUris = []
      
      // Search for each song on Spotify, add the matching URI to returned list
      this.songs.forEach( (item, index) => {
        songPromises[index] = new Promise( (innerResolve) => { 
          this.searchForSong(item.name)
          .then( (trackUri) => {
            trackUris[index] = trackUri
            return innerResolve(trackUri)
          }).catch( (error) => {
            if (error.substring('token')) reject(error)
            else resolve(error) 
          })
        })
      }) 
  
      Promise.all(songPromises)
      .then( () => resolve(trackUris) )
    })
  }
  
  searchForSong(song) {
    return new Promise((resolve, reject) => {
      let query = this.formatSearchQuery(song)

      doRequest(this.strings.spotifyURLRoot + this.strings.searchTrackEndpoint + query, this.httpOptions)
      .then( (searchResult) => this.findMatchingTrackUri(song, searchResult) ) 
      .then(  (matchingUri) => resolve(matchingUri) ) // return the matching URI, or nada
      .catch( (error) => reject(error) ) // will cause the whole playlist to fail
    })
  }
  
  formatSearchQuery(track =  '') {
    return `?q=${formatArtistOrSongName(track)}+${formatArtistOrSongName(this.artist)}&type=track`
  } 
  
  findMatchingTrackUri(songName = '', searchResult = '{tracks:{items:{}}}') {
    return new Promise((resolve, reject) => {
      let potentialMatches = JSON.parse(searchResult).tracks.items
      let foundMatch = false
      
      if (potentialMatches.length) {
        for (let i = 0; i < potentialMatches.length; i++) {
          if (!foundMatch  && potentialMatches[i].name && potentialMatches[i].uri && checkSongNameMatch(songName, potentialMatches[i].name)) {
            foundMatch = true
            return resolve(potentialMatches[i].uri)
          }  else if (i == potentialMatches.length - 1) resolve()
        } 
      } else resolve() 
    })
  }
  
  processTrackUris(trackUris) {
    return new Promise((resolve, reject) => {
      let uriString = ''
      let numSongs = this.songs.length
  
      for (let i = 0; i < numSongs; i++) {
        if (trackUris[i]) {
          uriString += trackUris[i]
          uriString += i < numSongs - 1 ? ',' : ''
        } else this.missingSongs.push(this.songs[i].name) 
      }
  
      if (this.missingSongs.length < this.songs.length) {
        resolve({
          uris: uriString,
          missingSongs: this.missingSongs
        })
      } else reject(process.env.STRING_ERROR)
    })
  }
  
}

module.exports.handler = (event, context, callback) => {
    let processedEvent = processEvent(event)
    
    // Find each song in setlist and create Spotify  playlist
    createPlaylist(processedEvent)
    .then( (result) => callback(null, result) )
    .catch( (error) => {
      return callback(error) }) 
}
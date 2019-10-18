'use strict'

const https = require('https')

const processEvent = (eventToProcess) => {
  if (eventToProcess.body && eventToProcess.body.message) {
    let message = eventToProcess.body.message
     
    if (message.token  && message.artistName && message.songs) return message
    else return false
  }
}

const createPlaylistFromSetlist = (setlistInfo) => {
  return new Promise((resolve, reject) => {
    if (setlistInfo) {
      let mySetlistInfo = new SetlistInfo(setlistInfo.token, setlistInfo.artistName, setlistInfo.songs)

      mySetlistInfo.stageSongsForPlaylist()
        .then( (trackUris) => {
          if (trackUris) return mySetlistInfo.processTrackUris(trackUris)  
          else reject(process.env.STRING_ERROR)
        }) 
        .then( (processedTrackUris) => mySetlistInfo.createPlaylistOnSpotify(processedTrackUris) )
        .then( (playlistResult) => resolve(playlistResult) )
        .catch( (error) => reject(error) )
    } else reject(process.env.STRING_ERROR) // elli
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

const doGetRequest = (url, options) => {
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

const doPostRequest = (url, options, body) => {
  return new Promise((resolve, reject) => {
    let responseData = ''
    
   let req = https.request(url, options, (res) => {
      res.on('data', (d) => responseData += d )
      
      res.on('end', () => resolve(responseData) )
    })
    
    req.on('error', (e) => reject(e) )
    
    req.write(body);
    req.end();
    
  })
}

class SetlistInfo {
  constructor(token = '', artist = '', songs = []) {
    this.authHeader =  `Bearer ${token}`
    
    this.httpOptions = {
      getOptions: {
        headers: {
          'Authorization': this.authHeader 
        }
      },
      postOptions: {
        method: 'POST',
        headers: {
          'Authorization': this.authHeader,
          'Content-Type': 'application/json'
        }
      }
    }
    
    this.artist = artist
    this.songs = songs
    this.trackUris = []
    this.missingSongs = []
    this.userId = ''
    this.playlistTitle = `${this.artist}'s Latest Setlist #SetlistToPlaylist`
    
    this.strings = {
      spotifyURLRoot: process.env.SPOTIFY_API_DOMAIN,
      profileEndpoint: process.env.SPOTIFY_API_PROFILE_ENDPOINT,
      createPlaylistEndpoint: process.env.SPOTIFY_API_CREATE_PLAYLIST_ENDPOINT,
      errorMessage: process.env.STRING_ERROR
    } 
  }
  
  setTrackUris(trackUris) {
    this.trackUris = trackUris.uris
  }
  
  setUserId(userId) {
    this.userId = encodeURIComponent(userId)
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
            if (error instanceof String === false 
            || error.substring('token')) reject(error)
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
      let spotifyURLRoot = process.env.SPOTIFY_API_DOMAIN
      let searchTrackEndpoint = process.env.SPOTIFY_API_SEARCH_TRACK_ENDPOINT

      doGetRequest(spotifyURLRoot + searchTrackEndpoint + query, this.httpOptions.getOptions)
      .then( (searchResult) => this.findMatchingTrackUri(song, searchResult) ) 
      .then(  (matchingUri) => resolve(matchingUri) ) // return the matching URI, or nada
      .catch( (error) => reject(error) ) // will cause the whole playlist to fail
    })
  }
  
  formatSearchQuery(track =  '') {
    return `?q=${formatArtistOrSongName(track)}+${formatArtistOrSongName(this.artist)}&type=track`
  } 
  
  findMatchingTrackUri(songName = '', searchResult) {
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
      let processedTrackUris = []
      let numSongs = this.songs.length
  
      for (let i = 0; i < numSongs; i++) {
        if (trackUris[i]) processedTrackUris.push(trackUris[i])
        else this.missingSongs.push(this.songs[i].name) 
      }
  
      if (this.missingSongs.length < this.songs.length) {
        resolve({
          uris: processedTrackUris,
          missingSongs: this.missingSongs
        })
      } else reject(this.strings.errorMessage)
    })
  }
  
  getSpotifyUserId() {
    return new Promise((resolve, reject) => {
      doGetRequest(this.strings.spotifyURLRoot + this.strings.profileEndpoint, this.httpOptions.getOptions) 
      .then( (profile) => {
        this.setUserId(this.getUserIdFromProfile(profile))
        return resolve(this.userId) 
      }).catch( (error => reject(this.strings.errorMessage)) )
    })
  }
  
  createPlaylistOnSpotify(trackUris) {
    return new Promise((resolve, reject) => {
      this.setTrackUris(trackUris)
      
      this.getSpotifyUserId()
      .then( (userId) => this.createPlaylist(userId) )
      .then( (playlistInfo) => this.addSongsToPlaylist(JSON.parse(playlistInfo).id) )
       .then( (result) => resolve(result) )
      .catch( (error) => reject(`error: ${error}`) )
    })
  }
  
  createPlaylist(userId) {
    return new Promise((resolve, reject) => {
      let url = `${this.strings.spotifyURLRoot}/v1/users/${userId}/playlists` 
      let playlistJsonString = JSON.stringify({ name: this.playlistTitle })
      doPostRequest(url, this.httpOptions.postOptions, playlistJsonString)
      .then( (playlistId) => resolve(playlistId) )
      .catch( (error) => reject(`error: ${error}`) )
    })
  }
  
  addSongsToPlaylist(playlistId) {
    return new Promise((resolve, reject) => {
      let url = `${this.strings.spotifyURLRoot}/v1/playlists/${playlistId}/tracks`
      let trackUrisString = JSON.stringify({ uris: this.trackUris })
      doPostRequest(url, this.httpOptions.postOptions, trackUrisString)
      .then( (result) => resolve(result) )
      .catch( (error) => reject(`error: ${error}`) )
    })
  }
  
  getUserIdFromProfile(profile) { 
    let userId = JSON.parse(profile).id
    if (userId) return(userId)
  }
}

module.exports.handler = (event, context, callback) => {
    let processedEvent = processEvent(event)
    
    // Find each song in setlist and create Spotify  playlist
    createPlaylistFromSetlist(processedEvent)
    .then( (result) => callback(null, result) )
    .catch( (error) => {
      return callback(error) }) 
}
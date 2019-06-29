/* eslint-disable no-undef */
'use strict'

const FSQ_CLIENT_ID = 'W3X0AT5NV3YZAU2LQPC2XSZADKGSRXCD1DFMAO0HATQBZN53'
const FSQ_CLIENT_SECRET = 'R3OKIAZ4QYQBH2XYZ1OFB2OWFWQJPKKCOKIUPV0JVI22Y2YR'
var viewModel

// http://jsfiddle.net/qczdvkat/1/
ko.bindingHandlers.koScrollTo = {
  update: function (element, valueAccessor, allBindings) {
    var _value = valueAccessor()
    var _valueUnwrapped = ko.unwrap(_value)
    if (_valueUnwrapped) {
      // Scroll to the selected place in the list
      // Thank God there is such a function
      $('.list-group').scrollTo(element, {
        axis: 'y',
        duration: 500
      })
    }
  }
}

// Show toast error message for user
var showError = function (title, message, error) {
  var toastShown
  // Check if toast is displayed or no
  if ($('#toast').hasClass('hide')) {
    toastShown = false
  } else {
    toastShown = true
  }
  viewModel.toastTitle(title)
  var toastMessage = viewModel.toastMessage()
  // If toast is already displayed then append the new
  //  message to the existing one
  if (toastShown && toastMessage !== '' && !toastMessage.includes(message)) {
    viewModel.toastMessage(toastMessage + '<br />\n' + message)
  } else {
    // Otherwise replace the message
    viewModel.toastMessage(message)
  }
  $('#toast').toast('show')
  console.error(error)
}

/*
  The place class will hold all the KO observables
   and functions required to maintain and display
   a place in list of places.

  It will be linked to the list element (LI) in
   the HTML and to the marker on the map

  It contains function that retrieves the Foursquare
    photo URL and stores as means of volatile cache
*/
class Place {
  /*
    Constructor function based on a data structure
     similar to the one returned by the Google Maps
     API Place Text Search request
  */
  constructor (data) {
    var self = this
    self.id = data.place_id
    self.title = data.name
    self.address = data.formatted_address
    self.position = data.geometry.location
    self.photoUrlFetched = ko.observable(false)
    self.photoStatus = ko.observable(' ')
    self.photoAttribution = ko.observable('')
    self.photoUrl = ko.observable('')
    self.marker = createMarker(self.position, self.title, this)
    // Extract the city name from the start of the
    //  compound code value using regular expressions
    var match = data.plus_code.compound_code.match(/[^ ]+ ([^,]+)/)
    if (match) {
      self.city = match[1]
    } else {
      self.city = ''
    }

    /*
      Create an always ready computed haystack
       text to be used in filtering by concatenating
       all the required fields
    */
    self.haystack = self.title.toLowerCase() +
      ' ' +
      self.address.toLowerCase() +
      ' ' +
      self.city.toLowerCase()

    /*
      The function performs the actions required to
       fulfils the state of the place being selected

      The function is only called from the
       setCurrentPlace function on the root level
    */
    self.selected = ko.observable(false)
    self.select = function () {
      // console.dir("self.select " + self.title);
      self.selected(true)
      if (errorLoadingMapsApi) {
        return
      }
      // Fetch the photo URL in the background
      //  right upon place selection to save some
      //  load time and enhance user experience
      //  in case user clicks on the marker to
      //  display the info window
      self.loadFoursquarePhoto()
      currentMarker = self.marker
      self.marker.setIcon(selectedIcon)
      populateInfoWindow(self.marker, largeInfoWindow)
      // Bounce the selected marker twice
      self.marker.setAnimation(google.maps.Animation.BOUNCE)
      // Each bounce takes approximately 700ms
      //  so wait for 1400ms and then stop
      //  animation to bounce twice
      setTimeout(function () {
        self.marker.setAnimation(null)
      }, 1400)
    }

    /*
      The function performs the actions required to
       fulfils the state of the place being deselected

      The function is only called from the
       setCurrentPlace function on the root level
    */
    self.deselect = function () {
      // console.dir("self.deselect " + self.title);
      self.selected(false)
      if (errorLoadingMapsApi) {
        return
      }
      // If selection change was fast animation will
      //  be still running on old marker so stop it
      self.marker.setAnimation(null)
      // Revert markers icon to default
      self.marker.setIcon(defaultIcon)
      // Close info window upon deselection
      // To avoid closing the info window
      //  if it's open for another marker
      //  just make sure the windows is open
      //  for the marker being deselected
      if ((largeInfoWindow.marker = self.marker)) {
        // Use the close function as only setting
        //  the marker to null didn't work here
        largeInfoWindow.close()
        largeInfoWindow.marker = null
      }
    }

    /*
      Used to zoom/pan the map to linked marker
       position showing street level details
    */
    self.zoom = function () {
      if (errorLoadingMapsApi) {
        return
      }
      // console.dir("self.zoom to " + self.title);
      // Use the fit bounds function by calculating
      //  a border box around the marker position
      map.fitBounds({
        east: self.position.lng + 0.001,
        north: self.position.lat + 0.001,
        south: self.position.lat - 0.001,
        west: self.position.lng - 0.001
      })
    }

    /*
      Fetch a URL for the nearest photo available
       for this place on Foursquare

      Takes an optional "div_id" selector to insert
       image into automatically after loading

      The functions is called as part of the place
       selection process or separately when marker
       is pressed to display info window
    */
    self.loadFoursquarePhoto = function () {
      // console.dir("self.loadFoursquarePhoto for " + self.title);
      self.photoStatus('Loading photo...')

      // If the photo URL is already fetched avoid
      //  going through the fetching process again
      if (self.photoUrlFetched()) {
        return
      }
      // First retrieve the nearest venue Id
      var url =
        'https://api.foursquare.com/v2/venues/search' +
        '?client_id=' +
        FSQ_CLIENT_ID +
        '&client_secret=' +
        FSQ_CLIENT_SECRET +
        '&v=20190601&limit=1&ll=' +
        self.position.lat +
        ',' +
        self.position.lng +
        '&query=' +
        'mcdonald'
      $.ajax(url, { dataType: 'jsonp' })
        .done(function (data) {
          // console.dir("Requesting venue Id done for " + self.title);
          // Exit on HTTP error
          if (data.meta.code !== 200) {
            self.photoStatus('Sorry, no photo available 😔')
            showError(
              'Error',
              'Unknown error encountered when searching for Foursquare venue',
              data.meta.code + ': ' + data.meta.errorDetail
            )
            return
          }
          // Validate the correctness of the response
          if (
            data.response &&
            data.response.venues &&
            data.response.venues[0]
          ) {
            var venueId = data.response.venues[0].id
            self.photoAttribution('https://foursquare.com/v/' + venueId)
          } else {
            // If not all fields retrieved then consider
            //  this a permanent error and consider the
            //  photo URL fetch attempted
            self.photoUrlFetched(true)
            self.photoStatus('Sorry, no photo available 😔')
            // Exit
            return
          }
          // console.dir("Got venue Id " + venueId + " done for " + self.title);
          // Second use the previously retrieved venue Id to
          //  get the photo URL
          var url =
            'https://api.foursquare.com/v2/venues/' +
            venueId +
            '/photos' +
            '?client_id=' +
            FSQ_CLIENT_ID +
            '&client_secret=' +
            FSQ_CLIENT_SECRET +
            '&v=20190601&limit=1'
          $.ajax(url, { dataType: 'jsonp' })
            .done(function (data) {
              // console.dir("Requesting photo URL done for " + self.title);
              // Exit on HTTP error
              if (data.meta.code !== 200) {
                // Handle a common HTTP error returned by
                //  Foursquare when exceeding the requests
                //  quota for getting venues photos (didn't
                //  face this error with the previous request)
                if (data.meta.code === 429) {
                  self.photoStatus('Sorry, no photo available 😔')
                  showError(
                    'Error',
                    'Foursquare photo quota exceeded, no photos will be available for some time',
                    'Foursquare photo quota exceeded'
                  )
                } else {
                  self.photoStatus('Sorry, no photo available 😔')
                  showError(
                    'Error',
                    'Unknown error encountered when trying to fetch Foursquare photo',
                    data.meta.code + ': ' + data.meta.errorDetail
                  )
                }
                return
              }
              // Regardless of whether a photo URL is available
              //  or no in the data by this stage the photo URL
              //  is considered fetched
              self.photoUrlFetched(true)
              if (
                data.response &&
                data.response.photos &&
                data.response.photos.items &&
                data.response.photos.items[0]
              ) {
                var prefix = data.response.photos.items[0].prefix
                var suffix = data.response.photos.items[0].suffix
                // Resize photo to maximum 300px in width or height
                //  keeping the aspect ratio
                self.photoUrl(prefix + 'cap300' + suffix)
                self.photoStatus('')
              } else {
                // If not all fields retrieved then consider
                //  this a permanent error and consider the
                //  photo URL fetch attempted
                self.photoUrlFetched(true)
                self.photoStatus('Sorry, no photo available 😔')
              }
            })
            .fail(function (data) {
              self.photoStatus('Sorry, no photo available 😔')
              showError(
                'Error',
                'Problem contacting Foursquare, please check your internet connection',
                'Error getting Foursquare venue Id'
              )
            })
        })
        .fail(function (data) {
          self.photoStatus('Sorry, no photo available 😔')
          showError(
            'Error',
            'Problem contacting Foursquare, please check your internet connection',
            'Error getting Foursquare photo URL'
          )
        })
    }
  }
}

var ViewModel = function () {
  var self = this

  self.locationType = ko.observable('specific')
  self.sidebarActive = ko.observable(false)
  self.toastTitle = ko.observable('')
  self.toastMessage = ko.observable('')

  // The array that will hold the loaded places
  self.placesList = ko.observableArray([])

  // ************ Selecting a place from the list ************ //
  // Create an observable to hold the current place
  // Initialize with an empty class to allow KO
  //  binding with photo info window
  self.currentPlace = ko.observable()
  // Select place to be current if
  //  user clicks it
  self.placeClicked = function (place) {
    // If user clicks the same selected
    //  place again then zoom to its marker
    if (self.currentPlace() === place) {
      place.zoom()
    }
    self.setCurrentPlace(place)
  }
  // Function to handle selecting a place
  self.setCurrentPlace = function (place) {
    // console.dir("self.setCurrentPlace to " + place.title);
    // If there is a previous place set as current
    if (self.currentPlace()) {
      // Then if it equals the newly passed one then
      if (self.currentPlace() === place) {
        // do nothing, and exit function
        return
      }
      // Else deselect the previously selected place
      self.currentPlace().deselect()
    }
    // Set the newly passed place as the current one
    self.currentPlace(place)
    // Then select it
    place.select()
    // Ok, the info window moves the photo div
    //  through the DOM and so breaks the KO bindings
    // And if I try to re-apply the bindings again
    //  I will get a KO error that I can't apply
    //  bindings to the same element twice
    // The only way is to clear then re-apply
    ko.cleanNode($('#info-window')[0])
    ko.applyBindings(viewModel, $('#info-window')[0])
  }

  // ************ Zoom to displayed markers ************ //

  /*
    Creates or sets initial values for bounds object
     designed as input to the fitBounds function

    It will contain maps bounds to include all
     currently displayed markers
  */
  self.resetBounds = function () {
    // The initial values are set below/above
    //  the min/max thresholds for lat/lng
    //  to be ready for comparison
    self.bounds = {
      east: -1000, // lng
      north: -1000, // lat
      south: 1000, // lat
      west: 1000 // lng
    }
  }
  // Initialize the variable using the function
  self.resetBounds()

  /*
    Function will be called for every place that
     passes the current filter analogous with the
     visible markers on the map

    The idea is to make sure that all places
     (markers) are included within map bounds
     and so for every marker if lat/lng falls
     below/above bounds change the bounds
     to encompass the marker position (taking
     into consideration an additional margin
     around the markers)
  */
  self.updateBounds = function (place) {
    var margin = 0.001
    if (place.position.lng > self.bounds.east - margin) {
      self.bounds.east = place.position.lng + margin
    }
    if (place.position.lat > self.bounds.north - margin) {
      self.bounds.north = place.position.lat + margin
    }
    if (place.position.lat < self.bounds.south + margin) {
      self.bounds.south = place.position.lat - margin
    }
    if (place.position.lng < self.bounds.west + margin) {
      self.bounds.west = place.position.lng - margin
    }
  }

  // Finally a function that the actual map zoom
  // It will be attached to a button on the view
  self.fitToBounds = function () {
    if (errorLoadingMapsApi) {
      return
    }
    map.fitBounds(self.bounds)
  }

  // ************ Real-time places & markers filtering ************ //

  /*
    This KO observable will be the center of the
     filtering process, it will be attached to value
     of a filter text box on the view
  */
  self.filterText = ko.observable('')
  // This boolean check will mark the completion
  //  of automatic selection of the first place
  //  after applying the filter
  self.filterHandled = false
  // Reset some variables with every filter change
  self.filterText.subscribe(
    function (oldValue) {
      // Before applying filter make filter handled
      //  check is false and ready for the new filter
      self.filterHandled = false
      // Also make sure that bounds are reset
      //  to clear previous bounds which might
      //  render the bounds variable useless
      self.resetBounds()
    },
    null,
    'beforeChange'
  )

  /*
    This function is attached to the "hidden" attribute
     of places in the filtered list, returning true
     if the passed place should be filtered out and
     false otherwise and in the process handled several
     other actions related to filtering
  */
  self.filterPlace = function (place) {
    // Initialize variable
    var hidden = false
    var filterText = self.filterText()
    // If filter text is empty then set
    //  "hidden" variable to false else
    //  search for filter text in haystack
    if (filterText !== '') {
      // Loop on all words in the filter text
      //  and make sure they all exist in the
      //  haystack text, one missing word and
      //  "hidden" will be set to true and
      //  search ends
      filterText
        .toLowerCase()
        .split(' ')
        .forEach(needle => {
          if (place.haystack.indexOf(needle) === -1) {
            hidden = true
            // eslint-disable-next-line no-useless-return
            return
          }
        })
    }
    // If this place is not hidden and filter
    //  hasn't been handled yet this means
    //  that this is the first to displayed in
    //  the list and so it will be automatically
    //  selected instead of whatever place
    //  was selected before filtering
    if (!hidden && !self.filterHandled) {
      // Mark this filter as handled
      self.filterHandled = true
      // Select the first displayed place
      self.setCurrentPlace(place)
    }
    if (errorLoadingMapsApi) {
      return hidden
    }
    // If place is hidden then hide its
    //  corresponding marker
    if (hidden) {
      place.marker.setMap(null)
    } else {
      // Otherwise show the linked marker
      place.marker.setMap(map)
      // And update the bounds to include
      //  this place's position
      self.updateBounds(place)
    }
    // Finally return the boolean "hidden"
    //  for the view to hide filtered out
    //  places
    return hidden
  }

  // Simple function that fills the places
  //  array from JSON data source
  self.isLoadingPlaces = ko.observable(false)
  self.loadPlaces = function (data) {
    data.forEach(place => {
      self.placesList.push(new Place(place))
    })
  }
}

window.addEventListener('load', function () {
  // Initialize ViewModel
  viewModel = new ViewModel()
  ko.applyBindings(viewModel)
  // console.log("ko bindings applied");
  // Load data from JSON variable
  viewModel.isLoadingPlaces(true)
  viewModel.loadPlaces(mcData.results)
  viewModel.isLoadingPlaces(false)
  // If there is an error report connection issue to the user
  if (errorLoadingMapsApi) {
    showError(
      'Error',
      'Cannot load Google Maps API, please check your internet connection',
      'Error loading Google Maps'
    )
  }
})

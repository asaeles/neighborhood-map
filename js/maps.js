/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
var map
var largeInfoWindow
var defaultIcon
var highlightedIcon
var selectedIcon
var currentMarker

// This function takes in a COLOR, and then creates a new marker
// icon of that color. The icon will be 21 px wide by 34 high, have an origin
// of 0, 0 and be anchored at 10, 34).
function makeMarkerIcon (markerColor) {
  var markerImage = new google.maps.MarkerImage(
    'http://chart.googleapis.com/chart?chst=d_map_spin&chld=1.15|0|' +
      markerColor +
      '|40|_|%E2%80%A2',
    new google.maps.Size(21, 34),
    new google.maps.Point(0, 0),
    new google.maps.Point(10, 34),
    new google.maps.Size(21, 34)
  )
  return markerImage
}

// eslint-disable-next-line no-unused-vars
function initMap () {
  // Constructor creates a new map - only center and zoom are required.
  map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 26.244653, lng: 29.3780723 },
    zoom: 6,
    mapTypeControl: false
  })

  largeInfoWindow = new google.maps.InfoWindow({
    content: $('#info-window')[0]
  })

  // Style the markers a bit. This will be our listing marker icon.
  defaultIcon = makeMarkerIcon('0091ff')

  // Create a "highlighted location" marker color for when the user
  // mouses over the marker.
  highlightedIcon = makeMarkerIcon('FFFF24')

  // Create separate color for currently selected marker
  selectedIcon = makeMarkerIcon('FFDD00')

  // console.log("maps initialization finished");
}

/*
  This function populates the infoWindow when the marker is clicked. We'll only allow
   one infoWindow which will open at the marker that is clicked, and populate based
   on that markers position.
 */
function populateInfoWindow (marker, infoWindow, place) {
  // console.dir("populateInfoWindow for " + place.title());
  // Check to make sure the infoWindow is not already opened on this marker.
  if (infoWindow.marker !== marker) {
    // console.dir("infoWindow.marker != marker");
    infoWindow.marker = marker
    // Make sure the marker property is cleared if the infoWindow is closed.
    infoWindow.addListener('closeclick', function () {
      infoWindow.marker = null
    })
    // Finally open the info window
    infoWindow.open(map, marker)
  } else {
    // console.dir("infoWindow.marker == marker");
    // Open the infoWindow on the correct marker.
    infoWindow.open(map, marker)
  }
}

/*
  Creates the marker and returns it

  Takes as input parameters in addition to the
   position and title the KO place object
   as this will be the only clue to connect the
   two together
*/
function createMarker (position, title, place) {
  // This is the first API to be hit by
  //  connection issues and so I will check
  //  first for the status of the Google API
  //  object here
  // If there any errors during the check
  //  then I'll assume this is due to
  //  connection issues
  var errorLoading = false
  try {
    if (!(typeof google === 'object') || !(typeof google.maps === 'object')) {
      errorLoading = true
    }
  } catch (error) {
    errorLoading = true
  }

  // If there is an error report connection issue to the user
  if (errorLoading) {
    showError(
      'Error',
      'Cannot load Google Maps API, please check your internet connection',
      'error loading Google Maps'
    )
  }

  // Create a marker per location, and put into markers array.
  var marker = new google.maps.Marker({
    map: map,
    position: position,
    title: title,
    // animation: google.maps.Animation.DROP,
    icon: defaultIcon
  })
  // console.dir(marker);
  // Create an onclick event to open the large infoWindow at each marker.
  marker.addListener('click', function () {
    // console.dir("marker clicked");
    // Set the current place to that of the marker
    viewModel.setCurrentPlace(place)
    // Scroll to the selected place in the list
    // Thank God there is such a function
    $('.list-group').scrollTo(place.$element, {
      axis: 'y',
      duration: 500
    })
    // Now populate and show the info window
    populateInfoWindow(this, largeInfoWindow, place)
  })
  // Two event listeners - one for mouseover, one for mouseout,
  // to change the colors back and forth.
  marker.addListener('mouseover', function () {
    this.setIcon(highlightedIcon)
  })
  marker.addListener('mouseout', function () {
    // That's the only use for the currentMarker
    //  variable just to know which marker to
    //  return to after moving out the mouse
    if (this === currentMarker) {
      this.setIcon(selectedIcon)
    } else {
      this.setIcon(defaultIcon)
    }
  })
  // Finally return the marker object
  return marker
}

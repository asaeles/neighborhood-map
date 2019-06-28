const FSQ_CLIENT_ID = "J4H4JBBATWFZ4VOFEESVMXTQDYSVZMYIVHQFYD0YQHFDDL3F";
const FSQ_CLIENT_SECRET = "Q2FD41LDRMROT0TFWG2BHA5UNGODSMM45XTEF5KI1YQONG1N";

// https://gist.github.com/chrisjhoughton/7890303
var waitForEl = function(selector, callback) {
  if (jQuery(selector).length) {
    callback();
  } else {
    setTimeout(function() {
      waitForEl(selector, callback);
    }, 100);
  }
};

// Show toast error message for user
var showError = function(title, message, error) {
  $("#toast-title").text(title);
  $("#toast-message").text(message);
  $(".toast").toast("show");
  console.error(error);
};

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
  constructor(data) {
    var self = this;
    self.id = ko.observable(data.place_id);
    self.title = ko.observable(data.name);
    self.address = ko.observable(data.formatted_address);
    self.position = ko.observable(data.geometry.location);
    self.photo_url_fetched = ko.observable(false);
    self.marker = createMarker(self.position(), self.title(), this);
    // Extract the city name from the start of the
    //  compound code value using regular expressions
    var match = data.plus_code.compound_code.match(/[^ ]+ ([^,]+)/);
    if (match) {
      match = match[1];
    } else {
      match = "";
    }
    self.city = ko.observable(match);

    /*
      Create an always ready computed haystack
       text to be used in filtering by concatenating
       all the required fields
    */
    self.haystack = ko.computed(function() {
      return (
        self.title().toLowerCase() +
        " " +
        self.address().toLowerCase() +
        " " +
        self.city().toLowerCase()
      );
    }, this);

    /*
      The function performs the actions required to
       fulfils the state of the place being selected

      The function is only called from the
       setCurrentPlace function on the root level
    */
    self.selected = ko.observable(false);
    self.select = function() {
      // console.dir("self.select " + self.title());
      self.selected(true);
      // Fetch the photo URL in the background
      //  right upon place selection to save some
      //  load time and enhance user experience
      //  in case user clicks on the marker to
      //  display the info window
      self.loadFoursquarePhoto();
      currentMarker = self.marker;
      self.marker.setIcon(selectedIcon);
      // Center map to marker position with
      //  animation without zooming-in
      //  using the pan to function
      map.panTo(self.position());
      // Bounce the selected marker twice
      self.marker.setAnimation(google.maps.Animation.BOUNCE);
      // Each bounce takes approximately 700ms
      //  so wait for 1400ms and then stop
      //  animation to bounce twice
      setTimeout(function() {
        self.marker.setAnimation(null);
      }, 1400);
    };

    /*
      The function performs the actions required to
       fulfils the state of the place being deselected

      The function is only called from the
       setCurrentPlace function on the root level
    */
    self.deselect = function() {
      // console.dir("self.deselect " + self.title());
      // If selection change was fast animation will
      //  be still running on old marker so stop it
      self.marker.setAnimation(null);
      // Revert markers icon to default
      self.marker.setIcon(defaultIcon);
      // Close info window upon deselection
      // To avoid closing the info window
      //  if it's open for another marker
      //  just make sure the windows is open
      //  for the marker being deselected
      if ((largeInfoWindow.marker = self.marker)) {
        // Use the close function as only setting
        //  the marker to null didn't work here
        largeInfoWindow.close();
        largeInfoWindow.marker = null;
      }
      self.selected(false);
    };

    /*
      Used to zoom/pan the map to linked marker
       position showing street level details
    */
    self.zoom = function() {
      console.dir("self.zoom to " + self.title());
      // Use the fit bounds function by calculating
      //  a border box around the marker position
      map.fitBounds({
        east: self.position().lng + 0.001,
        north: self.position().lat + 0.001,
        south: self.position().lat - 0.001,
        west: self.position().lng - 0.001
      });
    };

    /*
      Fetch a URL for the nearest photo available
       for this place on Foursquare

      Takes an optional "div_id" selector to insert
       image into automatically after loading

      The functions is called as part of the place
       selection process or separately when marker
       is pressed to display info window
    */
    self.loadFoursquarePhoto = function(div_id) {
      // console.dir(
      //   "self.loadFoursquarePhoto for " + self.title() + " under " + div_id
      // );

      // If the photo URL is already fetched avoid
      //  going through the fetching process again
      if (self.photo_url_fetched()) {
        console.dir();
        // If div selector provided insert image into it
        if (div_id) {
          // If there is an image load it and insert it
          //  into provided div
          if (self.photo) {
            var image = new Image();
            // Wait for image to load first to avoid
            //  centering the info window before achieving
            //  the full final size of the image
            image.onload = function() {
              if (self.selected) {
                $("#" + div_id).html('<img src="' + self.photo + '">');
                // Re-center info windows after being stretched
                //  due to image insertion
                largeInfoWindow.open(map, self.marker);
              }
            };
            image.src = self.photo;
            // If no photo URL found then display error
            //  message instead
          } else {
            // At this stage no loading time has been
            //  spent and so the info window is probably
            //  not displayed yet and so the error message
            //  will not be shown, and because it doesn't
            //  take long for the info window to be
            //  displayed so it safe to wait for it without
            //  decreasing performance or user experience
            waitForEl("#" + div_id, function() {
              $("#" + div_id).html("Sorry, no photo available 😔");
            });
          }
        }
        return;
      }
      // First retrieve the nearest venue Id
      var url =
        "https://api.foursquare.com/v2/venues/search" +
        "?client_id=" +
        FSQ_CLIENT_ID +
        "&client_secret=" +
        FSQ_CLIENT_SECRET +
        "&v=20190601&limit=1&ll=" +
        self.position().lat +
        "," +
        self.position().lng +
        "&query=" +
        "mcdonald";
      $.ajax(url, { dataType: "jsonp" })
        .done(function(data) {
          // console.dir("Requesting venue Id done for " + self.title());
          // Exit on HTTP error
          if (data.meta.code != 200) {
            console.dir(data);
            return;
          }
          // Validate the correctness of the response
          if (
            data.response &&
            data.response.venues &&
            data.response.venues[0]
          ) {
            var venue_id = data.response.venues[0].id;
          } else {
            // If not all fields retrieved then consider
            //  this a permanent error and consider the
            //  photo URL fetch attempted
            self.photo_url_fetched(true);
            // If div selector is provided display error message
            //  instead of image
            $("#" + div_id).html("Sorry, no photo available 😔");
            // Exit
            return;
          }
          // console.dir("Got venue Id " + venue_id + " done for " + self.title());
          // Second use the previously retrieved venue Id to
          //  get the photo URL
          var url =
            "https://api.foursquare.com/v2/venues/" +
            venue_id +
            "/photos" +
            "?client_id=" +
            FSQ_CLIENT_ID +
            "&client_secret=" +
            FSQ_CLIENT_SECRET +
            "&v=20190601&limit=1";
          $.ajax(url, { dataType: "jsonp" })
            .done(function(data) {
              // console.dir("Requesting photo URL done for " + self.title());
              // Exit on HTTP error
              if (data.meta.code != 200) {
                // Handle a common HTTP error returned by
                //  Foursquare when exceeding the requests
                //  quota for getting venues photos (didn't
                //  face this error with the previous request)
                if ((data.meta.code = 429)) {
                  showError(
                    "Error",
                    "Foursquare photo quota exceeded, no photos will be available for some time",
                    "Foursquare photo quota exceeded"
                  );
                }
                return;
              }
              // Regardless of whether a photo URL is available
              //  or no in the data by this stage the photo URL
              //  is considered fetched
              self.photo_url_fetched(true);
              if (
                data.response &&
                data.response.photos &&
                data.response.photos.items &&
                data.response.photos.items[0]
              ) {
                var prefix = data.response.photos.items[0].prefix;
                var suffix = data.response.photos.items[0].suffix;
                // Resize photo to maximum 300px in width or height
                //  keeping the aspect ratio
                self.photo = prefix + "cap300" + suffix;
                // console.dir("Got photo URL for " + self.title());

                // If div selector provided and place is currently
                //  selected load and insert image into it
                if (self.selected && div_id) {
                  var image = new Image();
                  // Wait for image to load first to avoid
                  //  centering the info window before achieving
                  //  the full final size of the image
                  image.onload = function() {
                    if (self.selected) {
                      $("#" + div_id).html('<img src="' + self.photo + '">');
                      // Re-center info windows after being stretched
                      //  due to image insertion
                      largeInfoWindow.open(map, self.marker);
                    }
                  };
                  image.src = self.photo;
                }
              } else {
                // If div selector is provided display error message
                //  instead of image
                $("#" + div_id).html("Sorry, no photo available 😔");
              }
            })
            .fail(function(data) {
              showError(
                "Error",
                "Problem contacting Foursquare, please check your internet connection",
                "Error getting Foursquare venue Id"
              );
            });
        })
        .fail(function(data) {
          showError(
            "Error",
            "Problem contacting Foursquare, please check your internet connection",
            "Error getting Foursquare photo URL"
          );
        });
    };
  }
}

var ViewModel = function() {
  var self = this;

  self.locationType = ko.observable("specific");
  self.sidebarActive = ko.observable(false);

  // The array that will hold the loaded places
  self.placesList = ko.observableArray([]);

  // ************ Selecting a place from the list ************ //
  // Create an observable to hold the current place
  self.currentPlace = ko.observable();
  // Select place to be current if
  //  user clicks it
  self.placeClicked = function(place) {
    // If user clicks the same selected
    //  place again then zoom to its marker
    if (self.currentPlace() == place) {
      place.zoom();
    }
    self.setCurrentPlace(place);
  };
  // Function to handle selecting a place
  self.setCurrentPlace = function(place) {
    // console.dir("self.setCurrentPlace to " + place.title());
    // If there is a previous place set as current
    if (self.currentPlace()) {
      // Then if it equals the newly passed one then
      if (self.currentPlace() == place) {
        // do nothing, and exit function
        return;
      }
      // Else deselect the previously selected place
      self.currentPlace().deselect();
    }
    // Set the newly passed place as the current one
    self.currentPlace(place);
    // Then select it
    place.select();
  };

  // Link the LI element to the KO place object
  //  to simplify view manipulation later on
  self.linkElement = function(element, index, data) {
    if (element.parentNode.nodeName != "UL" || element.nodeName != "LI") {
      return;
    }
    data.$element = $(element);
  };

  // ************ Zoom to displayed markers ************ //

  /*
    Creates or sets initial values for bounds object
     designed as input to the fitBounds function
     which will hold appropriate maps bounds for the
     currently displayed makers
  */
  self.resetBounds = function() {
    // The initial values are set below/above
    //  the min/max thresholds for lat/lng
    //  to be ready for comparison
    self.bounds = {
      east: -1000, //lng
      north: -1000, //lat
      south: 1000, //lat
      west: 1000 //lng
    };
  };
  // Initialize the variable using the function
  self.resetBounds();

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
  self.updateBounds = function(place) {
    var margin = 0.001;
    if (place.position().lng > self.bounds.east - margin) {
      self.bounds.east = place.position().lng + margin;
    }
    if (place.position().lat > self.bounds.north - margin) {
      self.bounds.north = place.position().lat + margin;
    }
    if (place.position().lat < self.bounds.south + margin) {
      self.bounds.south = place.position().lat - margin;
    }
    if (place.position().lng < self.bounds.west + margin) {
      self.bounds.west = place.position().lng - margin;
    }
  };

  // Finally a function that the actual map zoom
  // It will be attached to a button on the view
  self.fitToBounds = function() {
    map.fitBounds(self.bounds);
  };

  // ************ Real-time places & markers filtering ************ //

  /* 
    This KO observable will be the center of the
     filtering process, it will be attached to value
     of a filter text box on the view
  */
  self.filterText = ko.observable("");
  // This boolean check will mark the completion
  //  of automatic selection of the first place
  //  after applying the filter
  self.filterHandled = false;
  // Reset some variables with every filter change
  self.filterText.subscribe(
    function(oldValue) {
      // Before applying filter make filter handled
      //  check is false and ready for the new filter
      self.filterHandled = false;
      // Also make sure that bounds are reset
      //  to clear previous bounds which might
      //  render the bounds variable useless
      self.resetBounds();
    },
    null,
    "beforeChange"
  );

  /* 
    This function is attached to the "hidden" attribute
     of places in the filtered list, returning true
     if the passed place should be filtered out and
     false otherwise and in the process handled several
     other actions related to filtering
  */
  self.filterPlace = function(place) {
    // Initialize variable
    var hidden = false;
    var filterText = self.filterText();
    // If filter text is empty then set
    //  "hidden" variable to false else
    //  search for filter text in haystack
    if (filterText != "") {
      // Loop on all words in the filter text
      //  and make sure they all exist in the
      //  haystack text, one missing word and
      //  "hidden" will be set to true and
      //  search ends
      filterText
        .toLowerCase()
        .split(" ")
        .forEach(needle => {
          if (place.haystack().indexOf(needle) === -1) {
            hidden = true;
            return;
          }
        });
    }
    // If this place is not hidden and filter
    //  hasn't been handled yet this means
    //  that this is the first to displayed in
    //  the list and so it will be automatically
    //  selected instead of whatever place
    //  was selected before filtering
    if (!hidden && !self.filterHandled) {
      // Mark this filter as handled
      self.filterHandled = true;
      // Select the first displayed place
      self.setCurrentPlace(place);
    }
    // If place is hidden then hide its
    //  corresponding marker
    if (hidden) {
      place.marker.setMap(null);
    } else {
      // Otherwise show the linked marker
      place.marker.setMap(map);
      // And update the bounds to include
      //  this place's position
      self.updateBounds(place);
    }
    // Finally return the boolean "hidden"
    //  for the view to hide filtered out
    //  places
    return hidden;
  };

  // Simple function that fills the places
  //  array from JSON data source
  self.isLoadingPlaces = ko.observable(false);
  self.loadPlaces = function(data) {
    data.forEach(place => {
      self.placesList.push(new Place(place));
    });
  };
};

window.addEventListener("load", function() {
  // Initialize ViewModel 
  viewModel = new ViewModel();
  ko.applyBindings(viewModel);
  // console.log("ko bindings applied");
  viewModel.isLoadingPlaces(true);
  // Load data from JSON source
  $.getJSON("json/mcdonalds.json", function(data) {
    // Pass it to the loading function
    viewModel.loadPlaces(data.results);
    //viewModel.setCurrentPlace(viewModel.placesList()[0]);
    viewModel.isLoadingPlaces(true);
  });
});

# Neighborhood Map

A front-end only implementation of yet another Google Maps search site.

The app displays a list of places on a retractable sidebar and as markers on a Google map with the ability to:
1. Zoom on the selected marker
2. Click on a marker to display an info window displaying a photo for the nearest match for the place from Foursquare
3. Filter the list and markers based on a free text search
4. Zoom to the currently filtered markers

The app uses the Knockout JS MVVM framework.

## Requirements

No special requirements but Google Chrome browser is recommended.

## Dependencies

1. Knockout JS
2. jQuery
3. Bootstrap Bundle
4. Google Maps API
5. Foursquare API

## Limitations

* Only a static list of McDonald's in Egypt is shown
* Foursquare quota for photo retrieval is very limited

## Usage

* Open `index.html` using any browser
* Or alternatively visit https://asaeles.github.io/neighborhood-map/

## Known Issues

* Selecting a place from the marker will trigger the AJAX function fetching the photo URL from Foursquare twice

## Room for improvements

* Add support portrait view placements
* Add Google Maps search functionality
* Display several Foursquare photos instead of just the first hit

## Contributions

I encourage you all to contribute into this simple project to make better and more usable.

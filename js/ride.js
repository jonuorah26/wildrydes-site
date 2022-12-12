/*global WildRydes _config*/

var WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};
let map;
let fare;
let startPoint = {marker: null, point: null};
let endPoint = {marker: null, point: null};
let _polyline;
let count = 0;

(function rideScopeWrapper($) {
    var authToken;
    WildRydes.authToken.then(function setAuthToken(token) {
        if (token) {
            authToken = token;
        } else {
            window.location.href = '/signin.html';
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.href = '/signin.html';
    });

    //  requestUnicorn
    //      make the POST request to the server
    function requestUnicorn(pickupLocation) {
        $.ajax({
            method: 'POST',
            url: _config.api.invokeUrl + '/ride',
            headers: {
                Authorization: authToken
            },
            data: JSON.stringify({
                PickupLocation: {
                    Latitude: pickupLocation.latitude,
                    Longitude: pickupLocation.longitude
                }
            }),
            contentType: 'application/json',
            success: result => completeRequest(result, pickupLocation),
            error: function ajaxError(jqXHR, textStatus, errorThrown) {
                console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
                console.error('Response: ', jqXHR.responseText);
                alert('An error occurred when requesting your unicorn:\n' + jqXHR.responseText);
            }
        });
    }

    //  completeRequest
    //      a Unicorn has been dispatched to your location
    function completeRequest(result, pickupLocation) {
        var unicorn;
        var pronoun;

        console.log('Response received from API: ', result);
        unicorn = result.Unicorn;
        pronoun = unicorn.Gender === 'Male' ? 'his' : 'her';
        displayUpdate(unicorn.Name + ', your ' + unicorn.Color + ' unicorn, is on ' + pronoun + ' way.', unicorn.Color);

        console.log(pickupLocation);
        //  get the local weather, find nearby restaurants, movies
        // getWeather(pickupLocation, unicorn)

        animateArrival(function animateCallback() {
            displayUpdate(unicorn.Name + ' has arrived. Giddy up!', unicorn.Color);
            WildRydes.map.unsetLocation();

            $('#request').prop('disabled', 'disabled');
            $('#request').text('Set Pickup');
        });
    }

    // Register click handler for #request button
    $(function onDocReady() {
        $('#request').click(handleRequestClick);

        WildRydes.authToken.then(function updateAuthMessage(token) {
            if (token) {
                displayUpdate('You are authenticated. Click to see your <a href="#authTokenModal" data-toggle="modal">auth token</a>.');
                $('.authToken').text(token);
            }
        });

        if (!_config.api.invokeUrl) {
            $('#noApiMessage').show();
        }

        window.navigator.geolocation
            .getCurrentPosition(setLocation);
            

        //  put the map behind the updates list
        document.getElementById("map").style.zIndex = "10";

        function setLocation(loc) {
            //console.log("Curr location: " + loc.coords.latitude + ", " + loc.coords.longitude)

            map = L.map('map').setView([loc.coords.latitude, loc.coords.longitude], 13);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '© OpenStreetMap'
            }).addTo(map);

            WildRydes.map.center = {latitude: loc.coords.latitude, longitude: loc.coords.longitude};
            let b = map.getBounds();        //  TODO moved
            WildRydes.map.extent = {minLat: b._northEast.lat, minLng: b._northEast.lng,
                maxLat: b._southWest.lat, maxLng: b._southWest.lng};

            //WildRydes.marker  = L.marker([loc.coords.latitude, loc.coords.longitude]).addTo(map);
            var myIcon = L.icon({
                iconUrl: 'images/unicorn-icon.png',
                iconSize: [25, 25],
                iconAnchor: [22, 24],
                shadowSize: [25, 25],
                shadowAnchor: [22, 24]
            });
            WildRydes.unicorn = L.marker([loc.coords.latitude, loc.coords.longitude], {icon: myIcon}).addTo(map);
            // WildRydes.marker.bindPopup("<b>Hello world!</b><br>I am a popup.").openPopup();

            // var popup = L.popup();
            map.on('click', onMapClick);

            

            function onMapClick(e) {            //  TODO move to esri.js
                ++count;
                var requestButton = $('#request');
                
                //WildRydes.map.selectedPoint = {longitude: e.latlng.lng, latitude: e.latlng.lat};

                switch(count)
                {
                    case 1:
                        WildRydes.marker  = L.marker([e.latlng.lat, e.latlng.lng]).addTo(map);
                        startPoint.marker =  WildRydes.marker;
                        startPoint.point = e.latlng;
                        requestButton.html('Set drop-off');
                        break;
                    case 2:
                        WildRydes.marker  = L.marker([e.latlng.lat, e.latlng.lng], {color: 'green'}).addTo(map);
                        endPoint.marker = WildRydes.marker;
                        endPoint.marker._icon.classList.add("huechange");
                        endPoint.point = e.latlng;
                        break;
                    default:
                        if (_polyline) {
                            map.removeLayer(_polyline);
                            _polyline = null;
                        }
                        startPoint.marker.remove();
                        endPoint.marker.remove();
                        count = 0;
                        requestButton.html('Set pickup');
                        requestButton.prop('disabled', true);
                        break;
                }

                if(count == 2)
                {
                    _polyline = L.polyline([startPoint.point, endPoint.point], {
                        color: 'red'
                    });
                    _polyline.addTo(map);

                    WildRydes.map.selectedPoint = {longitude: startPoint.point.lng, latitude: startPoint.point.lat};

                    fare = CalculateFare(startPoint.point, endPoint.point);
                    handlePickupChanged();
                }
                //if (WildRydes.marker)       WildRydes.marker.remove();
                //console.log("count: " + count)
                /*
                if(count > 2){ 
                    while(count){
                        console.log("count in loop: " + count)
                        WildRydes.marker.remove();
                        --count;
                    } 
                    count = 0;
                }
                */
                

                

                // popup
                //     .setLatLng(e.latlng)
                //     .setContent("You clicked the map at " + e.latlng.toString())
                //     .openOn(map);
            }

            function CalculateFare(start, end)
            {
                let date = new Date();
                let rate = 0;
                let fare;
                
                let day = date.getDay();
                (day > 0 && day < 5) ? (rate += 1.50) : (rate += 2.50); //more expensive rate for weekends (includes Friday because thats when the partying starts)
                let hour = date.getHours();
                if(hour >=0 && hour <= 6) // late night/early morning hours
                {
                    rate += 1.00
                }
                else if(hour >= 7 && hour < 12) // Morning hours
                {
                    rate += 0.75
                }
                else if(hour >= 12 && hour < 18) // Afternoon hours
                {
                    rate += 0.60
                }
                else // Evening/night hours
                {
                    rate += 0.85
                }
                let month = date.getMonth();
                let dateNum = date.getDate();
                if(month == 11 && (dateNum == 24 || dateNum == 25)) //Extra charge rate on Christmas and Christmas Eve!
                {
                    switch(dateNum)
                    {
                        case 24: //Christmas Eve extra rate
                            rate += 3.00;
                            break;
                        case 25: //Christmas extra rate
                            rate += 4.00
                    }
                }

                let dist = map.distance(start, end);

                fare = (dist * rate) / 2000; //final fare in $

                return fare;

            }
        }
    });

    //  handlePickupChanged
    //      enable the Pickup button and set text to Request Unicorn
    function handlePickupChanged() {
        var requestButton = $('#request');
        requestButton.html('Request Unicorn<br>Fare: $' + fare.toFixed(2));
        requestButton.prop('disabled', false);
    }

    //  handleRequestClick
    //      get current request location and POST request to server
    function handleRequestClick(event) {
        var pickupLocation =  WildRydes.map.selectedPoint;

        event.preventDefault();
        requestUnicorn(pickupLocation);
    }

    //  animateArrival
    //      animate the Unicorn's arrival to the user's pickup location
    function animateArrival(callback) {
        var dest = WildRydes.map.selectedPoint;
        var origin = {};

        if (dest.latitude > WildRydes.map.center.latitude) {
            origin.latitude = WildRydes.map.extent.minLat;
        } else {
            origin.latitude = WildRydes.map.extent.maxLat;
        }

        if (dest.longitude > WildRydes.map.center.longitude) {
            origin.longitude = WildRydes.map.extent.minLng;
        } else {
            origin.longitude = WildRydes.map.extent.maxLng;
        }

        WildRydes.map.animate(origin, dest, callback);
        if (_polyline) {
            map.removeLayer(_polyline);
            _polyline = null;
        }
        startPoint.marker?.remove();
        count = 0;
    }


}(jQuery));

//  these functions below here are my utility functions
//      to present messages to users
//      and to particularly add some 'sizzle' to the application

//  displayUpdate
//      nice utility method to show message to user
function displayUpdate(text, color='green') {
    $('#updates').prepend($(`<li style="background-color:${color}">${text}</li>`));
}


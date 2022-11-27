/*global WildRydes _config*/

var WildRydes = window.WildRydes || {};
WildRydes.map = WildRydes.map || {};

(function esriMapScopeWrapper($) {
    var wrMap = WildRydes.map;

    wrMap.animate = function animate(origin, dest, callback) {          //  TODO moved
        let tick = 0;
        let id = null;
        const unicorn = WildRydes.unicorn;

        let latlng = unicorn.getLatLng();
        let latInc = (dest.latitude - latlng.lat) / 100;
        let lngInc = (dest.longitude - latlng.lng) / 100;

        clearInterval(id);
        id = setInterval(frame, 5);
        function frame() {
            if (tick === 100) {
                clearInterval(id);
                callback();
            } else {
                tick++;
                latlng = {lat: latlng.lat +  latInc, lng: latlng.lng +  lngInc};
                unicorn.setLatLng(latlng);
            }
        }
    }

    wrMap.unsetLocation = function unsetLocation() {		//	TODO moved
        if (WildRydes.marker)
            WildRydes.marker.remove();
    };
}(jQuery));
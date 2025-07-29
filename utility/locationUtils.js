const axios = require("axios");
const geolib = require('geolib');

/**
 * Get the city name from latitude and longitude using Google Maps API.
 * @param {number} latitude - Latitude of the location.
 * @param {number} longitude - Longitude of the location.
 * @returns {Promise<string>} - The city name.
 */
const getCityFromCoordinates = async (latitude, longitude) => {
    const apiKey = process.env.GOOGLE_MAPS;
    const locationUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${apiKey}`;
    const locationResponse = await axios.get(locationUrl);
    const locationData = locationResponse.data;
    const city = locationData.results[0]?.address_components.find(component => component.types.includes("locality"))?.long_name;
    return city;
};

/**
 * Fetches travel distances and durations for a list of physiotherapists and sorts them by distance.
 * @param {Array} physios - List of physiotherapists with location coordinates.
 * @param {Number} latitude - User's latitude.
 * @param {Number} longitude - User's longitude.
 * @param {boolean} sorted - Whether to sort the physiotherapists by distance.
 * @returns {Array} - Sorted list of physiotherapists with travel distance and duration.
 */
const addTravelDistance = (physios, latitude, longitude, sorted = true, isObj = true) => {
    try {
        const updatedPhysios = physios.map(physio => {
            const physioCoords = {
                latitude: parseFloat(physio.latitude),
                longitude: parseFloat(physio.longitude)
            };

            const originCoords = { latitude, longitude };



            const distanceInMeters = geolib.getPreciseDistance(originCoords, physioCoords);
            const distanceInKm = ((distanceInMeters * 1.5) / 1000).toFixed(1);

            const updatedPhysio = isObj ? physio.toObject?.() || physio : { ...physio };


            if (updatedPhysio.subscription?.[0]) {
                updatedPhysio.subscription[0].patientCount = Math.floor(Math.random() * 9) + 1;
            }
            return {
                ...updatedPhysio,
                travelDistance: `${distanceInKm ?? "N/A"} km`,
                travelDuration: "N/A"
            };
        });

        if (sorted) {
            updatedPhysios.sort((a, b) => {
                const parseDistance = str => parseFloat(str.replace(/,/g, "").replace(" km", "")) || 0.0;
                return parseDistance(a.travelDistance) - parseDistance(b.travelDistance);
            });
        }

        return updatedPhysios;
    } catch (error) {
        console.error("Unexpected error:", error);
        throw new Error("Failed to process physiotherapists' distances.");
    }
};


module.exports = { getCityFromCoordinates, addTravelDistance };
let map;
let pins = [];
let cog = 0;
let sog = 0;
let boatMarker;
let boatPosition = null;
let isTracking = false;
let watchId = null;
let tempPosition = null;
let windOverlay = null;
let windEnabled = false;
let trailLine = null;
let positionHistory = [];
let lastPosition = null;
let lastTime = null;

const modal = document.getElementById('modal');
const pinNameInput = document.getElementById('pinName');
const cogEl = document.getElementById('cog');
const sogEl = document.getElementById('sog');
const windEl = document.getElementById('wind');
const windDirEl = document.getElementById('windDir');
const accuracyEl = document.getElementById('accuracy');
const satellitesEl = document.getElementById('satellites');
const cogStatusEl = document.getElementById('cogStatus');
const sogStatusEl = document.getElementById('sogStatus');
const gpsBtn = document.getElementById('gpsBtn');
const windBtn = document.getElementById('windBtn');
const cogInstrument = document.getElementById('cogInstrument');
const sogInstrument = document.getElementById('sogInstrument');

// Initialize map
map = L.map('map', {
    center: [45.0, 12.0],
    zoom: 13,
    zoomControl: true
});

// Add base layers
const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors',
    maxZoom: 19
});

const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Esri, DigitalGlobe, GeoEye, Earthstar Geographics',
    maxZoom: 19
});

osmLayer.addTo(map);

const baseMaps = {
    "Mappa": osmLayer,
    "Satellite": satelliteLayer
};
L.control.layers(baseMaps).addTo(map);

// Create boat marker
const boatIcon = L.divIcon({
    className: 'boat-marker',
    html: '<div class="boat-icon" id="boatIconDiv"><div class="boat-arrow"></div></div>',
    iconSize: [40, 40],
    iconAnchor: [20, 20]
});

// Handle map clicks
map.on('click', function(e) {
    tempPosition = e.latlng;
    modal.classList.remove('hidden');
    pinNameInput.value = '';
    pinNameInput.focus();
});

function calculateCOGandSOG(currentPos, currentTime) {
    if (!lastPosition || !lastTime) {
        lastPosition = currentPos;
        lastTime = currentTime;
        return;
    }

    const timeDiff = (currentTime - lastTime) / 1000;
    
    if (timeDiff < 2) return;

    const distance = lastPosition.distanceTo(currentPos);
    
    if (distance > 0.5 && timeDiff > 0) {
        sog = (distance / timeDiff) * 1.94384;
        sogStatusEl.textContent = 'CALC';
        sogInstrument.classList.add('highlight');
    }

    if (distance > 1) {
        const lat1 = lastPosition.lat * Math.PI / 180;
        const lat2 = currentPos.lat * Math.PI / 180;
        const dLon = (currentPos.lng - lastPosition.lng) * Math.PI / 180;
        
        const y = Math.sin(dLon) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
        let bearing = Math.atan2(y, x) * 180 / Math.PI;
        
        cog = (bearing + 360) % 360;
        cogStatusEl.textContent = 'CALC';
        cogInstrument.classList.add('highlight');
        
        const iconDiv = document.getElementById('boatIconDiv');
        if (iconDiv) {
            iconDiv.style.transform = `rotate(${cog}deg)`;
        }
    }

    lastPosition = currentPos;
    lastTime = currentTime;
}

function toggleGPS() {
    isTracking = !isTracking;
    
    if (isTracking) {
        gpsBtn.classList.add('active');
        gpsBtn.textContent = '📡 Attivo';
        positionHistory = [];
        lastPosition = null;
        lastTime = null;
        
        if ('geolocation' in navigator) {
            watchId = navigator.geolocation.watchPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lon = position.coords.longitude;
                    const timestamp = position.timestamp;
                    
                    boatPosition = L.latLng(lat, lon);
                    
                    if (position.coords.accuracy) {
                        accuracyEl.textContent = Math.round(position.coords.accuracy) + 'm';
                        satellitesEl.textContent = position.coords.accuracy < 10 ? 'Alta' : 'Media';
                    }
                    
                    if (position.coords.heading !== null && position.coords.heading !== undefined) {
                        cog = position.coords.heading;
                        cogStatusEl.textContent = 'GPS';
                        cogInstrument.classList.add('highlight');
                        
                        const iconDiv = document.getElementById('boatIconDiv');
                        if (iconDiv) {
                            iconDiv.style.transform = `rotate(${cog}deg)`;
                        }
                    }
                    
                    if (position.coords.speed !== null && position.coords.speed !== undefined && position.coords.speed > 0) {
                        sog = position.coords.speed * 1.94384;
                        sogStatusEl.textContent = 'GPS';
                        sogInstrument.classList.add('highlight');
                    }
                    
                    calculateCOGandSOG(boatPosition, timestamp);
                    
                    if (!boatMarker) {
                        boatMarker = L.marker(boatPosition, { icon: boatIcon }).addTo(map);
                        map.setView(boatPosition, 16);
                    } else {
                        boatMarker.setLatLng(boatPosition);
                    }
                    
                    positionHistory.push([lat, lon]);
                    if (positionHistory.length > 100) {
                        positionHistory.shift();
                    }
                    
                    if (trailLine) {
                        map.removeLayer(trailLine);
                    }
                    if (positionHistory.length > 1) {
                        trailLine = L.polyline(positionHistory, {
                            color: '#ef4444',
                            weight: 3,
                            opacity: 0.6
                        }).addTo(map);
                    }
                    
                    updateInstruments();
                },
                (error) => {
                    console.log('GPS error:', error);
                    alert('Errore GPS: ' + error.message + '\n\nAssicurati di aver dato i permessi di localizzazione.');
                    satellitesEl.textContent = 'ERR';
                },
                { 
                    enableHighAccuracy: true, 
                    maximumAge: 0,
                    timeout: 10000
                }
            );
        } else {
            alert('GPS non disponibile su questo dispositivo');
            isTracking = false;
            gpsBtn.classList.remove('active');
        }
    } else {
        gpsBtn.classList.remove('active');
        gpsBtn.textContent = '📡 GPS';
        cogInstrument.classList.remove('highlight');
        sogInstrument.classList.remove('highlight');
        if (watchId) {
            navigator.geolocation.clearWatch(watchId);
            watchId = null;
        }
    }
}

function toggleWind() {
    windEnabled = !windEnabled;
    
    if (windEnabled) {
        windBtn.classList.add('active');
        windBtn.textContent = '💨 On';
        
        if (!windOverlay) {
            windOverlay = L.tileLayer('https://tile.openweathermap.org/map/wind_new/{z}/{x}/{y}.png?appid=439d4b804bc8187953eb36d2a8c26a02', {
                attribution: 'Wind data © OpenWeatherMap',
                opacity: 0.5,
                maxZoom: 19
            });
        }
        windOverlay.addTo(map);
        
        if (boatPosition) {
            fetchWindData(boatPosition.lat, boatPosition.lng);
        }
    } else {
        windBtn.classList.remove('active');
        windBtn.textContent = '💨 Vento';
        if (windOverlay) {
            map.removeLayer(windOverlay);
        }
        windEl.textContent = '-- kn';
        windDirEl.textContent = '---°';
    }
}

function fetchWindData(lat, lon) {
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=439d4b804bc8187953eb36d2a8c26a02&units=metric`)
        .then(response => response.json())
        .then(data => {
            if (data.wind) {
                const windSpeed = (data.wind.speed * 1.94384).toFixed(1);
                const windDir = data.wind.deg || 0;
                windEl.textContent = windSpeed + ' kn';
                windDirEl.textContent = windDir + '°';
            }
        })
        .catch(error => {
            console.log('Wind data error:', error);
            windEl.textContent = 'N/D';
        });
}

function updateInstruments() {
    cogEl.textContent = Math.round(cog) + '°';
    sogEl.textContent = sog.toFixed(1) + ' kn';
    
    if (windEnabled && boatPosition) {
        fetchWindData(boatPosition.lat, boatPosition.lng);
    }
}

function closeModal() {
    modal.classList.add('hidden');
    tempPosition = null;
}

function addPin() {
    const name = pinNameInput.value.trim();
    if (!name || !tempPosition) return;
    
    const pin = {
        id: Date.now(),
        name: name,
        lat: tempPosition.lat,
        lng: tempPosition.lng,
        timestamp: new Date().toLocaleTimeString('it-IT')
    };
    
    pins.push(pin);
    renderPin(pin);
    closeModal();
}

pinNameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addPin();
    }
});

function renderPin(pin) {
    const pinIcon = L.divIcon({
        className: 'pin-marker',
        html: '<svg class="pin-icon" width="32" height="32" viewBox="0 0 24 24" fill="#eab308"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>',
        iconSize: [40, 40],
        iconAnchor: [20, 40]
    });
    
    const marker = L.marker([pin.lat, pin.lng], { icon: pinIcon }).addTo(map);
    pin.marker = marker;
    
    let popupContent = `
        <div class="pin-popup">
            <h3>${pin.name}</h3>
            <div class="pin-popup-details">
                <div id="bearing-${pin.id}">Rilevamento: --</div>
                <div id="distance-${pin.id}">Distanza: --</div>
                <div style="font-size: 0.75rem; color: #9ca3af; margin-top: 0.25rem;">${pin.timestamp}</div>
            </div>
            <button class="delete-btn" onclick="deletePin(${pin.id})">Elimina Pin</button>
        </div>
    `;
    
    marker.bindPopup(popupContent);
    
    marker.on('popupopen', () => {
        updatePinInfo(pin);
    });
}

function updatePinInfo(pin) {
    if (!boatPosition) return;
    
    const bearing = calculateBearing(boatPosition, L.latLng(pin.lat, pin.lng));
    const distance = (boatPosition.distanceTo(L.latLng(pin.lat, pin.lng)) / 1852).toFixed(2);
    
    const bearingEl = document.getElementById(`bearing-${pin.id}`);
    const distanceEl = document.getElementById(`distance-${pin.id}`);
    
    if (bearingEl) bearingEl.textContent = `Rilevamento: ${bearing}°`;
    if (distanceEl) distanceEl.textContent = `Distanza: ${distance} nm`;
}

function calculateBearing(from, to) {
    const lat1 = from.lat * Math.PI / 180;
    const lat2 = to.lat * Math.PI / 180;
    const dLon = (to.lng - from.lng) * Math.PI / 180;
    
    const y = Math.sin(dLon) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
    let bearing = Math.atan2(y, x) * 180 / Math.PI;
    
    bearing = (bearing + 360) % 360;
    return Math.round(bearing);
}

function deletePin(id) {
    const pin = pins.find(p => p.id === id);
    if (pin && pin.marker) {
        map.removeLayer(pin.marker);
    }
    pins = pins.filter(p => p.id !== id);
}

function clearAll() {
    if (confirm('Cancellare tutti i pin?')) {
        pins.forEach(pin => {
            if (pin.marker) {
                map.removeLayer(pin.marker);
            }
        });
        pins = [];
    }
}

// Try to get initial position
if ('geolocation' in navigator) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            map.setView([lat, lon], 15);
        },
        (error) => {
            console.log('Initial position error:', error);
        }
    );
}

updateInstruments();

require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 4000;
const allowedOrigins = new Set([
    'http://localhost:5175',
    'http://127.0.0.1:5175',
    ...(process.env.FRONTEND_URL || '').split(',').map(origin => origin.trim().replace(/\/$/, '')).filter(Boolean)
]);

// Cheia API vine dintr-un fisier .env, NICIODATA scrisa direct in cod.
// Daca lipseste, serverul porneste, dar orice cerere va esua clar,
// cu un mesaj explicativ, in loc sa dea o eroare criptica.
const API_KEY = process.env.OPENWEATHER_API_KEY;

app.use(express.static('public')); // pentru varianta simpla fara React, daca e nevoie

// Allow the deployed frontend (and local Vite dev server) to call this API.
app.use((req, res, next) => {
    const origin = req.get('Origin');
    res.vary('Origin');

    if (origin && allowedOrigins.has(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }

    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// GET /api/vremea/:oras
// Acesta e endpoint-ul propriu al serverului nostru. Frontend-ul (React sau
// vanilla) cheama DOAR acest endpoint - nu stie si nu are nevoie sa stie ca,
// in spate, exista OpenWeatherMap sau vreo cheie API.
app.get('/api/vremea/:oras', async (req, res) => {
    const { oras } = req.params;

    // OpenWeather indexes this Romanian city with diacritics. Accept common
    // ASCII spellings typed into the search box as well.
    const orasNormalizat = oras.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ro').trim();
    const numeCautare = orasNormalizat === 'targu mures' ? 'Târgu Mureș,RO' : oras;

    if (!API_KEY) {
    
        return res.status(500).json({
        
            error: 'The API server is missing its OPENWEATHER_API_KEY configuration.'
        });
    }

    try {
    
        // Cererea catre API-ul extern se face DE AICI, de pe server -
        // cheia API nu ajunge niciodata in browser-ul utilizatorului.
        const orasUrl = encodeURIComponent(numeCautare);
        const [raspunsExtern, raspunsPrognoza] = await Promise.all([
            fetch(`https://api.openweathermap.org/data/2.5/weather?q=${orasUrl}&appid=${API_KEY}&units=metric&lang=ro`, { signal: AbortSignal.timeout(10000) }),
            fetch(`https://api.openweathermap.org/data/2.5/forecast?q=${orasUrl}&appid=${API_KEY}&units=metric&lang=ro`, { signal: AbortSignal.timeout(10000) })
        ]);

        if (raspunsExtern.status === 404) {
            return res.status(404).json({ error: `City "${oras}" was not found.` });
        }

        const raspunsEsuat = !raspunsExtern.ok ? raspunsExtern : raspunsPrognoza;
        if (!raspunsEsuat.ok) {
            return res.status(raspunsEsuat.status).json({
            error: 'Could not retrieve weather from the weather service.'
            });
        }

        const [dateCompleteExterne, datePrognoza] = await Promise.all([
            raspunsExtern.json(),
            raspunsPrognoza.json()
        ]);

        const decalajFusOrar = datePrognoza.city.timezone;
        const dataLocala = timestamp => new Date((timestamp + decalajFusOrar) * 1000).toISOString().slice(0, 10);
        const maine = new Date(Date.now() + (decalajFusOrar + 86400) * 1000).toISOString().slice(0, 10);
        const prognozaDeMaine = datePrognoza.list.filter(interval => dataLocala(interval.dt) === maine);

        if (prognozaDeMaine.length === 0) {
            return res.status(502).json({ error: 'The weather service did not return a forecast for tomorrow.' });
        }

        const intervalReprezentativ = prognozaDeMaine.reduce((celMaiApropiat, interval) => {
            const oraLocala = new Date((interval.dt + decalajFusOrar) * 1000).getUTCHours();
            const oraPrecedenta = new Date((celMaiApropiat.dt + decalajFusOrar) * 1000).getUTCHours();
            return Math.abs(oraLocala - 12) < Math.abs(oraPrecedenta - 12) ? interval : celMaiApropiat;
        });

        // Simplificam raspunsul - trimitem catre frontend DOAR ce are nevoie,
        // nu tot raspunsul original (care are zeci de campuri nefolosite)
        const raspunsSimplificat = {
            oras: dateCompleteExterne.name,
            temperatura: Math.round(dateCompleteExterne.main.temp),
            senzatieTermica: Math.round(dateCompleteExterne.main.feels_like),
            descriere: dateCompleteExterne.weather[0].description,
            iconaCod: dateCompleteExterne.weather[0].icon,
            umiditate: dateCompleteExterne.main.humidity,
            vantKmH: Math.round(dateCompleteExterne.wind.speed * 3.6), // m/s -> km/h
            maine: {
                minima: Math.round(Math.min(...prognozaDeMaine.map(interval => interval.main.temp_min))),
                maxima: Math.round(Math.max(...prognozaDeMaine.map(interval => interval.main.temp_max))),
                descriere: intervalReprezentativ.weather[0].description,
                iconaCod: intervalReprezentativ.weather[0].icon
            }
        };

        res.json(raspunsSimplificat);
        
    } catch (err) {
        console.error(err);
        if (err.name === 'TimeoutError' || err.name === 'AbortError') {
            return res.status(504).json({ error: 'The weather service took too long to respond. Please try again.' });
        }
        res.status(500).json({ error: 'Unexpected server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Weather API (proxy) rulează pe http://localhost:${PORT}`);
    if (!API_KEY) {
        console.warn('ATENȚIE: OPENWEATHER_API_KEY nu este setată în .env — cererile vor eșua.');
    }
});

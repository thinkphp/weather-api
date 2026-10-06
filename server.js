require('dotenv').config();
const express = require('express');

const app = express();
const PORT = process.env.PORT || 4000;

// Cheia API vine dintr-un fisier .env, NICIODATA scrisa direct in cod.
// Daca lipseste, serverul porneste, dar orice cerere va esua clar,
// cu un mesaj explicativ, in loc sa dea o eroare criptica.
const API_KEY = process.env.OPENWEATHER_API_KEY;

app.use(express.static('public')); // pentru varianta simpla fara React, daca e nevoie

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
        
            error: 'Serverul nu are configurata cheia API (OPENWEATHER_API_KEY lipseste din .env).'
        });
    }

    try {
    
        // Cererea catre API-ul extern se face DE AICI, de pe server -
        // cheia API nu ajunge niciodata in browser-ul utilizatorului.
        const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(numeCautare)}&appid=${API_KEY}&units=metric&lang=en`;

        const raspunsExtern = await fetch(url);

        if (raspunsExtern.status === 404) {
            return res.status(404).json({ error: `City "${oras}" was not found.` });
        }

        if (!raspunsExtern.ok) {
            return res.status(raspunsExtern.status).json({
            error: 'Could not retrieve weather from the weather service.'
            });
        }

        const dateCompleteExterne = await raspunsExtern.json();

        // Simplificam raspunsul - trimitem catre frontend DOAR ce are nevoie,
        // nu tot raspunsul original (care are zeci de campuri nefolosite)
        const raspunsSimplificat = {
            oras: dateCompleteExterne.name,
            temperatura: Math.round(dateCompleteExterne.main.temp),
            senzatieTermica: Math.round(dateCompleteExterne.main.feels_like),
            descriere: dateCompleteExterne.weather[0].description,
            iconaCod: dateCompleteExterne.weather[0].icon,
            umiditate: dateCompleteExterne.main.humidity,
            vantKmH: Math.round(dateCompleteExterne.wind.speed * 3.6) // m/s -> km/h
        };

        res.json(raspunsSimplificat);
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Unexpected server error.' });
    }
});

app.listen(PORT, () => {
    console.log(`Weather API (proxy) rulează pe http://localhost:${PORT}`);
    if (!API_KEY) {
        console.warn('ATENȚIE: OPENWEATHER_API_KEY nu este setată în .env — cererile vor eșua.');
    }
});

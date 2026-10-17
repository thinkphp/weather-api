# Weather API (proxy)

A Node.js/Express server that acts as a proxy between the frontend and [OpenWeatherMap](https://openweathermap.org/api). The frontend only calls this server's endpoint, and the API key stays on the server and never reaches the user's browser.

## Features

- Current weather for a city (temperature, feels-like, description, humidity, wind)
- Tomorrow's forecast (min, max, plus description and icon for the interval closest to 12:00 local time)
- Simplified response containing only the fields the frontend needs
- API key read from `.env`, never hardcoded
- Configurable CORS for the deployed frontend and the local dev server
- 10-second timeout on requests to the external service
- Tolerant lookup for "Târgu Mureș" (also accepts "Targu Mures")
- Optionally serves static files from the `public/` folder (for a non-React setup)

## Requirements

- [Node.js](https://nodejs.org/) 18 or newer (uses native `fetch` and `AbortSignal.timeout`)
- A free OpenWeatherMap account and an API key

## Installation

```bash
npm install express dotenv
```

If the project already has a `package.json`, just run `npm install`.

## Configuration

Create a `.env` file in the server root:

```env
OPENWEATHER_API_KEY=your_openweathermap_key
PORT=4000
FRONTEND_URL=https://your-frontend.example.com
```

| Variable | Required | Description |
|---|---|---|
| `OPENWEATHER_API_KEY` | Yes | OpenWeatherMap API key. If missing, the server still starts, but every request returns a 500 error with an explanatory message. |
| `PORT` | No | Server port. Default: `4000`. |
| `FRONTEND_URL` | No | One or more allowed CORS origins, comma-separated (e.g. `https://a.com,https://b.com`). A trailing slash is ignored. |

Origins allowed by default for local development: `http://localhost:5175` and `http://127.0.0.1:5175` (the Vite port).

> **Important:** add `.env` to `.gitignore` so your API key doesn't end up in the repository.

## Running

```bash
node server.js
```

If your main file has a different name, replace `server.js`. The server runs at `http://localhost:4000` (or on the port set in `PORT`).

## Endpoints

### `GET /api/vremea/:oras`

Returns the current weather and tomorrow's forecast.

**Example:**

```bash
curl http://localhost:4000/api/vremea/Bucuresti
```

**Response (200):**

```json
{
  "oras": "Bucharest",
  "temperatura": 18,
  "senzatieTermica": 17,
  "descriere": "cer senin",
  "iconaCod": "01d",
  "umiditate": 55,
  "vantKmH": 12,
  "maine": {
    "minima": 9,
    "maxima": 21,
    "descriere": "câteva nori",
    "iconaCod": "02d"
  }
}
```

| Field | Description |
|---|---|
| `oras` | City name as returned by OpenWeatherMap |
| `temperatura` | Current temperature in °C (rounded) |
| `senzatieTermica` | Feels-like temperature in °C (rounded) |
| `descriere` | Weather description, in Romanian |
| `iconaCod` | OpenWeatherMap icon code |
| `umiditate` | Humidity, in % |
| `vantKmH` | Wind speed in km/h (converted from m/s) |
| `maine.minima` / `maine.maxima` | Tomorrow's min and max temperature in °C |
| `maine.descriere` / `maine.iconaCod` | Description and icon for the interval closest to 12:00 local time |

The icon can be displayed with: `https://openweathermap.org/img/wn/{iconaCod}@2x.png`

### Errors

| Code | Situation |
|---|---|
| `404` | City not found |
| `500` | `OPENWEATHER_API_KEY` is missing, or an unexpected error occurred |
| `502` | The weather service did not return a forecast for tomorrow |
| `504` | The weather service did not respond within 10 seconds |
| other | The status code returned by OpenWeatherMap when the external request fails |

All errors use this format:

```json
{ "error": "Descriptive message" }
```

## How it works

1. The frontend calls `GET /api/vremea/:oras` on this server.
2. The server calls OpenWeatherMap's `weather` (current conditions) and `forecast` (3-hour forecast) endpoints in parallel, using `units=metric` and `lang=ro`.
3. Tomorrow's intervals are selected from the forecast, computed in the city's own timezone.
4. The response is simplified and sent to the frontend.

## Project structure

```
.
├── server.js       # Express server
├── public/         # static files (optional)
├── .env            # local configuration (not committed)
└── package.json
```

## Security

- The API key is read exclusively from environment variables.
- Only origins on the allowlist receive CORS headers.
- Only `GET` and `OPTIONS` methods are allowed.

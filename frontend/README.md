# OceanEmbed - Frontend

Interactive web frontend for **OceanEmbed**, an oceanographic data visualization, analysis, and embedding platform.

## Features

- **Interactive 3D Visualizer**: Real-time 3D ocean data rendering and volume slicing using Plotly and ECharts-GL.
- **2D & Depth Profile Views**: High-resolution heatmap slices, bathymetric overlays, and vertical depth transect profiles.
- **Dataset Exploration**: Search, filter, and inspect ocean variables (temperature, salinity, currents, elevation) across coordinate space and time.
- **Modern Responsive UI**: Built with React 19, Vite, Lucide icons, and custom styling tailored for high-performance scientific visualization.

## Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vite.dev/)
- **Routing**: [React Router](https://reactrouter.com/)
- **Visualizations**: [Plotly.js](https://plotly.com/javascript/) / [react-plotly.js](https://github.com/plotly/react-plotly.js), [ECharts](https://echarts.apache.org/) / [echarts-gl](https://github.com/ecomfe/echarts-gl)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Linter**: [Oxlint](https://oxc.rs/)

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

```bash
cd frontend
npm install
```

### Development Server

Run the development server locally:

```bash
npm run dev
```

The app will typically be available at `http://localhost:5173`.

### Production Build

Create an optimized production bundle:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
frontend/
├── public/              # Static assets
├── src/
│   ├── api/             # API clients and endpoints
│   ├── assets/          # Images and media
│   ├── components/      # Reusable UI & 2D/3D visualization components
│   ├── layouts/         # Layout wrappers and navigation
│   ├── pages/           # Application views (Landing, Input, Explore, Results)
│   ├── App.jsx          # Top-level routing and state
│   ├── main.jsx         # Application entry point
│   └── index.css        # Global design tokens and styles
├── vercel.json          # Deployment configuration
├── vite.config.js       # Vite build configuration
└── package.json         # Dependencies and scripts
```

## Deployment

Configured for deployment on Vercel with single-page application (SPA) rewrite rules.

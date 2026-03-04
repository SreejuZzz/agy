# Sreejith M S - Personal Portfolio

A sleek, modern, and highly interactive personal portfolio showcasing creative development and design. The defining feature of this project is a custom-built, highly optimized 3D particle ring animation running entirely on a CSS Houdini Paint Worklet.

## Features

### 🌟 CSS Houdini Particle Ring (`particle-worklet.js`)
The background of the hero section features a stunning, mathematically organized 3D particle ring.
- **Multi-Wave Colors:** Distinct waves of Vibrant Navy, Vibrant Orange, and Vibrant Red wash over the ring dynamically. The colors snap strictly to the dominant wave at the particle's location to prevent muddy blending.
- **3D Perspective & Motion:** The ring gently breathes (expands/contracts), tilts on a 3D axis, and orbits slowly, providing a premium, serene feel.
- **Elastic Interactions:** Particles stretch and snap towards the user's mouse cursor with a highly tuned, elastic rubber-banding physics simulation.
- **Optimized for Performance:** The worklet runs off the main thread. Trigonometry functions are cached, redundant math is condensed, and dead code is fully stripped. Main-thread CSS variable DOM writes are heavily throttled to only happen when the mouse or ring actively moves, achieving a pristine 60FPS.

### 🎨 Modern UI & Architecture
- **Glassmorphism:** Elegant, blurred translucent backgrounds for cards and navigation elements.
- **Scroll-Driven Animations:** Elements elegantly fade and slide into view as you scroll down the page, utilizing CSS animation timelines.
- **CSS Variables First:** A strict token system (`tokens.css`) controls spacing, typography (Inter & Outfit), sizing, and transitions, making it trivial to update the site's look and feel.
- **Dark/Light Mode:** Includes an integrated theme toggle.

## Tech Stack
- **Vanilla JavaScript (ES6+)**
- **CSS3 / CSS Houdini Paint API**
- **Vite** (for fast local development and optimized production bundling)
- **HTML5**

## Getting Started

### Prerequisites
You need [Node.js](https://nodejs.org/) installed on your machine.

### Installation

1. Clone the repository or download the files.
2. Install the dependencies:
   ```bash
   npm install
   ```

### Running the Development Server

To start the Vite development server with hot-module replacement (HMR), run:

```bash
npm run dev
```

Open your browser and navigate to the URL provided in the terminal (usually `http://localhost:5173/`).

### Building for Production

To create an optimized production build, run:

```bash
npm run build
```

This will generate a `dist` folder containing the minified and compressed assets, ready to be deployed to any static hosting provider.

## Roadmap & Customization
- **Particle Ring Locked:** The CSS Houdini particle ring mechanics, physics, layout, and colors are currently designated as 'locked' and should not be modified to preserve the carefully tuned interaction and aesthetics.
- **Content Expansion:** Further updates will focus on revamping the individual content sections (About, Work, Contact) and typography.

---
Designed and developed by Sreejith M S.
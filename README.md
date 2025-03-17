# FSE Lead Collection System

A Progressive Web Application (PWA) that allows Field Sales Executives (FSEs) to collect lead data efficiently with offline support.

## Features

- **Multi-step Forms**: Step-by-step form design with consistent FSE identification first step
- **Rich Input Types**: Text, toggle, radio, checkbox, select, image capture, media upload, address, and geolocation
- **Offline Support**: Full functionality without internet connection
- **Data Persistence**: Zero data loss during connectivity issues or app crashes
- **Draft Saving**: Save incomplete forms as drafts and resume later
- **Optimized for Mobile**: Lightweight and designed for low-end devices

## Technologies Used

- **Frontend**: Vite + Preact v10, Tailwind CSS
- **Data Storage**: IndexedDB for offline storage
- **Offline Capabilities**: Service Workers and Background Sync
- **Deployment**: AWS EC2, Route53 (future)

## Project Structure

```
fse-lead-collection/
├── public/                # Static assets
│   ├── manifest.json      # PWA manifest
│   ├── service-worker.js  # Service worker for offline capabilities
│   └── icons/             # PWA icons
├── src/
│   ├── api/               # API client functions
│   ├── components/        # Reusable UI components
│   │   ├── form/          # Form-specific components
│   │   │   ├── inputs/    # Form input components
│   │   │   └── stepper/   # Multi-step form navigation
│   │   └── ui/            # Generic UI components
│   ├── hooks/             # Custom React hooks
│   ├── context/           # Context providers
│   ├── db/                # IndexedDB setup and operations
│   ├── models/            # Type definitions
│   ├── pages/             # Page components
│   ├── utils/             # Helper functions
│   ├── App.jsx            # Main application component
│   ├── index.jsx          # Entry point
│   └── styles/            # CSS stylesheets
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── package.json           # Dependencies
```

## Setup Instructions

### Prerequisites

- Node.js (v16+)
- npm (v8+) or yarn

### Installation

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd fse-lead-collection
   ```

2. Install dependencies:

   ```bash
   npm install
   # or
   yarn
   ```

3. Start the development server:

   ```bash
   npm run dev
   # or
   yarn dev
   ```

4. Open your browser and navigate to: `http://localhost:5173`

### Building for Production

```bash
npm run build
# or
yarn build
```

The build artifacts will be stored in the `dist/` directory.

## Deployment

The application is designed to be deployed to AWS EC2. Follow these steps:

1. Build the application for production
2. Transfer the `dist/` directory to your EC2 instance
3. Serve the static files using Nginx or other web server
4. Configure HTTPS and domain settings in Route53

## Development Roadmap

### Phase 1 (Current)

- Preact PWA foundation with offline capabilities
- Form rendering engine
- Input component library
- IndexedDB implementation
- Basic API endpoints

### Phase 2 (Upcoming)

- Sync mechanism for offline data
- Media uploads to S3
- Background sync enhancement

### Phase 3 (Future)

- Form builder in Next.js admin dashboard

### Phase 4 (Future)

- QC dashboard implementation

## Best Practices

- Use IndexedDB for all data storage to ensure offline functionality
- Keep bundle size small for optimal performance on low-end devices
- Implement proper error handling and validation
- Provide clear visual feedback for all user actions
- Test extensively on various mobile devices and network conditions

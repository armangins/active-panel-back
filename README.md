# Active Panel Backend

A secure Node.js backend for interfacing with the WooCommerce API.

## Features

-   **Secure**: Implements Helmet, CORS, and Rate Limiting.
-   **Modular**: Organized structure with Controllers, Services, and Routes.
-   **WooCommerce Ready**: Pre-configured wrapper for the WooCommerce REST API.

## Getting Started

### Prerequisites

-   Node.js (v14+ recommended)
-   A WooCommerce store with API keys (Consumer Key & Secret)

### Installation

1.  Clone the repository (if applicable) or download the source.
2.  Install dependencies:
    ```bash
    npm install
    ```

### Configuration

1.  Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
2.  Edit `.env` and add an encryption key:
    ```env
    PORT=3000
    ENCRYPTION_KEY=your_32_byte_secret_key_here_!!!!
    ```
3.  Start the server.
4.  Use the `/api/settings` endpoint to configure your WooCommerce credentials.

## API Endpoints

-   `GET /health`: Server health check.
-   `POST /api/settings`: Save WooCommerce credentials (encrypted).
-   `GET /api/settings`: Check if settings are configured.
-   `GET /api/products`: Fetch products from WooCommerce.
-   `GET /api/products/:id`: Fetch a single product.

## Project Structure

-   `src/config`: Configuration files (Database, Encryption).
-   `src/controllers`: Request handlers.
-   `src/models`: Database models (Sequelize).
-   `src/middleware`: Express middleware.
-   `src/routes`: API route definitions.
-   `src/services`: Business logic and API wrappers.

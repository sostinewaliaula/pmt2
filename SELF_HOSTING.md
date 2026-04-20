# Caava Group Project Management - Self-Hosting Guide

This guide provides step-by-step instructions on how to deploy and manage your personalized instance of Caava Group Project Management on your own Ubuntu server using Docker.

## Prerequisites

- **Ubuntu Server**: Minimum 4GB RAM recommended (t3.medium or higher).
- **Docker & Docker Compose**: Installed and running.
- **Git**: Installed to clone your personalized repository.

### Quick Docker Install (if needed)
```bash
curl -fsSL https://get.docker.com | sh -
```

---

## Installation & Setup

1. **Clone your repository**:
   ```bash
   git clone https://github.com/sostinewaliaula/pmt.git caava-project
   cd caava-project
   ```

2. **Make the setup script executable**:
   ```bash
   chmod +x setup.sh
   ```

3. **Run the setup script**:
   ```bash
   ./setup.sh
   ```

4. **Select Option 1 (Install / Setup Env)**:
   This will create your `.env` files. 

5. **Configure your Environment**:
   Open the root `.env` file and set your `WEB_URL`:
   ```bash
   # Example: http://192.168.1.10 or http://caava.yourcompany.com
   WEB_URL=http://your-server-ip
   CORS_ALLOWED_ORIGINS=http://your-server-ip
   ```

6. **Select Option 2 (Build Caava Group Images)**:
   This will build your personalized version from the source code. **This is crucial to see your Caava branding.**

7. **Select Option 3 (Start Services)**:
   This will launch the application in the background.

---

## Managing your Instance

Use the `./setup.sh` script to manage your server at any time:

- **Stop**: Option 4 (docker-compose down)
- **Restart**: Option 5 (docker-compose restart)
- **View Logs**: Option 6 (docker-compose logs -f)
- **Update/Rebuild**: If you make code changes, run **Option 2** again to rebuild the images.

---

## Troubleshooting

- **Port Conflicts**: If port 80 is used, change `LISTEN_HTTP_PORT` in your `.env` file and run **Option 5**.
- **Database Migrations**: Migrations run automatically on start. If you see errors, check the logs (Option 6).

> [!TIP]
> Always stop the services (Option 4) before making major changes to your `.env` configuration.

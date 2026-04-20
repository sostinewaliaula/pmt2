#!/bin/bash

# Caava Group Project Management - Self-Hosting Setup Script
# Based on Plane Community Edition

# Set colors for output messages
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BOLD='\033[1m'
NC='\033[0m' # No Color

REPO_RAW_URL="https://raw.githubusercontent.com/sostinewaliaula/pmt/main/deploy"

# Print header
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}${BLUE}              Caava Group - Project Management Tool                   ${NC}"
echo -e "${BOLD}${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${BOLD}Self-Hosting Management Script${NC}\n"

# Check if docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed. Please install Docker first.${NC}"
    exit 1
fi

show_menu() {
    echo -e "${BOLD}Select an action you want to perform:${NC}"
    echo -e "   1) ${GREEN}Install / Setup Env${NC} (Copy .env files & generate keys)"
    echo -e "   2) ${BLUE}Download Latest Release${NC} (Pull images from GitHub)"
    echo -e "   3) ${BLUE}Start Services${NC} (docker-compose up)"
    echo -e "   4) ${YELLOW}Stop Services${NC} (docker-compose down)"
    echo -e "   5) ${BLUE}Restart Services${NC}"
    echo -e "   6) ${BLUE}View Logs${NC}"
    echo -e "   7) ${RED}Restore Data${NC} (Full or DB Only)"
    echo -e "   8) ${RED}Wipe Instance Data${NC} (Reset all volumes)"
    echo -e "   9) ${YELLOW}Run Database Migrations${NC} (Fix schema errors)"
    echo -e "   10) ${RED}Force Fix Enterprise Schema${NC} (Surgical fix for project_id)"
    echo -e "   11) ${BLUE}Clean Ghost Projects${NC} (Remove stuck Test projects)"
    echo -e "   12) Exit"
    echo -ne "\nAction [3]: "
}

fix_schema() {
    echo -e "${YELLOW}Applying Surgical Compatibility Fix for Enterprise-to-Community migration...${NC}"
    DB_USER=$(grep "^POSTGRES_USER=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    DB_NAME=$(grep "^POSTGRES_DB=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    DB_USER=${DB_USER:-caava_admin}
    DB_NAME=${DB_NAME:-caava_db}

    # 1. Inject missing 'project_id' into 'workspace_user_links'
    # Comparison shows this is the single most critical mismatch causing 500 errors.
    TABLE_NAME=$(docker compose exec -T plane-db psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT tablename FROM pg_tables WHERE tablename LIKE '%workspace_user_link%' LIMIT 1;" | tr -d '[:space:]')
    
    if [ -n "$TABLE_NAME" ]; then
        echo -e "${BLUE}i${NC} Verifying table: $TABLE_NAME"
        docker compose exec -T plane-db psql -U ${DB_USER} -d ${DB_NAME} -c "ALTER TABLE ${TABLE_NAME} ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES projects(id) ON DELETE CASCADE;"
        echo -e "${GREEN}✓${NC} Column 'project_id' verified/injected."
    else
        echo -e "${RED}x${NC} Error: Could find workspace_user_link table."
    fi

    # 2. Relax Enterprise-only NOT NULL constraints
    # These columns block Community software from saving data because it doesn't know values for them.
    echo -e "\n${YELLOW}Relaxing Enterprise-only mandatory constraints...${NC}"
    REL_COLS=(
        "project_members:source"
        "workspace_user_properties:last_used_filter"
        "workspace_user_properties:pql_filters"
        "project_user_properties:last_used_filter"
        "project_user_properties:pql_filters"
        "module_user_properties:last_used_filter"
        "module_user_properties:pql_filters"
        "issue_views:pql_filters"
    )

    for entry in "${REL_COLS[@]}"; do
        T="${entry%%:*}"
        C="${entry##*:}"
        # Check if table and column exist before altering
        EXISTS=$(docker compose exec -T plane-db psql -U ${DB_USER} -d ${DB_NAME} -t -c "SELECT 1 FROM information_schema.columns WHERE table_name='$T' AND column_name='$C';" | tr -d '[:space:]')
        if [ "$EXISTS" == "1" ]; then
            docker compose exec -T plane-db psql -U ${DB_USER} -d ${DB_NAME} -c "ALTER TABLE $T ALTER COLUMN $C DROP NOT NULL;" > /dev/null 2>&1
            echo -e "${BLUE}i${NC} Relaxed: $T.$C"
        fi
    done

    echo -e "\n${GREEN}✓ Deep compatibility health check complete.${NC}"
}

clean_ghosts() {
    echo -e "${YELLOW}Cleaning up stuck project names...${NC}"
    DB_USER=$(grep "^POSTGRES_USER=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    DB_NAME=$(grep "^POSTGRES_DB=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    DB_USER=${DB_USER:-caava_admin}
    DB_NAME=${DB_NAME:-caava_db}

    echo -ne "Enter the name of the project to remove: "
    read project_name
    docker compose exec -T plane-db psql -U ${DB_USER} -d ${DB_NAME} -c "DELETE FROM projects WHERE name = '$project_name';"
    echo -e "${GREEN}✓ Project '$project_name' removed.${NC}"
}

run_migrations() {
    echo -e "${YELLOW}Running official Database Migrator...${NC}"
    docker compose run --rm migrator
    echo -e "${GREEN}✓ Done. Database schema is now up to date.${NC}"
}

wipe_data() {
    echo -e "${RED}${BOLD}🚨 WARNING: This will permanently delete your database and all uploaded files!${NC}"
    echo -ne "Are you sure you want to completely reset this instance? (y/N): "
    read confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}Wiping all instance data...${NC}"
        docker compose down -v
        echo -e "${GREEN}✓ Done. Instance has been reset to a clean state.${NC}"
    else
        echo -e "${BLUE}Wipe cancelled.${NC}"
    fi
}

restore_data() {
    echo -e "${RED}${BOLD}WARNING: This will overwrite your current data!${NC}"
    echo -ne "Enter the path to your backup .tar.gz file: "
    read backup_file

    if [ ! -f "$backup_file" ]; then
        echo -e "${RED}Error: Backup file not found.${NC}"
        return
    fi

    echo -e "\n${BOLD}Select Restoration Type:${NC}"
    echo -e "   1) ${BLUE}Database Only${NC} (Cleanest - No old logos/attachments)"
    echo -e "   2) ${GREEN}Full Restore${NC} (Includes all uploads/images)"
    echo -ne "\nChoice [1]: "
    read restore_choice

    echo -e "${YELLOW}Preparing restoration...${NC}"
    mkdir -p ./restore_tmp
    tar -xzf "$backup_file" -C ./restore_tmp

    if [[ "$restore_choice" == "2" ]]; then
        # Restore Uploads
        echo -e "${BLUE}Restoring Uploads...${NC}"
        # We find the volume name dynamically
        UPLOAD_VOL=$(docker volume ls -q | grep uploads | head -n 1)
        docker run --rm -v ./restore_tmp:/backup -v "$UPLOAD_VOL":/export alpine sh -c "rm -rf /export/* && tar xzf /backup/uploads.tar.gz -C /export"
    else
        # Wipe Uploads (Clean Start)
        echo -e "${BLUE}Wiping existing storage for a clean start...${NC}"
        UPLOAD_VOL=$(docker volume ls -q | grep uploads | head -n 1)
        docker run --rm -v "$UPLOAD_VOL":/export alpine sh -c "rm -rf /export/*"
    fi

    # Restore Database
    echo -e "${BLUE}Restoring Database...${NC}"
    # Read DB details precisely from .env (Start of line only)
    DB_USER=$(grep "^POSTGRES_USER=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    DB_NAME=$(grep "^POSTGRES_DB=" .env | cut -d'=' -f2 | tr -d '"' | tr -d "'" | tr -d '\r')
    DB_USER=${DB_USER:-caava_admin}
    DB_NAME=${DB_NAME:-caava_db}

    # Use the detected user to connect to the 'template1' system database
    echo -e "${YELLOW}Forcefully resetting database '${DB_NAME}'...${NC}"
    # 1. Kill all active connections to the database so we can drop it
    docker compose exec -T plane-db psql -U ${DB_USER} -d template1 -c "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${DB_NAME}' AND pid <> pg_backend_pid();" > /dev/null 2>&1
    
    # 2. Drop and Recreate in separate transactions
    docker compose exec -T plane-db psql -U ${DB_USER} -d template1 -c "DROP DATABASE IF EXISTS ${DB_NAME};"
    docker compose exec -T plane-db psql -U ${DB_USER} -d template1 -c "CREATE DATABASE ${DB_NAME};"
    
    # 3. Perform the import
    echo -e "${BLUE}Importing data from backup...${NC}"
    docker compose exec -T plane-db psql -U ${DB_USER} -d ${DB_NAME} < ./restore_tmp/database.sql

    rm -rf ./restore_tmp
    echo -e "${GREEN}✓ Restoration completed successfully!${NC}"
}

setup_env() {
    echo -e "\n${YELLOW}Setting up orchestration and environment files...${NC}"

    # 1. Download docker-compose.yml if missing
    if [ ! -f "docker-compose.yml" ]; then
        echo -e "${BLUE}Downloading docker-compose.yml from GitHub...${NC}"
        curl -fsSL -o docker-compose.yml "${REPO_RAW_URL}/docker-compose.yml"
    fi
    
    # 2. Setup .env
    if [ ! -f ".env" ]; then
        echo -e "${BLUE}Downloading .env.example from GitHub...${NC}"
        curl -fsSL -o .env.example "${REPO_RAW_URL}/caava.env.example"
        cp .env.example .env
        echo -e "${GREEN}✓${NC} Created .env from remote example"
        
        # Generate Security Keys and Backend Glue
        echo -e "${YELLOW}Generating Security Keys and Backend Glue...${NC}"
        SECRET_KEY=$(tr -dc 'a-z0-9' < /dev/urandom | head -c50)
        LIVE_SECRET=$(tr -dc 'a-z0-9' < /dev/urandom | head -c50)
        echo -e "\n# Security Keys" >> .env
        echo -e "SECRET_KEY=\"$SECRET_KEY\"" >> .env
        echo -e "LIVE_SERVER_SECRET_KEY=\"$LIVE_SECRET\"" >> .env
        echo -e "\n# Backend Connection URLs" >> .env
        echo -e "REDIS_URL=redis://plane-redis:6379/0" >> .env
        echo -e "DATABASE_URL=postgresql://\${POSTGRES_USER}:\${POSTGRES_PASSWORD}@plane-db:5432/\${POSTGRES_DB}" >> .env
    else
        echo -e "${BLUE}i${NC} .env already exists, skipping download."
    fi
}

pull_images() {
    echo -e "\n${YELLOW}Downloading your latest Caava Group release...${NC}"
    docker compose pull
    echo -e "${GREEN}✓ Done. Pull complete.${NC}"
}

start_services() {
    echo -e "\n${GREEN}Starting Caava Group services...${NC}"
    docker compose up -d
    echo -e "\n${GREEN}Services started! Access your instance via WEB_URL configured in your .env${NC}"
}

stop_services() {
    echo -e "\n${YELLOW}Stopping Caava Group services...${NC}"
    docker compose down
}

restart_services() {
    echo -e "\n${BLUE}Restarting Caava Group services...${NC}"
    docker compose restart
}

view_logs() {
    docker compose logs -f
}

while true; do
    show_menu
    read choice
    
    # Default to 3 (Start) if input is empty
    if [ -z "$choice" ]; then
        choice=3
    fi

    case $choice in
        1) setup_env ;;
        2) pull_images ;;
        3) start_services ;;
        4) stop_services ;;
        5) restart_services ;;
        6) view_logs ;;
        7) restore_data ;;
        8) wipe_data ;;
        9) run_migrations ;;
        10) fix_schema ;;
        11) clean_ghosts ;;
        12) exit 0 ;;
        *) echo -e "${RED}Invalid option, please try again.${NC}" ;;
    esac
    echo -e "\n"
done

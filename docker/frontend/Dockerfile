FROM node:20-alpine

# Set working directory
WORKDIR /app

# Copy package files first to leverage Docker layer caching
COPY ./frontend/package*.json ./

# Install dependencies
RUN npm install

# The source code will be mounted as a volume in docker-compose.yml for hot-reloading,
# but we can optionally copy it here for a more robust base image.
COPY ./frontend .

# Expose Vite's default port
EXPOSE 5173

# Run the Vite dev server
CMD ["npm", "run", "dev"]

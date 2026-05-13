FROM node:22-alpine

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Expose Vite development port
EXPOSE 5173

# Run development server
# Note: --host is required for the server to be accessible outside the container
HEALTHCHECK --interval=30s --timeout=10s --retries=3 CMD node -e "fetch('http://127.0.0.1:5173').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["npm", "run", "dev", "--", "--host"]

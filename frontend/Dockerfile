FROM node:18-alpine

WORKDIR /app

# Copy dependency files
COPY package.json package-lock.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Expose Vite development port
EXPOSE 5173

# Run development server
# Note: --host is required for the server to be accessible outside the container
CMD ["npm", "run", "dev", "--", "--host"]

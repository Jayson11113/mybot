# Use an official pre-configured image that already has all Chrome/Puppeteer dependencies installed
FROM ghcr.io/puppeteer/puppeteer:latest

USER root

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of your bot's files
COPY . .

# Expose the port for Render
EXPOSE 3000

# Start your application
CMD ["node", "index.js"]

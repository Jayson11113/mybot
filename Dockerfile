FROM ghcr.io/puppeteer/puppeteer:latest

# Ensure we use the built-in non-root user
USER pptruser
WORKDIR /usr/src/app

# Copy package files first to maximize Docker layer caching
COPY --chown=pptruser:pptruser package*.json ./

# Override the base image's skip-download flag
ENV PUPPETEER_SKIP_DOWNLOAD=false

# Install project dependencies
RUN npm install

# FORCE Puppeteer to install the exact Chrome version your package.json requires
RUN npx puppeteer browsers install chrome

# Copy the rest of your application code
COPY --chown=pptruser:pptruser . .

# Expose your Render dummy server port
EXPOSE 10000

CMD ["node", "index.js"]

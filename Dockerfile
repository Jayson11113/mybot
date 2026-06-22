FROM ghcr.io/puppeteer/puppeteer:latest

# 1. Switch to root temporarily to configure folder permissions
USER root

WORKDIR /usr/src/app

# 2. Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# 3. Copy the rest of your bot's files
COPY . .

# 4. CRITICAL: Grant the secure puppeteer user ownership of the application directory
RUN chown -R pptruser:pptruser /usr/src/app

# 5. Switch back to the secure user to run the bot safely
USER pptruser

# Expose the web port for Render
EXPOSE 3000

# Start your application
CMD ["node", "index.js"]

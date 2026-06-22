FROM ghcr.io/puppeteer/puppeteer:latest

# 1. Switch to root temporarily to set up the working directory
USER root
WORKDIR /usr/src/app
RUN chown -R pptruser:pptruser /usr/src/app

# 2. Switch to the secure non-root user BEFORE running npm install
USER pptruser

# 3. Copy package files with correct user ownership
COPY --chown=pptruser:pptruser package*.json ./

# 4. Install dependencies, clear the conflicting empty folder, and download Chrome fresh
RUN npm install
RUN rm -rf /home/pptruser/.cache/puppeteer
RUN npx puppeteer browsers install chrome

# 5. Copy the rest of your bot's files with correct user ownership
COPY --chown=pptruser:pptruser . .

# Expose the web port for Render
EXPOSE 3000

# Start your application
CMD ["node", "index.js"]

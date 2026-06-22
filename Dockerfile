FROM ghcr.io/puppeteer/puppeteer:latest

# 1. Switch to root temporarily to set up the working directory
USER root
WORKDIR /usr/src/app
RUN chown -R pptruser:pptruser /usr/src/app

# 2. Clear the base image's pre-installed browser cache to prevent any version conflicts
RUN rm -rf /home/pptruser/.cache/puppeteer

# 3. Switch to the secure non-root user
USER pptruser

# 4. Copy package files with correct user ownership
COPY --chown=pptruser:pptruser package*.json ./

# 5. Force Puppeteer to download the exact matching browser binary version during npm install
ENV PUPPETEER_SKIP_DOWNLOAD=false
RUN npm install

# 6. Copy the rest of your bot's files with correct user ownership
COPY --chown=pptruser:pptruser . .

# Expose the web port for Render
EXPOSE 3000

# Start your application
CMD ["node", "index.js"]

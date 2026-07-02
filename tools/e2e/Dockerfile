FROM mcr.microsoft.com/playwright:v1.60.0-noble

WORKDIR /app

# Copy Yarn Berry binary first (needed for yarn install)
COPY .yarn/releases/ .yarn/releases/
COPY .yarnrc.yml package.json yarn.lock ./

# Install all dependencies (cached layer — only invalidated when package.json/yarn.lock changes)
RUN yarn install --frozen-lockfile

# Copy the rest of the source
COPY . .

# Disable Nx daemon — it does not work reliably in containers
ENV NX_DAEMON=false
ENV CI=true

# playwright.config.ts automatically starts the Angular dev server via the webServer block,
# waits for it to be ready, runs the tests, and exits
CMD ["yarn", "run", "e2e:dev-ag-grid-angular"]

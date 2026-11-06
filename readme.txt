AZURE DEPLOYMENT

Run `npm run build` and deploy the contents of the generated `dist` folder as the site root using the existing ZIP deployment workflow. Do not deploy the source HTML files directly, because they contain shared-header markers that the build step expands.

LOCAL DEVELOPMENT

Run `npm install` once, then run `npm start` from the project root.
This builds the shared site header into the pages and serves the result at http://localhost:3000. Set the PORT environment variable to use another port.
Run `npm run build` to create the deployable site in the `dist` folder without starting the server. Deploy the contents of `dist`, not the source HTML files with include markers.

The site serves its static files locally. Job listings, resume uploads, and contact submissions use the API Gateway URL configured in js/site-api.js. The API Gateway and S3 bucket must allow requests from http://localhost:3000 for those flows to work from localhost.

The shared navigation and footer are maintained in `partials/site-header.html` and `partials/site-footer.html`. Pages use shared-header and shared-footer markers, and the build step inserts the same components into each generated page before it is served.

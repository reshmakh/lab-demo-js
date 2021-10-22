# Medplum Lab Demo

Example application to create FHIR resources for a lab request/response workflow.

Key features:

 1) Authenticate with server using OAuth client credentials flow

 2) Use FHIR Batch request to create Patient and ServiceRequest
    a) Use conditional create to only create Patient if necessary
    b) Use local ID's to link ServiceRequest to the Patient

 3) Create Observation and DiagnosticReport resources

  4) Read back the DiagnosticReport and Observations
    a) Use batch request to read all observations in one shot

## Usage

Clone and install:

```bash
git clone https://github.com/codyebberson/lab-demo-js.git
cd lab-demo-js
npm ci
```

Then edit index.js with your API credentials:

```javascript
const BASE_URL = 'https://api.medplum.com/';
const MY_CLIENT_ID = 'MY_CLIENT_ID';
const MY_CLIENT_SECRET = 'MY_CLIENT_SECRET';
```

Then run:

```bash
node index.js
```

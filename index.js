/*
 * Example application to create FHIR resources for a lab request/response workflow.
 *
 * Key features:
 *
 *  1) Authenticate with server using OAuth client credentials flow
 *
 *  2) Use FHIR Batch request to create Patient and ServiceRequest
 *     a) Use conditional create to only create Patient if necessary
 *     b) Use local ID's to link ServiceRequest to the Patient
 *
 */

const { randomUUID } = require('crypto');
const fetch = require('node-fetch');

const BASE_URL = 'https://api.medplum.com/';
const MY_CLIENT_ID = 'MY_CLIENT_ID';
const MY_CLIENT_SECRET = 'MY_CLIENT_SECRET';

let accessToken = null;

/**
 * Runs the example app.
 * 1) Authenticates.
 * 2) Creates a Patient and a ServiceRequest.
 */
async function main() {
  await authenticate();
  const [patientId, serviceRequestId] = await createServiceRequest();
}

/**
 * Authenticates using OAuth client credentials flow.
 * This sets the accessToken global.
 */
async function authenticate() {
  console.log('Authenticating...');
  const response = await fetch(BASE_URL + 'oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `grant_type=client_credentials&client_id=${MY_CLIENT_ID}&client_secret=${MY_CLIENT_SECRET}`
  });

  if (!response.ok) {
    console.log(response.body);
    throw new Error('Authentication failed.');
  }

  const data = await response.json();
  accessToken = data.access_token;
  console.log('Success!');
}

/**
 * Creates an order by creating Patient and ServiceRequest resources.
 */
async function createServiceRequest() {
  // Generate the patient URN.
  // The "urn:uuid:" prefis is special in a FHIR bundle.
  // It means "this is a local ID", so any references to the local ID will be
  // updated to the final ID once it has been assigned.
  const patientUrn = 'urn:uuid:' + randomUUID();

  // Generate an example MRN (Medical Record Number).
  // We will use this in the "conditional create".
  // When creating an order, and if you don't know if the patient exists,
  // you can use this MRN to check.
  const exampleMrn = randomUUID();

  // Make one batch to request to create both the Patient and ServiceRequest.
  // Use the "conditional create" ("ifNoneExist") feature to only create the patient if they do not exist.
  // Use the local ID feature ("urn:uuid:") to link the ServiceRequest to the Patient.
  const response = await fetch(BASE_URL + 'fhir/R4/', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/fhir+json'
    },
    body: JSON.stringify({
      resourceType: 'Bundle',
      type: 'batch',
      entry: [
        // First, create the patient if they don't exist.
        // Use the "conditional create" ("ifNoneExist") feature to only create the patient if they do not exist.
        {
          fullUrl: patientUrn,
          request: {
            method: 'POST',
            url: 'Patient',
            ifNoneExist: 'identifier=' + exampleMrn
          },
          resource: {
            resourceType: 'Patient',
            name: [{ given: ['Batch'], family: 'Test' }],
            birthDate: '2020-01-01',
            gender: 'male',
            identifier: [{ system: 'https://example.com/deidentified', value: exampleMrn }]
          }
        },
        // Next, create the service request.
        // Use the local ID feature ("urn:uuid:") to link the ServiceRequest to the Patient.
        {
          request: {
            method: 'POST',
            url: 'ServiceRequest'
          },
          resource: {
            resourceType: 'ServiceRequest',
            subject: {
              reference: patientUrn
            },
            code: {
              coding: [{
                system: 'https://example.com/availableskus',
                code: 'DEVICE_SKU'
              }]
            },
            orderDetail: [{
              text : 'CUSTOMER_ORDERED',
              coding : [
                {
                  system: 'https://example.com/logisticssummary',
                  code: 'PRE_DISPATCH'
                }
            ]}]
          }
        }
      ]
    })
  });

  const data = await response.json();
  console.log(JSON.stringify(data, undefined, 2));

  // Should print "Created" or "OK"
  console.log(data.entry[0].response.outcome.issue[0].details.text);

  // Should print "Patient/{id}"
  console.log(data.entry[0].response.location);

  // Should print "Created"
  console.log(data.entry[1].response.outcome.issue[0].details.text);

  // Should print "ServiceRequest/{id}"
  console.log(data.entry[1].response.location);

  // Return the patient and service request IDs as reference strings.
  return [data.entry[0].response.location, data.entry[1].response.location];
}

main();

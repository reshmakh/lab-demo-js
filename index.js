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
 *  3) Create Observation and DiagnosticReport resources
 *
 *  4) Read back the DiagnosticReport and Observations
 *     a) Use batch request to read all observations in one shot
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
 * 3) Creates Observations and DiagnosticReport.
 * 4) Reads back the Observation and DiagnosticReport.
 */
async function main() {
  await authenticate();
  const [patientId, serviceRequestId] = await createServiceRequest();
  const [diagnosticReportId] = await createReport(patientId, serviceRequestId);
  await readResults(diagnosticReportId);
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
            identifier: [{ system: 'https://example.com/', value: exampleMrn }]
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
                system: 'https://kit.com/tests',
                code: 'KIT_SKU'
              }]
            }
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

async function createReport(patientId, serviceRequestId) {
  const observtionUrn1 = 'urn:uuid:' + randomUUID();
  const observtionUrn2 = 'urn:uuid:' + randomUUID();

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
        // Create the first Observation resource.
        {
          fullUrl: observtionUrn1,
          request: {
            method: 'POST',
            url: 'Observation'
          },
          resource: {
            resourceType: 'Observation',
            basedOn: [{
              reference: serviceRequestId
            }],
            subject: {
              reference: patientId
            },
            code: {
              coding: [{
                system: 'https://kit.com/tests',
                code: 'abc',
                display: 'ABC'
              }]
            },
            valueQuantity: {
              value: 100,
              unit: 'mg/dL',
              system: 'http://unitsofmeasure.org',
              code: 'mg/dL'
            }
          }
        },
        // Create the second Observation resource.
        {
          fullUrl: observtionUrn2,
          request: {
            method: 'POST',
            url: 'Observation'
          },
          resource: {
            resourceType: 'Observation',
            basedOn: [{
              reference: serviceRequestId
            }],
            subject: {
              reference: patientId
            },
            code: {
              coding: [{
                system: 'https://kit.com/tests',
                code: 'xyz',
                display: 'XYZ'
              }]
            },
            valueQuantity: {
              value: 100,
              unit: 'mg/dL',
              system: 'http://unitsofmeasure.org',
              code: 'mg/dL'
            }
          }
        },
        // Create a DiagnosticReport resource.
        {
          request: {
            method: 'POST',
            url: 'DiagnosticReport'
          },
          resource: {
            resourceType: 'DiagnosticReport',
            basedOn: [{
              reference: serviceRequestId
            }],
            subject: {
              reference: patientId
            },
            code: {
              coding: [{
                system: 'https://kit.com/tests',
                code: 'KIT_SKU'
              }]
            },
            result: [
              {
                reference: observtionUrn1
              },
              {
                reference: observtionUrn2
              }
            ]
          }
        }
      ]
    })
  });

  const data = await response.json();

  // Return the DiagnosticReport IDs as reference strings.
  return [data.entry[2].response.location];
}

async function readResults(reportId) {
  const response1 = await fetch(BASE_URL + 'fhir/R4/' + reportId, {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer ' + accessToken
    }
  });

  const report = await response1.json();
  console.log(JSON.stringify(report, undefined, 2));

  const response2 = await fetch(BASE_URL + 'fhir/R4/', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + accessToken,
      'Content-Type': 'application/fhir+json'
    },
    body: JSON.stringify({
      resourceType: 'Bundle',
      type: 'batch',
      // Create a Bundle entry for each Observation resource.
      // Note the use of ".map()" to convert the array of Observation IDs 
      // to an array of Bundle entries.
      entry: report.result.map(result => ({
        request: {
          method: 'GET',
          url: result.reference
        }
      }))
    })
  });

  const results = await response2.json();
  console.log(JSON.stringify(results, undefined, 2));
}

main();

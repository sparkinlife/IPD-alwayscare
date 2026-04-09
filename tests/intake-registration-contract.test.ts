import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const registrationSource = readFileSync(
  new URL("../src/components/forms/registration-form.tsx", import.meta.url),
  "utf8"
);
const admissionsSource = readFileSync(
  new URL("../src/actions/admissions.ts", import.meta.url),
  "utf8"
);
const pendingSetupSource = readFileSync(
  new URL("../src/components/dashboard/pending-setup.tsx", import.meta.url),
  "utf8"
);
const patientHeaderSource = readFileSync(
  new URL("../src/components/patient/patient-header.tsx", import.meta.url),
  "utf8"
);
const dashboardQueriesSource = readFileSync(
  new URL("../src/lib/dashboard-queries.ts", import.meta.url),
  "utf8"
);

test("registration defaults stray to false and captures the new intake fields", () => {
  assert.match(registrationSource, /useState\(false\)/);
  assert.match(registrationSource, /name="ambulancePersonName"/);
  assert.match(registrationSource, /name="locationGpsCoordinates"/);
  assert.match(registrationSource, /name="handlingNote"/);
  assert.match(registrationSource, /Location Photo \/ Video/);
});

test("registration shows patient media immediately below color markings", () => {
  const colorIndex = registrationSource.indexOf("Color / Markings");
  const patientMediaIndex = registrationSource.indexOf("Patient Photo and Videos");
  const ambulanceIndex = registrationSource.indexOf("Ambulance Person Name");

  assert.ok(colorIndex >= 0, "expected color markings field");
  assert.ok(patientMediaIndex > colorIndex, "expected patient media section after color");
  assert.ok(
    ambulanceIndex > patientMediaIndex,
    "expected patient media section before ambulance person name"
  );
  assert.match(registrationSource, /Label htmlFor="patientMedia"/);
  assert.match(registrationSource, /id="patientMedia"/);
});

test("registration uploads the location photo separately from profile media", () => {
  assert.match(
    registrationSource,
    /buildDriveFolderPath\(patientName, "LOCATION"\)/
  );
  assert.match(registrationSource, /buildDriveFileName\("location",/);
  assert.match(
    registrationSource,
    /savePatientMedia\(patientId, locationUploads, false\)/
  );
  assert.match(registrationSource, /id="locationPhoto"/);
  assert.match(registrationSource, /accept="image\/\*,video\/\*"/);
});

test("registration handles submit and upload in one client flow", () => {
  assert.match(registrationSource, /async function handleSubmit/);
  assert.match(registrationSource, /await registerPatient\(null, formData\)/);
  assert.match(registrationSource, /<form onSubmit={handleSubmit}/);
  assert.doesNotMatch(registrationSource, /useActionState\(registerPatient/);
  assert.doesNotMatch(registrationSource, /useEffect\(\(\) => \{/);
});

test("handling note dropdown gives enough room for advanced handler labels", () => {
  assert.match(registrationSource, /SelectContent className="min-w-\[16rem\]" align="start"/);
  assert.match(pendingSetupSource, /SelectContent className="min-w-\[16rem\]" align="start"/);
  assert.match(patientHeaderSource, /SelectContent className="min-w-\[16rem\]" align="start"/);
});

test("registerPatient persists patient number and new intake metadata", () => {
  assert.match(
    admissionsSource,
    /const patientNumber = await reservePatientNumber\(tx\)/
  );
  assert.match(admissionsSource, /const handlingNote = validateHandlingNote/);
  assert.match(admissionsSource, /const ambulancePersonName =/);
  assert.match(admissionsSource, /const locationGpsCoordinates =/);
  assert.match(admissionsSource, /patientNumber,/);
  assert.match(admissionsSource, /ambulancePersonName,/);
  assert.match(admissionsSource, /handlingNote,/);
});

test("registered-patient editing covers the new intake fields", () => {
  assert.match(pendingSetupSource, /name="ambulancePersonName"/);
  assert.match(pendingSetupSource, /name="locationGpsCoordinates"/);
  assert.match(pendingSetupSource, /name="handlingNote"/);
  assert.match(admissionsSource, /editRegisteredPatient[\s\S]*handlingNote/);
  assert.match(admissionsSource, /updatePatient[\s\S]*handlingNote/);
  assert.match(pendingSetupSource, /patient\.patientNumber/);
  assert.match(dashboardQueriesSource, /patientNumber:\s*true/);
});

test("existing rescue location and rescuer info stay in the intake and edit flows", () => {
  assert.match(registrationSource, /Rescue Location/);
  assert.match(registrationSource, /name="rescuerInfo"/);
  assert.match(pendingSetupSource, /Rescue Location/);
  assert.match(pendingSetupSource, /name="rescuerInfo"/);
  assert.doesNotMatch(
    admissionsSource,
    /rescuerInfo:\s*isStray\s*\?\s*rescuerInfo\s*:\s*null/
  );
});

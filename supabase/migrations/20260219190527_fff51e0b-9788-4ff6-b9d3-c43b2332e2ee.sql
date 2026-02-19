
-- Step 1: Delete PHQ-9 assessment
DELETE FROM client_phq9_assessments
WHERE appointment_id = '93fac5aa-e53a-4968-8c47-b271380cb9fb';

-- Step 2: Delete clinical note (already done but safe to re-run)
DELETE FROM appointment_clinical_notes
WHERE appointment_id = '93fac5aa-e53a-4968-8c47-b271380cb9fb';

-- Step 3: Delete the appointment
DELETE FROM appointments
WHERE id = '93fac5aa-e53a-4968-8c47-b271380cb9fb';

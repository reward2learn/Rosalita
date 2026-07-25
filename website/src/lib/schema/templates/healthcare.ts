/**
 * Healthcare Template Schema
 *
 * Sector: Healthcare & medical services
 * W3C Standard: HL7/CDA (Clinical Document Architecture) for clinical records
 * schema.org: MedicalOrganization, Hospital
 */

import type { W3CSchemaDefinition } from '../types';

export const HEALTHCARE_SCHEMA: W3CSchemaDefinition = {
  templateId: 'healthcare',
  label: 'Healthcare',
  description: 'Healthcare operations: patient records, clinical encounters, document management, insurance claims, billing.',
  schemaOrgType: ['MedicalOrganization', 'Hospital'],
  xsdStandard: 'HL7/CDA',
  defaultColors: { primary: '#00838f', secondary: '#ef5350' },

  models: [
    {
      name: 'Patient',
      tableName: 'patient_records',
      schemaOrgMapping: {
        firstName: 'givenName',
        lastName: 'familyName',
        dateOfBirth: 'birthDate',
        gender: 'gender',
        phone: 'telephone',
        email: 'email',
      },
      fields: [
        { name: 'firstName', type: 'string', required: true, schemaOrgProperty: 'givenName', label: 'First Name', width: 6 },
        { name: 'lastName', type: 'string', required: true, schemaOrgProperty: 'familyName', label: 'Last Name', width: 6 },
        { name: 'dateOfBirth', type: 'date', required: true, schemaOrgProperty: 'birthDate', label: 'Date of Birth', width: 6 },
        { name: 'gender', type: 'enum', required: true, enumValues: ['male', 'female', 'other', 'unknown'], label: 'Gender', width: 6 },
        { name: 'mrn', type: 'string', required: true, unique: true, label: 'Medical Record No.', width: 6 },
        { name: 'phone', type: 'string', schemaOrgProperty: 'telephone', label: 'Phone', width: 6 },
        { name: 'email', type: 'string', schemaOrgProperty: 'email', label: 'Email', width: 6 },
        { name: 'insuranceProvider', type: 'string', label: 'Insurance Provider', width: 6 },
        { name: 'bloodType', type: 'enum', enumValues: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'unknown'], default: 'unknown', label: 'Blood Type', width: 6 },
      ],
    },
    {
      name: 'Encounter',
      tableName: 'patient_encounters',
      fields: [
        { name: 'patientMrn', type: 'string', required: true, label: 'Patient MRN', width: 6 },
        { name: 'encounterDate', type: 'datetime', required: true, label: 'Encounter Date/Time', width: 6 },
        { name: 'reason', type: 'text', required: true, label: 'Reason for Visit', width: 12 },
        { name: 'attendingPhysician', type: 'string', required: true, label: 'Attending Physician', width: 6 },
        { name: 'diagnosis', type: 'text', label: 'Diagnosis', width: 12 },
        { name: 'status', type: 'enum', required: true, enumValues: ['scheduled', 'in_progress', 'completed', 'cancelled'], default: 'scheduled', label: 'Status', width: 6 },
        { name: 'department', type: 'enum', required: true, enumValues: ['emergency', 'outpatient', 'inpatient', 'surgery', 'radiology', 'lab'], label: 'Department', width: 6 },
      ],
    },
    {
      name: 'ClinicalDocument',
      tableName: 'clinical_documents',
      fields: [
        { name: 'patientMrn', type: 'string', required: true, label: 'Patient MRN', width: 6 },
        { name: 'documentType', type: 'enum', required: true, enumValues: ['discharge_summary', 'progress_note', 'lab_result', 'imaging_report', 'consent_form', 'referral'], label: 'Document Type', width: 6 },
        { name: 'title', type: 'string', required: true, label: 'Title', width: 12 },
        { name: 'content', type: 'text', required: true, label: 'Content', width: 12 },
        { name: 'authoredAt', type: 'datetime', required: true, label: 'Authored At', width: 6 },
        { name: 'authorName', type: 'string', required: true, label: 'Author', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['draft', 'final', 'amended', 'withdrawn'], default: 'draft', label: 'Status', width: 6 },
      ],
    },
    {
      name: 'InsuranceClaim',
      tableName: 'insurance_claims',
      fields: [
        { name: 'patientMrn', type: 'string', required: true, label: 'Patient MRN', width: 6 },
        { name: 'claimNumber', type: 'string', required: true, unique: true, label: 'Claim Number', width: 6 },
        { name: 'encounterId', type: 'string', label: 'Encounter ID', width: 6 },
        { name: 'amount', type: 'decimal', required: true, schemaOrgProperty: 'offers.price', label: 'Claim Amount (IDR)', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['draft', 'submitted', 'under_review', 'approved', 'partially_paid', 'denied', 'paid'], default: 'draft', label: 'Status', width: 6 },
        { name: 'submittedAt', type: 'datetime', label: 'Submitted At', width: 6 },
        { name: 'payer', type: 'string', required: true, label: 'Payer/Insurer', width: 6 },
        { name: 'diagnosisCode', type: 'string', label: 'Diagnosis Code (ICD-10)', width: 6 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-HC-01', title: 'Patient registration', auth: 'public', route: '/patients', blockTypes: ['dynamic_form'], models: ['Patient'] },
    { id: 'UC-HC-02', title: 'Manage patient records', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Patient'] },
    { id: 'UC-HC-03', title: 'Record clinical encounter', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Encounter'] },
    { id: 'UC-HC-04', title: 'Clinical documentation', auth: 'google', route: '/admin', blockTypes: ['dynamic_form'], models: ['ClinicalDocument'] },
    { id: 'UC-HC-05', title: 'Insurance claim submission', auth: 'pin', route: '/claims', blockTypes: ['dynamic_form'], models: ['InsuranceClaim'] },
    { id: 'UC-HC-06', title: 'Healthcare operations dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: ['Encounter', 'InsuranceClaim'] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'patients', title: 'Patients', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Patients' },
    { slug: 'claims', title: 'Claims', authTier: 'pin', blockTypes: ['dynamic_form'], navLabel: 'Claims' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['dynamic_form', 'action_checklist'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'Patient' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};

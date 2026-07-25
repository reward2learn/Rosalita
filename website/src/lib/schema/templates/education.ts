/**
 * Education Template Schema
 *
 * Sector: Education & academic institutions
 * W3C Standard: IMS Global (LTI, QTI) for learning tools & assessment
 * schema.org: EducationalOrganization, Course
 */

import type { W3CSchemaDefinition } from '../types';

export const EDUCATION_SCHEMA: W3CSchemaDefinition = {
  templateId: 'education',
  label: 'Education',
  description: 'Education operations: course management, student enrollment, assignments, grading, academic performance tracking.',
  schemaOrgType: ['EducationalOrganization', 'Course'],
  xsdStandard: 'IMS Global',
  defaultColors: { primary: '#283593', secondary: '#fbc02d' },

  models: [
    {
      name: 'Course',
      tableName: 'courses',
      schemaOrgMapping: {
        code: 'courseCode',
        title: 'name',
        description: 'description',
        credits: 'numberOfCredits',
        instructor: 'provider',
      },
      fields: [
        { name: 'code', type: 'string', required: true, unique: true, schemaOrgProperty: 'courseCode', label: 'Course Code', width: 6 },
        { name: 'title', type: 'string', required: true, schemaOrgProperty: 'name', label: 'Course Title', width: 12 },
        { name: 'description', type: 'text', schemaOrgProperty: 'description', label: 'Description', width: 12 },
        { name: 'credits', type: 'integer', required: true, schemaOrgProperty: 'numberOfCredits', label: 'Credit Hours', width: 6 },
        { name: 'instructor', type: 'string', required: true, schemaOrgProperty: 'provider', label: 'Instructor', width: 6 },
        { name: 'department', type: 'enum', required: true, enumValues: ['science', 'mathematics', 'arts', 'humanities', 'business', 'engineering', 'medicine', 'law'], label: 'Department', width: 6 },
        { name: 'capacity', type: 'integer', required: true, label: 'Capacity', width: 6 },
        { name: 'startDate', type: 'date', required: true, label: 'Start Date', width: 6 },
        { name: 'endDate', type: 'date', required: true, label: 'End Date', width: 6 },
      ],
    },
    {
      name: 'Enrollment',
      tableName: 'course_enrollments',
      fields: [
        { name: 'courseId', type: 'string', required: true, label: 'Course ID', width: 6 },
        { name: 'studentName', type: 'string', required: true, label: 'Student Name', width: 12 },
        { name: 'studentEmail', type: 'string', required: true, label: 'Student Email', width: 6 },
        { name: 'enrolledAt', type: 'datetime', required: true, label: 'Enrolled At', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['active', 'completed', 'withdrawn', 'suspended'], default: 'active', label: 'Status', width: 6 },
        { name: 'finalGrade', type: 'string', label: 'Final Grade', width: 6 },
      ],
    },
    {
      name: 'Assignment',
      tableName: 'course_assignments',
      fields: [
        { name: 'courseId', type: 'string', required: true, label: 'Course ID', width: 6 },
        { name: 'title', type: 'string', required: true, label: 'Assignment Title', width: 12 },
        { name: 'description', type: 'text', required: true, label: 'Description', width: 12 },
        { name: 'dueDate', type: 'datetime', required: true, label: 'Due Date', width: 6 },
        { name: 'maxPoints', type: 'integer', required: true, label: 'Max Points', width: 6 },
        { name: 'assignmentType', type: 'enum', required: true, enumValues: ['homework', 'quiz', 'exam', 'project', 'presentation', 'lab'], label: 'Type', width: 6 },
        { name: 'status', type: 'enum', required: true, enumValues: ['draft', 'published', 'closed', 'graded'], default: 'draft', label: 'Status', width: 6 },
      ],
    },
    {
      name: 'Grade',
      tableName: 'student_grades',
      fields: [
        { name: 'enrollmentId', type: 'string', required: true, label: 'Enrollment ID', width: 6 },
        { name: 'assignmentId', type: 'string', required: true, label: 'Assignment ID', width: 6 },
        { name: 'score', type: 'decimal', required: true, label: 'Score', width: 6 },
        { name: 'letterGrade', type: 'enum', enumValues: ['A', 'B', 'C', 'D', 'F', 'incomplete'], label: 'Letter Grade', width: 6 },
        { name: 'gradedAt', type: 'datetime', required: true, label: 'Graded At', width: 6 },
        { name: 'feedback', type: 'text', label: 'Feedback', width: 12 },
      ],
    },
  ],

  useCases: [
    { id: 'UC-EDU-01', title: 'Browse course catalog', auth: 'public', route: '/courses', blockTypes: ['dynamic_form'], models: ['Course'] },
    { id: 'UC-EDU-02', title: 'Manage courses', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Course'] },
    { id: 'UC-EDU-03', title: 'Student enrollment', auth: 'pin', route: '/enrollments', blockTypes: ['dynamic_form'], models: ['Enrollment'] },
    { id: 'UC-EDU-04', title: 'Assignment management', auth: 'pin', route: '/admin', blockTypes: ['dynamic_form'], models: ['Assignment'] },
    { id: 'UC-EDU-05', title: 'Grade entry & feedback', auth: 'google', route: '/admin', blockTypes: ['dynamic_form'], models: ['Grade'] },
    { id: 'UC-EDU-06', title: 'Academic performance dashboard', auth: 'public', route: '/dashboard', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], models: ['Enrollment', 'Grade'] },
  ],

  pages: [
    { slug: 'dashboard', title: 'Dashboard', authTier: 'public', blockTypes: ['hero', 'kpi_cards', 'chart_financial'], navLabel: 'Dashboard' },
    { slug: 'courses', title: 'Courses', authTier: 'public', blockTypes: ['dynamic_form'], navLabel: 'Courses' },
    { slug: 'enrollments', title: 'Enrollments', authTier: 'pin', blockTypes: ['dynamic_form'], navLabel: 'Enrollments' },
    { slug: 'summary', title: 'Executive Summary', authTier: 'google', blockTypes: ['doc_markdown'], navLabel: 'Summary' },
    { slug: 'tasks', title: 'Tasks', authTier: 'pin', blockTypes: ['action_checklist'], navLabel: 'Tasks' },
    { slug: 'admin', title: 'Admin', authTier: 'pin', blockTypes: ['dynamic_form', 'action_checklist'], navLabel: 'Admin' },
  ],

  blocks: [
    { type: 'hero', label: 'Hero Banner' },
    { type: 'kpi_cards', label: 'KPI Cards' },
    { type: 'chart_financial', label: 'Financial Chart' },
    { type: 'dynamic_form', label: 'Dynamic Form (Schema-Driven)', model: 'Course' },
    { type: 'action_checklist', label: 'Action Checklist' },
    { type: 'doc_markdown', label: 'Markdown Document' },
  ],
};

/**
 * Monthly cost departments — mirror P&L sections with receipt compliance per category.
 */
import { MANUAL_INPUT_SECTIONS } from './pnl-actuals.js';

export const ACTUALS_COST_DEPARTMENTS = MANUAL_INPUT_SECTIONS.map((section) => ({
  id: section.id,
  label: section.title,
  shortLabel: {
    direct: 'Direct',
    staff: 'Payroll',
    marketing: 'Marketing',
    property: 'Property',
    overhead: 'Overhead',
  }[section.id] || section.title,
  description: {
    direct: 'Upload supplier invoices for food, beverage, entertainment, and other direct costs.',
    staff: 'Upload payroll slips, bank transfers, or wage summaries for this month.',
    marketing: 'Upload advertising and marketing expense receipts.',
    property: 'Upload rent, utilities, repairs, and body corporate invoices.',
    overhead: 'Upload admin, bank, communication, and sundry overhead receipts.',
  }[section.id] || 'Upload expense receipts for this category.',
  fields: section.fields,
}));

export function getActualsDepartment(deptId) {
  return ACTUALS_COST_DEPARTMENTS.find((d) => d.id === deptId) || null;
}

export function fieldKeysForDepartment(deptId) {
  const dept = getActualsDepartment(deptId);
  return dept ? dept.fields.map((f) => f.key) : [];
}

export function sectionForDepartment(deptId) {
  const dept = getActualsDepartment(deptId);
  if (!dept) return null;
  return { id: dept.id, title: dept.label, fields: dept.fields };
}

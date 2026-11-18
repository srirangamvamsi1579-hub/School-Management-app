// Designations belong to a role (department). When a role is picked, only its designations are offered.
// Parents have no designation: they are simply "Parent". Admins can add designations per role
// (Roles & Permissions → Designations); custom roles use the list of the role they were copied from.
export const ROLE_DESIGNATIONS = {
  ADMIN: ['School Administrator', 'IT Administrator', 'Office Manager'],
  PRINCIPAL: ['Principal', 'Vice Principal', 'Headmistress / Headmaster', 'Academic Director'],
  ACCOUNTANT: ['Accountant', 'Senior Accountant', 'Accounts Assistant', 'Cashier', 'Fee Clerk'],
  TEACHER: ['Pre-Primary Teacher', 'PRT', 'TGT', 'PGT', 'Class Teacher', 'Coordinator', 'Head of Department', 'Head of Teaching Staff', 'Vice Principal', 'Physical Education Teacher', 'Special Educator', 'Counsellor', 'Librarian', 'Lab Assistant'],
  FRONT_OFFICE: ['Receptionist', 'Front Office Executive', 'Admissions Officer', 'Office Assistant', 'Gate / Security Staff'],
  TRANSPORT: ['Transport In-charge', 'Transport Supervisor', 'Driver', 'Cleaner', 'Bus Helper / Attendant'],
  PARENT: ['Parent'],
  PLATFORM: ['Platform Support', 'Implementation Manager']
};
// Roles a person can ask for when creating their own account (Admin and Platform accounts are created by the school / us)
export const SIGNUP_ROLES = ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'ACCOUNTANT', 'PRINCIPAL'];

export function designationsFor(db, role) {
  if (!role) return [];
  const custom = (db.customRoles || []).find((r) => r.code === role);
  const base = custom ? custom.basedOn : role;
  const extra = db.roleDesignations?.[role] || db.roleDesignations?.[base] || [];
  return [...new Set([...(ROLE_DESIGNATIONS[base] || []), ...extra])];
}
// The designation a person gets when their role changes: parents are always "Parent"; otherwise keep it if it fits, else the role's first
export function fitDesignation(db, role, current) {
  if (role === 'PARENT') return 'Parent';
  const list = designationsFor(db, role);
  return list.includes(current) ? current : '';
}
export function designationProblem(db, role, designation) {
  if (!role) return 'Pick a role';
  if (role === 'PARENT') return designation && designation !== 'Parent' ? 'Parents have no designation' : '';
  if (!designation) return 'Pick a designation';
  return designationsFor(db, role).includes(designation) ? '' : `${designation} is not a ${role.toLowerCase().replace('_', ' ')} designation`;
}
export const allDesignations = (db) => [...new Set(Object.keys(ROLE_DESIGNATIONS).filter((r) => r !== 'PARENT').flatMap((r) => designationsFor(db, r)))];

// Department each user profile (role) belongs to. Schools can rename it in Roles & Permissions → User management.
export const ROLE_DEPARTMENTS = {
  ADMIN: 'Administration', PRINCIPAL: 'School Leadership', ACCOUNTANT: 'Accounts & Finance', TEACHER: 'Academics',
  FRONT_OFFICE: 'Front Office & Admissions', TRANSPORT: 'Transport', PARENT: 'Parents & Guardians', PLATFORM: 'Platform team' };
export function departmentOf(db, role) {
  if (!role) return '';
  if (db.roleDepartments?.[role]) return db.roleDepartments[role];
  const custom = (db.customRoles || []).find((r) => r.code === role);
  if (custom) return custom.department || ROLE_DEPARTMENTS[custom.basedOn] || '';
  return ROLE_DEPARTMENTS[role] || '';
}

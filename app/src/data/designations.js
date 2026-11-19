// Designations belong to a role (department). When a role is picked, only its designations are offered.
// Parents have no designation: they are simply "Parent". Admins can add designations per role
// (Roles & Permissions → Designations); custom roles use the list of the role they were copied from.
export const ROLE_DESIGNATIONS = {
  ADMIN: ['School Administrator', 'Administrative Officer', 'Office Manager', 'IT Administrator'],
  PRINCIPAL: ['Principal', 'Vice Principal', 'Headmistress / Headmaster', 'Academic Director'],
  ACCOUNTANT: ['Accounts Manager', 'Accountant', 'Senior Accountant', 'Accounts Assistant', 'Cashier', 'Fee Clerk', 'HR & Payroll Executive'],
  TEACHER: ['Pre-Primary Teacher', 'PRT', 'TGT', 'PGT', 'Class Teacher', 'Coordinator', 'Head of Department', 'Head of Teaching Staff', 'Vice Principal', 'Physical Education Teacher', 'Art & Craft Teacher', 'Music Teacher', 'Dance Teacher', 'Computer Teacher', 'Special Educator', 'Counsellor', 'Librarian', 'Lab Assistant'],
  FRONT_OFFICE: ['Receptionist', 'Front Office Executive', 'Admissions Officer', 'Admission Counsellor', 'Office Superintendent', 'Senior Secretariat Assistant (UDC)', 'Junior Secretariat Assistant (LDC)', 'Office Assistant', 'Data Entry Operator', 'Gate / Security Staff'],
  TRANSPORT: ['Transport In-charge', 'Transport Supervisor', 'Driver', 'Cleaner', 'Bus Helper / Attendant'],
  PARENT: ['Parent'],
  PLATFORM: ['Platform Support', 'Implementation Manager'], SALES: ['Sales Executive', 'Marketing Manager', 'Pre-sales Consultant'] };
// Roles a person can ask for when creating their own account (Admin and Platform accounts are created by the school / us)
export const SIGNUP_ROLES = ['PARENT', 'TEACHER', 'FRONT_OFFICE', 'TRANSPORT', 'ACCOUNTANT', 'PRINCIPAL'];
// Sign-up choices: the built-in ones still in use, plus profiles the school added
export const signupRoles = (db) => [...SIGNUP_ROLES.filter((r) => !(db.removedProfiles || []).includes(r)), ...(db.customRoles || []).map((r) => r.code)];

export function designationsFor(db, role) {
  if (!role) return [];
  const custom = (db.customRoles || []).find((r) => r.code === role);
  const base = custom ? custom.basedOn : role;
  const extra = db.roleDesignations?.[role] || db.roleDesignations?.[base] || [];
  // Designations the school removed from this profile (standard ones included). A profile copied from another also
  // drops what was removed there, unless it added that designation back itself.
  const removed = new Set([...(db.roleDesignationsRemoved?.[role] || []), ...(custom ? (db.roleDesignationsRemoved?.[base] || []).filter((d) => !(db.roleDesignations?.[role] || []).includes(d)) : [])]);
  return [...new Set([...(ROLE_DESIGNATIONS[base] || []), ...extra])].filter((d) => !removed.has(d));
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
  FRONT_OFFICE: 'Front Office & Admissions', TRANSPORT: 'Transport', PARENT: 'Parents & Guardians', PLATFORM: 'Platform team', SALES: 'Sales & Marketing' };
export function departmentOf(db, role) {
  if (!role) return '';
  if (db.roleDepartments?.[role]) return db.roleDepartments[role];
  const custom = (db.customRoles || []).find((r) => r.code === role);
  if (custom) return custom.department || ROLE_DEPARTMENTS[custom.basedOn] || '';
  return ROLE_DEPARTMENTS[role] || '';
}

// Standard departments and profiles for Indian schools (from school staff lists, KVS/NVS post names and job postings).
// The seven built-in profiles cover Administration, School Leadership, Academics, Accounts, Front Office, Transport and Parents.
// These extra profiles can be added in Roles & Permissions → User management with one click; "from" is the built-in
// profile whose screens a new department starts with (a profile joining an existing department gets that department's screens).
export const STANDARD_PROFILES = [
  { name: 'Librarian', department: 'Library', from: 'TEACHER', designations: ['Librarian', 'Assistant Librarian', 'Library Attendant'] },
  { name: 'Lab Staff', department: 'Laboratories', from: 'TEACHER', designations: ['Lab Assistant', 'Lab Attendant', 'Computer Lab Technician'] },
  { name: 'Sports Staff', department: 'Sports & Co-curricular', from: 'TEACHER', designations: ['Sports Coordinator', 'Sports Coach', 'Yoga Instructor', 'Self Defence Instructor'] },
  { name: 'Counsellor', department: 'Student Welfare & Health', from: 'TEACHER', designations: ['Student Counsellor', 'Special Educator', 'School Psychologist'] },
  { name: 'School Nurse', department: 'Student Welfare & Health', from: 'FRONT_OFFICE', designations: ['Staff Nurse', 'Resident Nurse', 'Medical Officer'] },
  { name: 'Hostel Staff', department: 'Hostel & Boarding', from: 'FRONT_OFFICE', designations: ['Hostel Warden', 'Assistant Hostel Warden', 'Housemistress / Housemaster', 'Matron', 'Mess Manager'] },
  { name: 'IT Staff', department: 'IT & Systems', from: 'FRONT_OFFICE', designations: ['IT Manager', 'System Administrator', 'ERP Executive', 'Hardware Technician'] },
  { name: 'Estate & Support Staff', department: 'Estate, Security & Housekeeping', from: 'FRONT_OFFICE', designations: ['Estate Manager', 'Purchase & Stores In-charge', 'Electrician', 'Security Supervisor', 'Security Guard', 'Housekeeping Supervisor', 'Multi-Tasking Staff (Peon)'] },
  { name: 'HR Staff', department: 'Human Resources', from: 'ACCOUNTANT', designations: ['HR Manager', 'HR Executive', 'Payroll Executive'] },
];

// Profiles a school still uses (removed built-in profiles are hidden; Admin and Platform can't be removed)
export const activeProfile = (db, code) => !(db.removedProfiles || []).includes(code);

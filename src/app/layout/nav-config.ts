export interface NavItem {
  label: string;
  path: string;
  icon: string;
  minRole: 'all' | 'manager' | 'admin';
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'heroHome', minRole: 'all' },
  { label: 'Properties', path: '/properties', icon: 'heroBuildingOffice2', minRole: 'all' },
  { label: 'Tenants', path: '/tenants', icon: 'heroUsers', minRole: 'all' },
  { label: 'Expenses', path: '/expenses', icon: 'heroCreditCard', minRole: 'manager' },
  {
    label: 'Guaranteed Payments',
    path: '/guaranteed-payments',
    icon: 'heroClock',
    minRole: 'manager',
  },
  { label: 'Approvals', path: '/approvals', icon: 'heroCheckCircle', minRole: 'manager' },
  { label: 'Settings', path: '/settings', icon: 'heroCog6Tooth', minRole: 'manager' },
  { label: 'Admin', path: '/admin', icon: 'heroUserGroup', minRole: 'admin' },
  {
    label: 'Audit',
    path: '/audit',
    icon: 'heroClipboardDocumentList',
    minRole: 'all',
  },
];

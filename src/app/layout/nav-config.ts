export interface NavItem {
  label: string;
  path: string;
  icon: string;
  minRole: 'all' | 'manager' | 'admin';
  /** Pin this item directly in the mobile bottom nav bar */
  bottomNav?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: 'heroHome', minRole: 'all', bottomNav: true },
  { label: 'Properties', path: '/properties', icon: 'heroBuildingOffice2', minRole: 'all' },
  { label: 'Tenants', path: '/tenants', icon: 'heroUsers', minRole: 'all' },
  {
    label: 'Expenses',
    path: '/expenses',
    icon: 'heroCreditCard',
    minRole: 'manager',
    bottomNav: true,
  },
  {
    label: 'Guaranteed Payments',
    path: '/guaranteed-payments',
    icon: 'heroClock',
    minRole: 'manager',
    bottomNav: true,
  },
  {
    label: 'Approvals',
    path: '/approvals',
    icon: 'heroCheckCircle',
    minRole: 'manager',
    bottomNav: true,
  },
  { label: 'Settings', path: '/settings', icon: 'heroCog6Tooth', minRole: 'manager' },
  { label: 'Admin', path: '/admin', icon: 'heroUserGroup', minRole: 'admin' },
  {
    label: 'Audit',
    path: '/audit',
    icon: 'heroClipboardDocumentList',
    minRole: 'all',
  },
];

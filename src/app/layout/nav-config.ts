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
  {
    label: 'Properties',
    path: '/properties',
    icon: 'heroBuildingOffice2',
    minRole: 'all',
    bottomNav: true,
  },
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
    label: 'Documents',
    path: '/documents',
    icon: 'heroDocumentText',
    minRole: 'all',
  },
  { label: 'Admin', path: '/admin', icon: 'heroUserGroup', minRole: 'admin' },
  {
    label: 'Audit',
    path: '/audit',
    icon: 'heroClipboardDocumentList',
    minRole: 'all',
  },
  { label: 'Settings', path: '/settings', icon: 'heroCog6Tooth', minRole: 'manager' },
];

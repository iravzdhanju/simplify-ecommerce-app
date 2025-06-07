import { NavItem } from '@/types';

// Import the real Product type from our API - but fallback to mock type for development
export type { Product } from '@/lib/api/products';

// Legacy Product type for backward compatibility
export type LegacyProduct = {
  photo_url: string;
  name: string;
  description: string;
  created_at: string;
  price: number;
  id: number;
  category: string;
  updated_at: string;
  marketplace: ('Shopify' | 'Amazon')[];
};

//Info: The following data is used for the sidebar navigation and Cmd K bar.
export const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    url: '/dashboard/overview',
    icon: 'dashboard',
    isActive: false,
    shortcut: ['d', 'd'],
    items: [] // Empty array as there are no child items for Dashboard
  },
  {
    title: 'Products',
    url: '/dashboard/product',
    icon: 'product',
    shortcut: ['p', 'p'],
    isActive: false,
    items: [] // No child items
  },
  {
    title: 'Sync',
    url: '#',
    icon: 'arrowRightLeft',
    shortcut: ['s', 's'],
    isActive: false,
    items: [
      {
        title: 'Shopify Sync',
        url: '/dashboard/sync/shopify',
        icon: 'store',
        shortcut: ['s', 'h']
      },
      {
        title: 'Bulk Import',
        url: '/dashboard/sync/bulk',
        icon: 'download',
        shortcut: ['b', 'i']
      },
      {
        title: 'Sync Logs',
        url: '/dashboard/sync/logs',
        icon: 'fileText',
        shortcut: ['s', 'l']
      }
    ]
  },
  {
    title: 'Connections',
    url: '/dashboard/connections',
    icon: 'link',
    shortcut: ['c', 'c'],
    isActive: false,
    items: [] // No child items
  },
  // Only show Account in development mode
  ...(process.env.NODE_ENV === 'development' ? [{
    title: 'Account',
    url: '#', // Placeholder as there is no direct link for the parent
    icon: 'billing' as const,
    isActive: true,

    items: [
      {
        title: 'Profile',
        url: '/dashboard/profile',
        icon: 'userPen' as const,
        shortcut: ['m', 'm'] as [string, string]
      },
      {
        title: 'Login',
        shortcut: ['l', 'l'] as [string, string],
        url: '/',
        icon: 'login' as const
      }
    ]
  }] : []),
  // Only show Kanban in development mode
  ...(process.env.NODE_ENV === 'development' ? [{
    title: 'Kanban',
    url: '/dashboard/kanban',
    icon: 'kanban' as const,
    shortcut: ['k', 'k'] as [string, string],
    isActive: false,
    items: [] // No child items
  }] : [])
];

export interface SaleUser {
  id: number;
  name: string;
  email: string;
  amount: string;
  image: string;
  initials: string;
}

export const recentSalesData: SaleUser[] = [
  {
    id: 1,
    name: 'Olivia Martin',
    email: 'olivia.martin@email.com',
    amount: '+$1,999.00',
    image: 'https://api.slingacademy.com/public/sample-users/1.png',
    initials: 'OM'
  },
  {
    id: 2,
    name: 'Jackson Lee',
    email: 'jackson.lee@email.com',
    amount: '+$39.00',
    image: 'https://api.slingacademy.com/public/sample-users/2.png',
    initials: 'JL'
  },
  {
    id: 3,
    name: 'Isabella Nguyen',
    email: 'isabella.nguyen@email.com',
    amount: '+$299.00',
    image: 'https://api.slingacademy.com/public/sample-users/3.png',
    initials: 'IN'
  },
  {
    id: 4,
    name: 'William Kim',
    email: 'will@email.com',
    amount: '+$99.00',
    image: 'https://api.slingacademy.com/public/sample-users/4.png',
    initials: 'WK'
  },
  {
    id: 5,
    name: 'Sofia Davis',
    email: 'sofia.davis@email.com',
    amount: '+$39.00',
    image: 'https://api.slingacademy.com/public/sample-users/5.png',
    initials: 'SD'
  }
];

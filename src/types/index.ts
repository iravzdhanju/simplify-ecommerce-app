import { Icons } from '@/components/icons';

export interface NavItem {
  title: string;
  url: string;
  disabled?: boolean;
  external?: boolean;
  shortcut?: [string, string];
  icon?: keyof typeof Icons;
  label?: string;
  description?: string;
  isActive?: boolean;
  items?: NavItem[];
}

export interface NavItemWithChildren extends NavItem {
  items: NavItemWithChildren[];
}

export interface NavItemWithOptionalChildren extends NavItem {
  items?: NavItemWithChildren[];
}

export interface FooterItem {
  title: string;
  items: {
    title: string;
    href: string;
    external?: boolean;
  }[];
}

export type MainNavItem = NavItemWithOptionalChildren;

export type SidebarNavItem = NavItemWithChildren;

export type ShopifyProduct = {
  id: number;
  title: string;
  handle: string;
  description: string;
  published_at: string;
  created_at: string;
  vendor: string;
  type: string;
  tags: string[];
  price: number;
  price_min: number;
  price_max: number;
  available: boolean;
  price_varies: boolean;
  compare_at_price?: number | null;
  compare_at_price_min?: number;
  compare_at_price_max?: number;
  compare_at_price_varies?: boolean;
  variants: Array<{
    id: number;
    title: string;
    options: string[];
    option1?: string | null;
    option2?: string | null;
    option3?: string | null;
    price: number;
    weight: number;
    compare_at_price?: number | null;
    inventory_management?: string | null;
    available: boolean;
    sku?: string | null;
    requires_shipping: boolean;
    taxable: boolean;
    barcode?: string | null;
  }>;
  images?: string[];
  featured_image?: string;
  options?: Array<{
    name: string;
    position: number;
  }>;
  url?: string;
};
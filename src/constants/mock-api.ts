////////////////////////////////////////////////////////////////////////////////
// 🛑 Nothing in here has anything to do with Nextjs, it's just a fake database
////////////////////////////////////////////////////////////////////////////////

import { faker } from '@faker-js/faker';
import { matchSorter } from 'match-sorter'; // For filtering

export const delay = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

// Define the shape of Product data
export type Product = {
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

// Mock product data store
export const fakeProducts = {
  records: [] as Product[], // Holds the list of product objects

  // Initialize with sample data
  initialize() {
    const sampleProducts: Product[] = [];
    function generateRandomProductData(id: number): Product {
      const categories = [
        'Electronics',
        'Furniture',
        'Clothing',
        'Toys',
        'Groceries',
        'Books',
        'Jewelry',
        'Beauty Products'
      ];

      // Generate random marketplace combinations
      const getRandomMarketplaces = (): ('Shopify' | 'Amazon')[] => {
        const combinations: ('Shopify' | 'Amazon')[][] = [
          ['Shopify'],
          ['Amazon'],
          ['Shopify', 'Amazon']
        ];
        return faker.helpers.arrayElement(combinations);
      };

      return {
        id,
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        created_at: faker.date
          .between({ from: '2022-01-01', to: '2023-12-31' })
          .toISOString(),
        price: parseFloat(faker.commerce.price({ min: 5, max: 500, dec: 2 })),
        photo_url: `https://api.slingacademy.com/public/sample-products/${id}.png`,
        category: faker.helpers.arrayElement(categories),
        marketplace: getRandomMarketplaces(),
        updated_at: faker.date.recent().toISOString()
      };
    }

    // Generate remaining records
    for (let i = 1; i <= 20; i++) {
      sampleProducts.push(generateRandomProductData(i));
    }

    this.records = sampleProducts;
  },

  // Get all products with optional category and marketplace filtering and search
  async getAll({
    categories = [],
    marketplaces = [],
    search
  }: {
    categories?: string[];
    marketplaces?: string[];
    search?: string;
  }) {
    let products = [...this.records];

    // Filter products based on selected categories
    if (categories.length > 0) {
      products = products.filter((product) =>
        categories.includes(product.category)
      );
    }

    // Filter products based on selected marketplaces
    if (marketplaces.length > 0) {
      products = products.filter((product) =>
        product.marketplace.some(marketplace => marketplaces.includes(marketplace))
      );
    }

    // Search functionality across multiple fields
    if (search) {
      products = matchSorter(products, search, {
        keys: ['name', 'description', 'category', 'marketplace']
      });
    }

    return products;
  },

  // Get paginated results with optional category and marketplace filtering and search
  async getProducts({
    page = 1,
    limit = 10,
    categories,
    marketplaces,
    search
  }: {
    page?: number;
    limit?: number;
    categories?: string;
    marketplaces?: string;
    search?: string;
  }) {
    await delay(200);
    const categoriesArray = categories ? categories.split('.') : [];
    const marketplacesArray = marketplaces ? marketplaces.split('.') : [];
    const allProducts = await this.getAll({
      categories: categoriesArray,
      marketplaces: marketplacesArray,
      search
    });
    const totalProducts = allProducts.length;

    // Pagination logic
    const offset = (page - 1) * limit;
    const paginatedProducts = allProducts.slice(offset, offset + limit);

    // Mock current time
    const currentTime = new Date().toISOString();

    // Return paginated response
    return {
      success: true,
      time: currentTime,
      message: 'Sample data for testing and learning purposes',
      total_products: totalProducts,
      offset,
      limit,
      products: paginatedProducts
    };
  },

  // Get a specific product by its ID
  async getProductById(id: number) {
    await delay(200); // Simulate a delay

    // Find the product by its ID
    const product = this.records.find((product) => product.id === id);

    if (!product) {
      return {
        success: false,
        message: `Product with ID ${id} not found`
      };
    }

    // Mock current time
    const currentTime = new Date().toISOString();

    return {
      success: true,
      time: currentTime,
      message: `Product with ID ${id} found`,
      product
    };
  }
};

// Initialize sample products
fakeProducts.initialize();

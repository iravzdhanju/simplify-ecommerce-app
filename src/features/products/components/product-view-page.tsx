import { fakeProducts, Product } from '@/constants/mock-api';
import { notFound } from 'next/navigation';
import EnhancedProductForm from './enhanced-product-form';

type TProductViewPageProps = {
  productId: string;
};

export default async function ProductViewPage({
  productId
}: TProductViewPageProps) {
  let product = null;
  let pageTitle = 'Create New Product';

  if (productId !== 'new') {
    const data = await fakeProducts.getProductById(productId);
    product = data.product as Product;
    if (!product) {
      notFound();
    }
    pageTitle = `Edit Product`;
  }

  return <EnhancedProductForm initialData={product} pageTitle={pageTitle} />;
}

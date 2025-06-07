'use client';

import { FileUploader } from '@/components/file-uploader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertModal } from '@/components/modal/alert-modal';
import { Product } from '@/constants/mock-api';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { useState } from 'react';
import { toast } from 'sonner';
import * as z from 'zod';

const MAX_FILE_SIZE = 5000000;
const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp'
];

const formSchema = z.object({
  image: z
    .any()
    .refine((files) => files?.length == 1, 'Image is required.')
    .refine(
      (files) => files?.[0]?.size <= MAX_FILE_SIZE,
      `Max file size is 5MB.`
    )
    .refine(
      (files) => ACCEPTED_IMAGE_TYPES.includes(files?.[0]?.type),
      '.jpg, .jpeg, .png and .webp files are accepted.'
    )
    .optional(),
  name: z.string().min(2, {
    message: 'Product name must be at least 2 characters.'
  }),
  category: z.string(),
  marketplace: z.array(z.enum(['Shopify', 'Amazon'])).min(1, {
    message: 'Please select at least one marketplace.'
  }),
  price: z.number(),
  description: z.string().min(10, {
    message: 'Description must be at least 10 characters.'
  })
});

export default function ProductForm({
  initialData,
  pageTitle
}: {
  initialData: Product | null;
  pageTitle: string;
}) {
  const isEditing = !!initialData;
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<z.infer<
    typeof formSchema
  > | null>(null);

  const defaultValues = {
    name: initialData?.name || '',
    category: initialData?.category || '',
    marketplace:
      initialData?.marketplace || (['Shopify'] as ('Shopify' | 'Amazon')[]),
    price: initialData?.price || 0,
    description: initialData?.description || ''
  };

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: defaultValues
  });

  function onSubmit(values: z.infer<typeof formSchema>) {
    if (isEditing) {
      // Show confirmation modal for updates
      setPendingFormData(values);
      setShowConfirmModal(true);
    } else {
      // Direct submission for new products
      handleFormSubmission(values);
    }
  }

  const handleFormSubmission = async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true);
    try {
      // Form submission logic would be implemented here
      console.log('Form values:', values);
      console.log('Is editing:', isEditing);
      console.log('Product ID:', initialData?.id);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // You would implement actual API calls here
      if (isEditing) {
        toast.success('Product updated successfully!');
        console.log('Product updated successfully!');
      } else {
        toast.success('Product created successfully!');
        console.log('Product created successfully!');
      }
    } catch (error) {
      console.error('Error submitting form:', error);
      toast.error('Failed to save product. Please try again.');
    } finally {
      setIsLoading(false);
      setShowConfirmModal(false);
      setPendingFormData(null);
    }
  };

  const handleConfirmUpdate = () => {
    if (pendingFormData) {
      handleFormSubmission(pendingFormData);
    }
  };

  const handleCancelUpdate = () => {
    setShowConfirmModal(false);
    setPendingFormData(null);
  };

  return (
    <>
      <AlertModal
        isOpen={showConfirmModal}
        onClose={handleCancelUpdate}
        onConfirm={handleConfirmUpdate}
        loading={isLoading}
        title='Confirm Product Update'
        description={`Are you sure you want to update "${initialData?.name}"? This will modify the existing product information.`}
        confirmText='Yes, Update Product'
        cancelText='Cancel'
        variant='default'
      />

      <Card className='mx-auto w-full'>
        <CardHeader>
          <CardTitle className='text-left text-2xl font-bold'>
            {pageTitle}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
              <FormField
                control={form.control}
                name='image'
                render={({ field }) => (
                  <div className='space-y-6'>
                    <FormItem className='w-full'>
                      <FormLabel>Images</FormLabel>
                      <FormControl>
                        <FileUploader
                          value={field.value}
                          onValueChange={field.onChange}
                          maxFiles={4}
                          maxSize={4 * 1024 * 1024}
                          disabled={isLoading}
                        />
                      </FormControl>
                      <FormMessage />
                      {isEditing && initialData?.photo_url && (
                        <div className='mt-2'>
                          <p className='text-muted-foreground text-sm'>
                            Current image:
                            <img
                              src={initialData.photo_url}
                              alt='Current product'
                              className='mt-2 h-20 w-20 rounded-lg object-cover'
                            />
                          </p>
                        </div>
                      )}
                    </FormItem>
                  </div>
                )}
              />

              <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='name'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Product Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder='Enter product name'
                          disabled={isLoading}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='category'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value)}
                        value={field.value}
                        disabled={isLoading}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder='Select category' />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value='Electronics'>
                            Electronics
                          </SelectItem>
                          <SelectItem value='Furniture'>Furniture</SelectItem>
                          <SelectItem value='Clothing'>Clothing</SelectItem>
                          <SelectItem value='Toys'>Toys</SelectItem>
                          <SelectItem value='Groceries'>Groceries</SelectItem>
                          <SelectItem value='Books'>Books</SelectItem>
                          <SelectItem value='Jewelry'>Jewelry</SelectItem>
                          <SelectItem value='Beauty Products'>
                            Beauty Products
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='marketplace'
                  render={() => (
                    <FormItem>
                      <div className='mb-4'>
                        <FormLabel className='text-base'>
                          Marketplaces
                        </FormLabel>
                      </div>
                      {['Shopify', 'Amazon'].map((marketplace) => (
                        <FormField
                          key={marketplace}
                          control={form.control}
                          name='marketplace'
                          render={({ field }) => {
                            return (
                              <FormItem
                                key={marketplace}
                                className='flex flex-row items-start space-y-0 space-x-3'
                              >
                                <FormControl>
                                  <Checkbox
                                    checked={field.value?.includes(
                                      marketplace as 'Shopify' | 'Amazon'
                                    )}
                                    disabled={isLoading}
                                    onCheckedChange={(checked) => {
                                      return checked
                                        ? field.onChange([
                                            ...field.value,
                                            marketplace
                                          ])
                                        : field.onChange(
                                            field.value?.filter(
                                              (value) => value !== marketplace
                                            )
                                          );
                                    }}
                                  />
                                </FormControl>
                                <FormLabel className='font-normal'>
                                  {marketplace}
                                </FormLabel>
                              </FormItem>
                            );
                          }}
                        />
                      ))}
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name='price'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Price</FormLabel>
                      <FormControl>
                        <Input
                          type='number'
                          step='0.01'
                          placeholder='Enter price'
                          disabled={isLoading}
                          {...field}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder='Enter product description'
                        className='resize-none'
                        disabled={isLoading}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type='submit' disabled={isLoading}>
                {isLoading
                  ? isEditing
                    ? 'Updating...'
                    : 'Adding...'
                  : isEditing
                    ? 'Update Product'
                    : 'Add Product'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </>
  );
}

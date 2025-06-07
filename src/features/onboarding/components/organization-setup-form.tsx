'use client';

import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { useOrganizationStore } from '@/stores/organization-store';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import * as z from 'zod';
import { Building2, Upload, X } from 'lucide-react';

const formSchema = z.object({
  name: z
    .string()
    .min(1, 'Organization name is required')
    .max(50, 'Name must be less than 50 characters'),
  logo: z.string().optional()
});

type FormData = z.infer<typeof formSchema>;

export default function OrganizationSetupForm() {
  const router = useRouter();
  const { setOrganization } = useOrganizationStore();
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      logo: ''
    }
  });

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Check file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast.error('Logo file size must be less than 2MB');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        toast.error('Please upload an image file');
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setLogoPreview(result);
        form.setValue('logo', result);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeLogo = () => {
    setLogoPreview(null);
    form.setValue('logo', '');
  };

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      // Set organization data
      setOrganization({
        name: data.name,
        logo: data.logo,
        isSetup: true
      });

      toast.success('Organization setup completed!');
      router.push('/dashboard/overview');
    } catch (error) {
      toast.error('Failed to setup organization. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
        <FormField
          control={form.control}
          name='name'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Name *</FormLabel>
              <FormControl>
                <Input
                  placeholder='Enter your organization name'
                  {...field}
                  disabled={isLoading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name='logo'
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization Logo (Optional)</FormLabel>
              <FormControl>
                <div className='space-y-4'>
                  {logoPreview ? (
                    <div className='relative inline-block'>
                      <div className='flex h-20 w-20 items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-gray-300'>
                        <img
                          src={logoPreview}
                          alt='Logo preview'
                          className='h-full w-full object-cover'
                        />
                      </div>
                      <Button
                        type='button'
                        variant='destructive'
                        size='sm'
                        className='absolute -top-2 -right-2 h-6 w-6 rounded-full p-0'
                        onClick={removeLogo}
                      >
                        <X className='h-3 w-3' />
                      </Button>
                    </div>
                  ) : (
                    <div className='flex h-20 w-20 items-center justify-center rounded-lg border-2 border-dashed border-gray-300'>
                      <Building2 className='h-8 w-8 text-gray-400' />
                    </div>
                  )}

                  <div>
                    <Input
                      type='file'
                      accept='image/*'
                      onChange={handleLogoUpload}
                      disabled={isLoading}
                      className='hidden'
                      id='logo-upload'
                    />
                    <Button
                      type='button'
                      variant='outline'
                      onClick={() =>
                        document.getElementById('logo-upload')?.click()
                      }
                      disabled={isLoading}
                      className='w-full'
                    >
                      <Upload className='mr-2 h-4 w-4' />
                      Upload Logo
                    </Button>
                    <p className='text-muted-foreground mt-2 text-xs'>
                      PNG, JPG up to 2MB. Recommended size: 200x200px
                    </p>
                  </div>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type='submit' className='w-full' disabled={isLoading}>
          {isLoading ? 'Setting up...' : 'Complete Setup'}
        </Button>
      </form>
    </Form>
  );
}

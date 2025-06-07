import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Organization {
    id: string;
    name: string;
    logo?: string;
    isSetup: boolean;
}

interface OrganizationStore {
    organization: Organization | null;
    setOrganization: (org: Partial<Organization>) => void;
    updateOrganization: (updates: Partial<Organization>) => void;
    clearOrganization: () => void;
}

export const useOrganizationStore = create<OrganizationStore>()(
    persist(
        (set, get) => ({
            organization: null,

            setOrganization: (org) => {
                set({
                    organization: {
                        id: org.id || crypto.randomUUID(),
                        name: org.name || '',
                        logo: org.logo,
                        isSetup: org.isSetup || false,
                    },
                });
            },

            updateOrganization: (updates) => {
                const current = get().organization;
                if (current) {
                    set({
                        organization: {
                            ...current,
                            ...updates,
                        },
                    });
                }
            },

            clearOrganization: () => {
                set({ organization: null });
            },
        }),
        {
            name: 'organization-storage',
        }
    )
); 
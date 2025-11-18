// Temporary placeholder supabase client to prevent build errors.
// Replace later when Ambassador & Community dashboards are ready.

export const supabase = {
  from: () => ({
    insert: async () => ({ error: null }),
    update: async () => ({ error: null }),
    select: async () => ({ data: [], error: null })
  })
};

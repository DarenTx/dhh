import { InjectionToken, makeEnvironmentProviders } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '../../../environments/environment';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SUPABASE_CLIENT');

export function provideSupabase() {
  return makeEnvironmentProviders([
    {
      provide: SUPABASE_CLIENT,
      useFactory: () =>
        createClient(environment.supabase.url, environment.supabase.anonKey, {
          auth: {
            flowType: 'pkce',
            storage: localStorage,
            detectSessionInUrl: false,
          },
        }),
    },
  ]);
}

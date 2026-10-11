alter table public.property_market_values
add column if not exists source text not null default 'zillow';

alter table public.property_market_values
add constraint property_market_values_source_check
check (source in ('zillow', 'appraisal', 'manual', 'other'));

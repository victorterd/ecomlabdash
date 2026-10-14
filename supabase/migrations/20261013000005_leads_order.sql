-- =====================================================================
-- Ecomlab CRM — ordinea taburilor de la Lead-uri
--   • statusul de follow-up vine primul (imediat după „Toate”);
--   • sursele: Recomandare, TikTok, apoi cele „cold”, apoi restul.
-- Ordinea se poate schimba oricând din Setări → Lead-uri (săgețile ↑ ↓).
-- =====================================================================

update public.lead_statuses
set sort_order = 1
where is_follow_up;

with ranked as (
  select
    id,
    row_number() over (
      order by
        case
          when name ilike '%recomand%' then 0
          when name ilike '%tiktok%' then 1
          when name ilike '%cold%' then 2
          else 3
        end,
        sort_order,
        name
    ) as position
  from public.lead_sources
)
update public.lead_sources s
set sort_order = r.position * 10
from ranked r
where r.id = s.id;

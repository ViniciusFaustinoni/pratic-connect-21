

# Fix: Trigger references non-existent `hora_agendada` on vistorias

## Root Cause
The migration `20260314231618` created the trigger function `sync_vistoria_update_to_servicos` with `hora_agendada = NEW.hora_agendada`, but the `vistorias` table has no such column. This causes error `42703` on any UPDATE to `vistorias` (including video upload).

## Fix
One SQL migration to remove the `hora_agendada` reference from the vistoria sync trigger:

```sql
CREATE OR REPLACE FUNCTION public.sync_vistoria_update_to_servicos()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  UPDATE public.servicos SET
    profissional_id = NEW.vistoriador_id,
    data_agendada = NEW.data_agendada,
    -- REMOVED: hora_agendada = NEW.hora_agendada (column doesn't exist on vistorias)
    status = public.map_to_status_servico(NEW.status::text),
    logradouro = COALESCE(NEW.endereco_logradouro, servicos.logradouro),
    numero = COALESCE(NEW.endereco_numero, servicos.numero),
    bairro = COALESCE(NEW.endereco_bairro, servicos.bairro),
    cidade = COALESCE(NEW.endereco_cidade, servicos.cidade),
    uf = COALESCE(NEW.endereco_uf, servicos.uf),
    latitude = COALESCE(NEW.endereco_latitude, servicos.latitude),
    longitude = COALESCE(NEW.endereco_longitude, servicos.longitude),
    updated_at = now()
  WHERE vistoria_origem_id = NEW.id;
  RETURN NEW;
END;
$function$;
```

Single file change: one new migration SQL file.


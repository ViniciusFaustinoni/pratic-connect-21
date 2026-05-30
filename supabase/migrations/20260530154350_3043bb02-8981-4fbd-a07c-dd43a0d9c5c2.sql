UPDATE public.vistorias
SET video_360_url = 'https://iyxdgmukrrdkffraptsx.supabase.co/storage/v1/object/public/cotacoes-vistoria/fe7e833c-5d0b-49ab-9307-91346bc47758/video_360-1780151506840.mp4',
    status = 'concluida',
    concluida_em = COALESCE(concluida_em, now()),
    updated_at = now()
WHERE id = '8a617730-9cce-4ca9-a1b0-c69f6b529801'
  AND video_360_url IS NULL;
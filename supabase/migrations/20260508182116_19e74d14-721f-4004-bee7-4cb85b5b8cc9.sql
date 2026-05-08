UPDATE associados SET softruck_user_id = 'Ndzlwj87qKQagyv' WHERE id = 'e6583ab5-e4ba-4594-b929-29dc771c5357' AND softruck_user_id IS NULL;
UPDATE rastreadores 
SET softruck_response_raw = jsonb_set(COALESCE(softruck_response_raw,'{}'::jsonb), '{softruckUserId}', '"Ndzlwj87qKQagyv"'::jsonb),
    updated_at = now()
WHERE imei = '863829079716880';
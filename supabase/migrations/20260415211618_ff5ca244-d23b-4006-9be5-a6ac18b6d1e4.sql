UPDATE benefits
SET carencia_ativa = true,
    carencia_dias = 120,
    carencia_tipo = 'liberacao'
WHERE id IN (
  'c113dde7-4fff-456f-9da5-e5a6e6e00b65',
  '438d00a5-77ad-48f4-b12f-1d6086419f14',
  'aa814dd5-a823-4fa4-9774-866de2c73071',
  '7e50a65b-b184-4cbf-92e5-3ee06d1793a2',
  '2c3c7a35-3f8d-49e8-bc03-b266844fd9e8',
  '52feac98-11db-4bf5-81bf-129929439b52',
  '0281768e-4304-4448-af92-9729e36ec4be',
  'eb4f3b9d-7986-480b-ad23-18d1bc099a09',
  'd9399e62-7ae5-401c-a4ac-8de34d23301d',
  'a753ee5c-5f16-4e5d-9fcb-dd9f2c4f1354',
  '5f4c2e62-75c8-4c82-bba5-fa7132172771',
  '128e3edb-363a-4fd1-bb9e-096dc3eec0d7',
  'bc28efdc-72ac-4d8e-80e7-a183502fb733',
  '7ae4ab2b-d05d-4be1-b080-3ad02abed4c5',
  'a728b9ec-ae8d-4145-bc0e-604bf50d0af9',
  'b4462ce8-cb25-47fd-8f12-4f3b90a1918a',
  '4f64870a-ca39-4225-9cf1-30ace74392a1',
  '14545a2e-01e7-4098-8c6d-b04b42e7b1ba',
  'a1496237-97df-4c48-82cd-84fe0dc915f5',
  'b51a7bdf-fd04-4aca-9b2b-532670f7e6c9'
);
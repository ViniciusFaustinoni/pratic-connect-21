
-- Popular limite_terceiros e cota_terceiros nos planos existentes

-- ADVANCED+: R$10mil, cota R$750
UPDATE planos SET limite_terceiros = 10000, cota_terceiros = 750, cota_terceiros_isento = false WHERE id = 'aee01ee7-d037-48c3-9625-4ef091649156';

-- R$40mil plans (ISENTO de cota para terceiro)
UPDATE planos SET limite_terceiros = 40000, cota_terceiros = 0, cota_terceiros_isento = true WHERE id IN (
  'fe82bc38-d37d-42ed-a31d-09b7926fb376',
  '74b8abc5-48bd-48a6-84c3-8f27910a22dd',
  '43fe1e6a-374e-4b69-a76b-aea3f142b3c1',
  'fd6be7d7-6ec7-4d2c-8b56-cca80d14c3f4',
  'feeff63c-b2bc-4475-bee0-44c53c8591ff'
);

-- R$100mil plans (ISENTO)
UPDATE planos SET limite_terceiros = 100000, cota_terceiros = 0, cota_terceiros_isento = true WHERE id IN (
  '20c3685f-2909-4ca3-be04-f0f116a7c0cd',
  'ba180738-4b11-4d7e-8ed0-7f73df3e5155'
);

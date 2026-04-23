DELETE FROM entity_eligibility_rules
WHERE entity_type = 'linha'
  AND entity_id = 'b46f9ca8-2842-4dbb-a21d-9d7293343ec5';

INSERT INTO entity_eligibility_rules (entity_type, entity_id, rule_type, rule_mode, rule_config, is_active)
VALUES (
  'linha','b46f9ca8-2842-4dbb-a21d-9d7293343ec5','ano_range','include',
  '{"ano_min": 2024, "ano_max": null}'::jsonb, true
);

INSERT INTO entity_eligibility_rules (entity_type, entity_id, rule_type, rule_mode, rule_config, is_active)
VALUES (
  'linha','b46f9ca8-2842-4dbb-a21d-9d7293343ec5','marca_modelo','include',
  '{"modelos": [
    {"marca":"JEEP","modelo":"COMPASS","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"JEEP","modelo":"RENEGADE","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"CHEVROLET","modelo":"EQUINOX","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"CHEVROLET","modelo":"TRACKER","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"CHEVROLET","modelo":"MONTANA","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"FIAT","modelo":"TORO","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"FIAT","modelo":"PULSE","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"FIAT","modelo":"CRONOS","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"FIAT","modelo":"FASTBACK","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"RENAULT","modelo":"CAPTUR","ano_min":2020,"ano_max":null,"status":"limitado"},
    {"marca":"RENAULT","modelo":"OROCH","ano_min":2020,"ano_max":null,"status":"limitado"},
    {"marca":"RENAULT","modelo":"DUSTER","ano_min":2020,"ano_max":null,"status":"limitado"},
    {"marca":"RENAULT","modelo":"KARDIAN","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"VOLKSWAGEN","modelo":"T-CROSS","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"VOLKSWAGEN","modelo":"NIVUS","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"VOLKSWAGEN","modelo":"VIRTUS","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"VOLKSWAGEN","modelo":"AMAROK","ano_min":2013,"ano_max":null,"status":"limitado"},
    {"marca":"VOLKSWAGEN","modelo":"TERA","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"CITROËN","modelo":"C4 CACTUS","ano_min":2020,"ano_max":null,"status":"limitado"},
    {"marca":"CITROËN","modelo":"C3","ano_min":2020,"ano_max":null,"status":"limitado"},
    {"marca":"NISSAN","modelo":"KICKS","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"HONDA","modelo":"CITY","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"PEUGEOT","modelo":"2008","ano_min":2015,"ano_max":null,"status":"limitado"},
    {"marca":"TOYOTA","modelo":"COROLLA","ano_min":2024,"ano_max":null,"status":"limitado"},
    {"marca":"HYUNDAI","modelo":"CRETA","ano_min":2022,"ano_max":null,"status":"limitado"}
  ]}'::jsonb, true
);
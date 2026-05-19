UPDATE marcas_modelos
SET tipo_veiculo = 'moto'
WHERE tipo_veiculo = 'carro'
  AND marca = 'HONDA'
  AND modelo ~* '\m(cg|cb|cbr|pcx|biz|pop|titan|fan|nxr|bros|xre|lander|tenere|crosser|crf|sahara|twister|hornet|elite|adv|sh|lead|xadv|x-adv|transalp|cargo|nx|nighthawk|shadow|magna|africa twin)\M';

UPDATE marcas_modelos
SET tipo_veiculo = 'moto'
WHERE tipo_veiculo = 'carro'
  AND marca = 'BMW'
  AND modelo ~* '\m(s 1000|f 650|f 700|f 750|f 800|f 850|f 900|r 1100|r 1150|r 1200|r 1250|r 1300|g 310|g 450|g 650|k 1200|k 1300|k 1600|c 400|c 600|c 650|c evolution|hp2|hp4|nine t)\M';
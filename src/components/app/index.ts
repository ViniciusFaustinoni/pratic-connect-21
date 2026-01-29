// Card components (reutilizáveis)
export { CardVeiculo } from './CardVeiculo';
export { 
  CardBoleto, 
  CardBoletoSkeleton, 
  statusConfig as boletoStatusConfig,
  formatarValor,
  calcularDiasParaVencer,
  type BoletoData 
} from './CardBoleto';
export { CardAcessoRapido, BotaoAcessoRapido } from './CardAcessoRapido';
export { CardAlerta, ListaAlertas, CardTudoEmDia } from './CardAlerta';
export { CardPlano } from './CardPlano';

// QR Code Pix component
export { QRCodePix } from './QRCodePix';
export type { 
  QRCodePixProps, 
  PixData, 
  QRCodeVariant, 
  QRCodeSize,
  QRCodeStatus 
} from './QRCodePix/types';

// Configuração de alertas do rastreador
export { ConfiguracaoAlertasCard } from './ConfiguracaoAlertasCard';

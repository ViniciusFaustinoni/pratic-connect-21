import { QRCodePix } from '@/components/app/QRCodePix';
import type { PixData } from '@/components/app/QRCodePix/types';

interface PixQRCodeProps {
  qrCodeUrl?: string;
  copiaCola: string;
  valor: number;
  descricao?: string;
  onCopied?: () => void;
}

export function PixQRCode({ 
  copiaCola, 
  valor, 
  descricao,
  onCopied 
}: PixQRCodeProps) {
  const pixData: PixData = {
    codigo: copiaCola,
    valor: valor,
    descricao: descricao,
  };

  return (
    <QRCodePix
      pix={pixData}
      variante="expandido"
      tamanho="lg"
      mostrarValor={true}
      mostrarCodigo={true}
      mostrarAcoes={true}
      mostrarInstrucoes={true}
      mostrarCountdown={false}
      onCopiar={onCopied ? () => onCopied() : undefined}
      className="bg-white rounded-xl shadow-sm"
    />
  );
}

export default PixQRCode;

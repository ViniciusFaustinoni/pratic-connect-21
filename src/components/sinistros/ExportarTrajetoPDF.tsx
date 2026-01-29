import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface TrajetoPonto {
  latitude: number;
  longitude: number;
  velocidade: number;
  ignicao: boolean;
  data_posicao: string;
  endereco?: string;
}

interface PontoParada {
  latitude: number;
  longitude: number;
  inicio: string;
  fim: string;
  duracao_minutos: number;
  endereco?: string;
}

interface ExportarTrajetoPDFProps {
  protocolo: string;
  veiculo?: { placa: string; marca: string; modelo: string } | null;
  associado?: { nome: string } | null;
  dataOcorrencia: string;
  localOcorrencia?: string | null;
  trajeto: TrajetoPonto[];
  paradas: PontoParada[];
  latitudeInformada?: number | null;
  longitudeInformada?: number | null;
  rastreadorLat?: number | null;
  rastreadorLng?: number | null;
}

export function ExportarTrajetoPDF({
  protocolo,
  veiculo,
  associado,
  dataOcorrencia,
  localOcorrencia,
  trajeto,
  paradas,
  latitudeInformada,
  longitudeInformada,
  rastreadorLat,
  rastreadorLng,
}: ExportarTrajetoPDFProps) {
  const [loading, setLoading] = useState(false);

  const gerarPDF = async () => {
    setLoading(true);
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      let yPos = 20;

      // Título
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('RELATÓRIO DE TRAJETO - SINISTRO', pageWidth / 2, yPos, { align: 'center' });
      yPos += 10;

      // Protocolo
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Protocolo: ${protocolo}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // Linha separadora
      doc.setDrawColor(200);
      doc.line(20, yPos, pageWidth - 20, yPos);
      yPos += 10;

      // Informações do sinistro
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('DADOS DO SINISTRO', 20, yPos);
      yPos += 8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      
      const infoSinistro = [
        ['Veículo:', veiculo ? `${veiculo.placa} - ${veiculo.marca} ${veiculo.modelo}` : 'N/A'],
        ['Associado:', associado?.nome || 'N/A'],
        ['Data do Evento:', format(new Date(dataOcorrencia), "dd/MM/yyyy HH:mm", { locale: ptBR })],
        ['Local:', localOcorrencia || 'Não informado'],
      ];

      infoSinistro.forEach(([label, value]) => {
        doc.setFont('helvetica', 'bold');
        doc.text(label, 20, yPos);
        doc.setFont('helvetica', 'normal');
        doc.text(value, 55, yPos);
        yPos += 6;
      });

      yPos += 10;

      // Posições GPS
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('POSIÇÕES GPS REGISTRADAS', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');

      if (latitudeInformada && longitudeInformada) {
        doc.text(`Posição informada pelo usuário: ${latitudeInformada.toFixed(6)}, ${longitudeInformada.toFixed(6)}`, 20, yPos);
        yPos += 6;
      }

      if (rastreadorLat && rastreadorLng) {
        doc.text(`Posição do rastreador: ${rastreadorLat.toFixed(6)}, ${rastreadorLng.toFixed(6)}`, 20, yPos);
        yPos += 6;
      }

      // Calcular distância se ambas posições existem
      if (latitudeInformada && longitudeInformada && rastreadorLat && rastreadorLng) {
        const R = 6371;
        const dLat = (rastreadorLat - latitudeInformada) * Math.PI / 180;
        const dLng = (rastreadorLng - longitudeInformada) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(latitudeInformada * Math.PI / 180) * Math.cos(rastreadorLat * Math.PI / 180) * 
          Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        const distancia = R * c;
        
        doc.setFont('helvetica', 'bold');
        const distanciaStr = distancia < 1 ? `${Math.round(distancia * 1000)}m` : `${distancia.toFixed(2)}km`;
        doc.text(`Distância entre posições: ${distanciaStr}`, 20, yPos);
        yPos += 6;
      }

      yPos += 10;

      // Resumo do trajeto
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text('RESUMO DO TRAJETO (24h antes)', 20, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total de pontos registrados: ${trajeto.length}`, 20, yPos);
      yPos += 6;
      doc.text(`Total de paradas identificadas: ${paradas.length}`, 20, yPos);
      yPos += 6;

      if (trajeto.length > 0) {
        const velocidades = trajeto.map(p => p.velocidade).filter(v => v > 0);
        const velMedia = velocidades.length > 0 ? velocidades.reduce((a, b) => a + b, 0) / velocidades.length : 0;
        const velMax = velocidades.length > 0 ? Math.max(...velocidades) : 0;
        doc.text(`Velocidade média: ${velMedia.toFixed(1)} km/h`, 20, yPos);
        yPos += 6;
        doc.text(`Velocidade máxima: ${velMax} km/h`, 20, yPos);
        yPos += 10;
      }

      // Tabela de paradas
      if (paradas.length > 0) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.text('PARADAS IDENTIFICADAS', 20, yPos);
        yPos += 5;

        const paradasData = paradas.map((p, idx) => [
          (idx + 1).toString(),
          format(new Date(p.inicio), "dd/MM HH:mm", { locale: ptBR }),
          format(new Date(p.fim), "dd/MM HH:mm", { locale: ptBR }),
          `${p.duracao_minutos} min`,
          `${p.latitude.toFixed(6)}, ${p.longitude.toFixed(6)}`,
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['#', 'Início', 'Fim', 'Duração', 'Coordenadas']],
          body: paradasData,
          theme: 'striped',
          headStyles: { fillColor: [59, 130, 246] },
          styles: { fontSize: 8 },
          margin: { left: 20, right: 20 },
        });
      }

      // Rodapé
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(
          `Relatório gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })} - Página ${i} de ${pageCount}`,
          pageWidth / 2,
          doc.internal.pageSize.getHeight() - 10,
          { align: 'center' }
        );
      }

      // Salvar PDF
      doc.save(`trajeto-sinistro-${protocolo}.pdf`);
      toast.success('Relatório PDF gerado com sucesso!');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      toast.error('Erro ao gerar relatório PDF');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className="gap-2"
      onClick={gerarPDF}
      disabled={loading || trajeto.length === 0}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4" />
      )}
      Exportar PDF
    </Button>
  );
}

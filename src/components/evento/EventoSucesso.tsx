import { CheckCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface Props {
  dadosEtapa1: any;
  dadosEtapa2: any;
  dadosEtapa3: any;
}

export default function EventoSucesso({ dadosEtapa1, dadosEtapa2, dadosEtapa3 }: Props) {
  const fotosCount = dadosEtapa1?.arquivos_urls?.length || 0;
  const numeroBO = dadosEtapa2?.numero_bo || '-';
  const relatoTexto = dadosEtapa3?.relato_texto || '';
  const temAudio = (dadosEtapa3?.arquivos_urls?.length || 0) > 0;

  return (
    <div className="space-y-4 text-center">
      <CheckCircle className="h-16 w-16 mx-auto text-green-500" />
      <div>
        <h2 className="text-xl font-bold">Tudo certo!</h2>
        <p className="text-sm text-muted-foreground mt-2">
          Recebemos todas as informações. Agora nossa equipe vai analisar o seu caso.
          Em breve você receberá uma atualização pelo WhatsApp.
        </p>
        <p className="text-sm text-muted-foreground mt-1 font-medium">
          O prazo de análise é de até 7 dias úteis após a documentação completa.
        </p>
      </div>

      <Card>
        <CardContent className="pt-4 text-left space-y-3">
          <h3 className="font-semibold text-sm">Resumo do envio</h3>

          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">📷 Auto Vistoria</p>
            <p>{fotosCount} foto(s) enviada(s)</p>
          </div>

          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">📄 Boletim de Ocorrência</p>
            <p>Nº {numeroBO}</p>
          </div>

          <div className="text-sm space-y-1">
            <p className="text-muted-foreground">💬 Relato</p>
            {relatoTexto && <p className="line-clamp-3">{relatoTexto}</p>}
            {temAudio && <p className="text-green-600">🎙️ Áudio gravado</p>}
            {!relatoTexto && !temAudio && <p>-</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

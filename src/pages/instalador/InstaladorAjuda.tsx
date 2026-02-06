import { useState } from 'react';
import { ArrowLeft, HelpCircle, Phone, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

const faqs = [
  {
    pergunta: 'Como iniciar o serviço?',
    resposta: 'Na tela inicial, toque no botão "Iniciar Serviço". O sistema vai solicitar permissão de localização e, após confirmação, você estará disponível para receber tarefas.',
  },
  {
    pergunta: 'O que fazer se não tenho GPS?',
    resposta: 'Verifique se o GPS está ativado nas configurações do celular. Se o problema persistir, reinicie o aplicativo ou entre em contato com o suporte.',
  },
  {
    pergunta: 'Como funciona o encaixe urgente?',
    resposta: 'Encaixes urgentes são tarefas de última hora que aparecem como notificações especiais. Você pode aceitar ou recusar dentro do prazo estipulado.',
  },
  {
    pergunta: 'Como tirar fotos da vistoria?',
    resposta: 'Durante a execução da tarefa, acesse a seção "Fotos" e utilize a câmera do celular para registrar cada item solicitado. As fotos são enviadas automaticamente.',
  },
];

export default function InstaladorAjuda() {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const ligarCoordenador = () => {
    window.open('tel:+5521970048549', '_self');
  };

  const abrirWhatsApp = () => {
    window.open('https://wa.me/5521970048549?text=Olá, preciso de ajuda no app do instalador.', '_blank');
  };

  return (
    <div className="min-h-screen bg-slate-900">
      <div className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-slate-400 hover:text-white"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-blue-400" />
            Ajuda e Suporte
          </h1>
        </div>

        {/* Contatos Rápidos */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-slate-300 px-1">Precisa de ajuda?</h2>
          
          <Card 
            className="border-slate-700 bg-slate-800 cursor-pointer hover:bg-slate-750 transition-colors"
            onClick={ligarCoordenador}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-green-600/20 flex items-center justify-center">
                <Phone className="h-5 w-5 text-green-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">Ligar para Coordenador</p>
                <p className="text-xs text-slate-400">(11) 99999-9999</p>
              </div>
            </CardContent>
          </Card>

          <Card 
            className="border-slate-700 bg-slate-800 cursor-pointer hover:bg-slate-750 transition-colors"
            onClick={abrirWhatsApp}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-600/20 flex items-center justify-center">
                <MessageSquare className="h-5 w-5 text-emerald-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">WhatsApp Suporte</p>
                <p className="text-xs text-slate-400">Enviar mensagem</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* FAQs */}
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-slate-300 px-1 pt-2">Dúvidas Frequentes</h2>
          
          {faqs.map((faq, index) => (
            <Collapsible
              key={index}
              open={openFaq === faq.pergunta}
              onOpenChange={(open) => setOpenFaq(open ? faq.pergunta : null)}
            >
              <Card className="border-slate-700 bg-slate-800">
                <CollapsibleTrigger asChild>
                  <CardContent className="p-4 flex items-center justify-between cursor-pointer">
                    <p className="text-sm text-white pr-2">{faq.pergunta}</p>
                    {openFaq === faq.pergunta ? (
                      <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0" />
                    )}
                  </CardContent>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4">
                    <p className="text-sm text-slate-400">{faq.resposta}</p>
                  </div>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      </div>
    </div>
  );
}

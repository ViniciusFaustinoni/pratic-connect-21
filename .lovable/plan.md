
# Plano: Implementar Entrada de Áudio no Chat do Assistente

## Visão Geral

**SIM, é possível!** O associado poderá gravar áudios que serão transcritos e enviados para a IA entender.

### Fluxo Proposto

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  Usuário grava  │ →  │  Áudio enviado   │ →  │   Transcrição   │ →  │   IA processa    │
│   áudio (mic)   │    │  para backend    │    │   via Whisper   │    │  texto normal    │
└─────────────────┘    └──────────────────┘    └─────────────────┘    └──────────────────┘
```

---

## Implementação

### 1. Atualizar ChatInput.tsx - Adicionar Botão de Microfone

**Arquivo:** `src/components/app/chat/ChatInput.tsx`

Adicionar:
- Botão de microfone ao lado do campo de texto
- Estados para controlar gravação (`isRecording`, `audioBlob`)
- Animação visual durante gravação (pulso vermelho)
- Lógica de `MediaRecorder` para capturar áudio

```typescript
import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Mic, MicOff, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendAudio?: (audioBlob: Blob) => void;
  isLoading?: boolean;
  isTranscribing?: boolean;
  placeholder?: string;
}

export function ChatInput({ 
  onSend, 
  onSendAudio,
  isLoading, 
  isTranscribing,
  placeholder = 'Digite sua mensagem...' 
}: ChatInputProps) {
  const [value, setValue] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Iniciar gravação
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (onSendAudio) onSendAudio(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000);
    } catch (err) {
      console.error('Erro ao acessar microfone:', err);
      toast.error('Não foi possível acessar o microfone');
    }
  };

  // Parar gravação
  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // Cancelar gravação
  const cancelRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop());
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  return (
    <div className="flex items-end gap-2 p-4 border-t bg-background">
      {isRecording ? (
        // UI de gravação
        <div className="flex-1 flex items-center gap-3 px-4 py-3 bg-red-50 dark:bg-red-950 rounded-lg">
          <div className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-medium text-red-600 dark:text-red-400">
            Gravando... {Math.floor(recordingTime / 60)}:{(recordingTime % 60).toString().padStart(2, '0')}
          </span>
          <Button variant="ghost" size="sm" onClick={cancelRecording}>
            Cancelar
          </Button>
        </div>
      ) : (
        <Textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={isTranscribing ? 'Transcrevendo áudio...' : placeholder}
          disabled={isLoading || isTranscribing}
          className="min-h-[44px] max-h-[120px] resize-none"
          rows={1}
        />
      )}

      {/* Botão de Microfone */}
      {!value.trim() && !isRecording && (
        <Button
          onClick={startRecording}
          disabled={isLoading || isTranscribing}
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          <Mic className="h-5 w-5" />
        </Button>
      )}

      {/* Botão de Parar/Enviar */}
      {isRecording ? (
        <Button onClick={stopRecording} size="icon" className="h-11 w-11 shrink-0 bg-red-500 hover:bg-red-600">
          <Square className="h-5 w-5" />
        </Button>
      ) : (
        <Button
          onClick={handleSubmit}
          disabled={!value.trim() || isLoading}
          size="icon"
          className="h-11 w-11 shrink-0"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </Button>
      )}
    </div>
  );
}
```

---

### 2. Criar Edge Function de Transcrição de Áudio

**Arquivo:** `supabase/functions/transcrever-audio/index.ts`

Usar OpenAI Whisper (já temos a `OPENAI_API_KEY`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;

    if (!audioFile) {
      return new Response(
        JSON.stringify({ error: "Arquivo de áudio não fornecido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY não configurada");

    // Enviar para Whisper API
    const whisperFormData = new FormData();
    whisperFormData.append("file", audioFile, "audio.webm");
    whisperFormData.append("model", "whisper-1");
    whisperFormData.append("language", "pt"); // Português

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Whisper error:", errorText);
      throw new Error("Erro ao transcrever áudio");
    }

    const result = await response.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        text: result.text 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
```

---

### 3. Atualizar Hook useAssistenteChat

**Arquivo:** `src/hooks/useAssistenteChat.ts`

Adicionar função para processar áudio:

```typescript
const sendAudio = useCallback(async (audioBlob: Blob) => {
  if (isLoading) return;

  // Placeholder para feedback visual
  const userMessageId = crypto.randomUUID();
  setMessages(prev => [...prev, {
    id: userMessageId,
    role: 'user',
    content: '🎤 Mensagem de voz',
    timestamp: new Date(),
    isAudio: true,
  }]);

  setIsLoading(true);
  setIsTranscribing(true);

  try {
    // 1. Transcrever áudio
    const formData = new FormData();
    formData.append('audio', audioBlob, 'audio.webm');

    const { data, error } = await supabase.functions.invoke('transcrever-audio', {
      body: formData,
    });

    if (error || !data?.text) throw new Error('Falha na transcrição');

    // 2. Atualizar mensagem do usuário com texto transcrito
    setMessages(prev => prev.map(m => 
      m.id === userMessageId 
        ? { ...m, content: data.text, isAudio: false }
        : m
    ));

    setIsTranscribing(false);

    // 3. Enviar texto para a IA (fluxo normal)
    await sendMessage(data.text);

  } catch (error) {
    console.error('Erro ao processar áudio:', error);
    toast.error('Não foi possível processar o áudio');
    setMessages(prev => prev.filter(m => m.id !== userMessageId));
  } finally {
    setIsLoading(false);
    setIsTranscribing(false);
  }
}, [isLoading, sendMessage]);
```

---

### 4. Atualizar AppChat.tsx

**Arquivo:** `src/pages/app/AppChat.tsx`

Conectar o novo callback de áudio:

```typescript
const { messages, isLoading, isTranscribing, sendMessage, sendAudio, clearMessages } = useAssistenteChat();

// ...

<ChatInput
  onSend={sendMessage}
  onSendAudio={sendAudio}
  isLoading={isLoading}
  isTranscribing={isTranscribing}
  placeholder="Digite ou grave sua mensagem..."
/>
```

---

## Resumo dos Arquivos

| Arquivo | Ação | Descrição |
|---------|------|-----------|
| `src/components/app/chat/ChatInput.tsx` | Modificar | Adicionar botão de microfone e lógica de gravação |
| `supabase/functions/transcrever-audio/index.ts` | Criar | Edge Function para transcrição via Whisper |
| `src/hooks/useAssistenteChat.ts` | Modificar | Adicionar `sendAudio` e estado `isTranscribing` |
| `src/pages/app/AppChat.tsx` | Modificar | Conectar novo callback de áudio |

---

## UX Esperada

1. **Sem texto digitado** → Aparece botão de **microfone** 🎤
2. **Usuário toca no microfone** → Inicia gravação com timer e animação vermelha
3. **Usuário toca em parar** → Áudio é enviado para transcrição
4. **Durante transcrição** → Mostra "Transcrevendo áudio..." no placeholder
5. **Texto transcrito** → Aparece no chat e IA responde normalmente

---

## Alternativa: Entrada de Áudio Direta no Gemini

O modelo Gemini 2.5 suporta entrada de áudio diretamente (sem transcrição prévia). Podemos usar isso como alternativa futura para:
- Reduzir latência
- Capturar nuances de voz
- Suportar comandos por voz mais naturais

Mas o fluxo com Whisper é mais simples para implementar agora e funciona perfeitamente.

---

## Tecnologias Utilizadas

| Componente | Tecnologia |
|------------|------------|
| Gravação | `MediaRecorder` API (nativo do browser) |
| Transcrição | OpenAI Whisper (`whisper-1`) via `OPENAI_API_KEY` |
| Processamento | Edge Function `transcrever-audio` |
| Chat | Fluxo existente do `assistente-chat` |

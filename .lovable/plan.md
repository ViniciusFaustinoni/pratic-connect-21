

# Video Substitution with Hidden History for the Associate

## Summary

Allow the associate to "remove" and replace their uploaded video during the event self-inspection (Etapa 1). From the associate's perspective, the old video is deleted. But on the backend, ALL videos ever uploaded are preserved and visible to the analyst.

---

## How It Works

### Data Structure Change

Currently `dados_etapa1` stores a flat `arquivos_urls` array. We add a new field:

```text
dados_etapa1: {
  arquivos_urls: [...current visible URLs...],
  historico_videos: [
    { url: "...", enviado_em: "2026-02-24T...", substituido_em: "2026-02-24T..." },
    { url: "...", enviado_em: "2026-02-24T...", substituido_em: "2026-02-24T..." }
  ]
}
```

- `arquivos_urls` always reflects what the associate "sees" (latest video only)
- `historico_videos` accumulates ALL previous videos with timestamps

---

## Phase 1: Backend (salvar-etapa-evento)

**File**: `supabase/functions/salvar-etapa-evento/index.ts`

When `etapa === 1` and the link already has `dados_etapa1` with video URLs:

1. Before overwriting `dados_etapa1`, check if there are existing video URLs in the old data
2. Move any existing video URLs to `historico_videos` array with a `substituido_em` timestamp
3. Merge the new upload data, preserving the accumulated `historico_videos`

This way, every re-submission of Etapa 1 appends old videos to the history instead of losing them.

Key changes:
- Read existing `link.dados_etapa1` before updating
- Extract video URLs from old `arquivos_urls` (files matching mp4/webm/mov)
- Append them to `historico_videos` with metadata
- Merge into new `dadosEtapa` before saving

---

## Phase 2: Frontend - Associate View (EventoEtapa1Vistoria.tsx)

**File**: `src/components/evento/EventoEtapa1Vistoria.tsx`

Currently, the "remove video" button only works on local state (before submit). After the etapa is submitted, the associate cannot go back.

Changes needed:
- If the etapa was already completed (associate returns to the link), show the current video with a "Substituir Video" button
- Clicking "Substituir" clears the local video preview and lets them pick a new one
- Re-submitting sends the new video to the backend (which handles the history preservation)
- The old video simply disappears from the associate's view

To support re-submission of Etapa 1:
- The backend currently blocks re-submission because `etapa1_completada_em` is already set
- Add a `substituir_video` flag in the `dados` JSON so the backend knows to allow re-submission of just the video portion

---

## Phase 3: Backend - Allow Video Substitution on Completed Etapa

**File**: `supabase/functions/salvar-etapa-evento/index.ts`

Add handling for a special case: when `etapa === 1` AND `dados.substituir_video === true`:
- Skip the validation that etapa 1 is already complete
- Only process the video file (not photos)
- Keep existing photo URLs from `dados_etapa1.arquivos_urls`
- Move old video URLs to `historico_videos`
- Add the new video URL to `arquivos_urls`
- Do NOT update `etapa1_completada_em` again

---

## Phase 4: Analyst View (SinistroAnalise.tsx)

**File**: `src/pages/eventos/SinistroAnalise.tsx`

In the section that displays Etapa 1 media, add:

- After showing the current video, check for `dados_etapa1.historico_videos`
- If there are previous videos, show a collapsible section titled "Videos Anteriores (Substituidos)"
- Each entry shows:
  - The video player
  - "Enviado em: [date]"
  - "Substituido em: [date]"
- Visual indicator (amber/warning badge) alerting the analyst that the associate replaced their video
- This is a potential fraud indicator -- if someone replaces a video, it could mean they're trying to hide something

---

## Files Affected

| File | Change |
|------|--------|
| `supabase/functions/salvar-etapa-evento/index.ts` | Preserve video history on re-submission |
| `src/components/evento/EventoEtapa1Vistoria.tsx` | Allow video substitution after completion |
| `src/pages/eventos/SinistroAnalise.tsx` | Show all videos (current + history) to analyst |

## What Does NOT Change

- Photo upload/removal flow stays the same
- Etapa 2 (B.O.) flow unchanged
- The associate never sees old videos after replacing
- No database migration needed (uses existing JSONB field)


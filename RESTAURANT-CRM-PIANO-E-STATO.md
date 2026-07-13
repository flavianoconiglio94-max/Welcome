# Restaurant CRM — Piano completo e stato di avanzamento

> Documento pensato per essere incollato come contesto in una nuova sessione Claude Code, collegata a un nuovo repository GitHub (nuovo account, per evitare il limite di 2 progetti Supabase free raggiunto sull'organizzazione precedente "thebearpizza"). Contiene tutte le decisioni prese, il perché, e cosa resta da fare.

## Obiettivo del progetto

Costruire un **gestionale prenotazioni ristorante SaaS multi-tenant**, da vendere a più ristoratori diversi, con:
- pagina pubblica di prenotazione per ogni ristorante cliente (sempre "guest checkout", **nessun login cliente**);
- pulsante "Prenota un tavolo" collegabile a Google Business Profile/Maps e a Facebook/Instagram (link-out manuale, funziona da subito, nessuna approvazione richiesta);
- architettura dati/API predisposta fin dal giorno 1 per lo standard **"Reserve with Google"** (Google Actions Center, "Reservations End-to-End integration"), per poter in futuro candidarsi come partner Google — requisito **essenziale** per l'utente, non opzionale;
- import prenotazioni da **PDF export di TheFork Manager** (upload manuale, parsing, revisione, commit);
- billing/abbonamenti rimandati a fase successiva.

## Decisioni architetturali chiave (con motivazione)

1. **Stack**: Next.js (App Router, TypeScript) + Supabase (Postgres + Auth + RLS) + Vercel. Scelto per rapidità di sviluppo, RLS nativo per multi-tenancy, e perché la sessione aveva tool MCP Supabase/Vercel pronti.

2. **Multi-tenant fin dal giorno 1** (non single-restaurant): l'utente venderà il prodotto a più ristoratori. Ogni tabella "di tenant" ha `restaurant_id`. Due soli livelli di identità autenticata: `platform_admins` (nessuno scope, gestiscono onboarding) e `staff_profiles` (scoped a un solo `restaurant_id`, ruoli owner/manager/staff).

3. **Nessun account/login cliente — per decisione esplicita dell'utente**: il cliente non deve MAI autenticarsi per prenotare. Ogni prenotazione è guest checkout puro: `guest_name`, `guest_email`, `guest_phone` sono colonne dirette sulla tabella `reservations`, niente tabella `customers` né `auth.users` per i clienti. Gestione/cancellazione tramite link con `cancellation_token`, non tramite sessione. Se la prenotazione arriva da Google (Reserve with Google) o Meta (Instagram/Facebook), i dati di contatto forniti da quei canali possono precompilare il form — ma questo non implica creare un account.

4. **"Reserve with Google" — verificato con ricerca web (2026)**: il programma esiste, si chiama ora "Reservations End-to-End integration" nel Google Actions Center. Eleggibilità: serve una "relazione contrattuale diretta con i merchant" — requisito che un SaaS multi-ristorante soddisfa naturalmente diventando esso stesso il partner Google, mentre ogni ristorante cliente è un "merchant" sotto di esso. Requisiti tecnici: Maps Booking API con feed disponibilità realtime, booking/cancellazione/update API, inventario "completo" (non parziale), 30+ giorni di disponibilità. Processo: Partner Interest Form → review tecnica → approvazione discrezionale Google (nessuna soglia minima pubblica di ristoranti, ma Google è selettivo). **Decisione presa**: costruire ORA le API interne nel formato compatibile (get_availability/create_reservation/cancel_reservation con vocabolario merchant/availability/booking), e candidarsi presto (Fase 4) appena ci sono ristoranti pilota reali — non aspettare "dopo".
   - Fonti: https://developers.google.com/actions-center/verticals/reservations/e2e/overview , https://support.google.com/reserve/answer/9172607?hl=en , https://services.google.com/fb/forms/reservationsappointmentsonlinebooking-interestform/

5. **Riferimento competitivo — Restoo**: l'utente ha condiviso screenshot di **Restoo**, gestionale prenotazioni concorrente già sul mercato, multi-locale. Da lì abbiamo adottato per il v1:
   - pipeline di stato prenotazione granulare: `unconfirmed` (non confermata) → `pending_seat` (in attesa di sedersi) → `confirmed` (confermata) → `seated` (seduta) → stati finali `completed`/`cancelled`/`no_show`;
   - sezioni sala (`dining_sections`, es. "Interno Pizzeria", "Interno Bar") raggruppando i tavoli, senza editor grafico piantine (fuori scope v1);
   - scheda cliente minima senza account: tabella `guest_directory` con note/tag/conteggio visite, associata via email o telefono.
   - Restano fuori scope v1 (roadmap futura): Campagne/Annunci marketing, Recensioni, Reports avanzati, editor grafico piantine.

6. **Import da TheFork Manager (PDF)** — analizzato un vero export PDF fornito dall'utente (ristorante "Benthos Porto Rotondo", servizio PRANZO). È una tabella pulita renderizzata da web (non uno scan), con intestazione (ristorante, data, fascia servizio, totale prenotazioni/coperti, timestamp) e colonne: **Orario | Cliente | Persone | Tavolo | Stato | Informazioni Sul Cliente | Informazioni Sulla Prenotazione | Note**. Il campo Tavolo è spesso vuoto (non ancora assegnato). Questo permette un **parser deterministico** (no OCR/AI necessari in v1). Mappatura stato: `Prenotato`→`confirmed`, `Arrivato`→`seated`, `Annullato`→`cancelled`, `Completato`→`completed`, `No-show`→`no_show`. **Importante**: mai importare "alla cieca" — sempre un'anteprima/revisione editabile prima del commit finale (protezione contro variazioni di formato).

## Modello dati (già scritto, vedi file SQL nello zip allegato)

File: `supabase/migrations/0001_multi_tenant_schema.sql` e `0002_booking_rpcs.sql`.

Tabelle: `restaurants` (slug, nome, timezone, `opening_hours` jsonb per giorno settimana, link GBP/Facebook/Instagram, config slot/durata/party-size/lead-time/orizzonte prenotazione, `requires_manual_confirmation`), `platform_admins`, `staff_profiles`, `dining_sections`, `dining_tables` (con `section_id`), `reservations` (con `table_id` **nullable**, pipeline di stato, `source` incluso `thefork_import`, `external_booking_id` per futura integrazione Google, `cancellation_token`, vincolo anti-doppia-prenotazione `EXCLUDE USING gist` su stati attivi che ignora naturalmente `table_id` null), `guest_directory` (CRM minimo senza account, dedupe per email o telefono via due indici unique parziali), `reservation_imports` (audit import PDF).

RLS: helper `is_platform_admin()` e `current_staff_restaurant_id()` (security definer), policy per tabella. Nessuna policy "cliente" — le pagine pubbliche non leggono mai le tabelle direttamente, passano sempre dalle RPC.

RPC (`0002_booking_rpcs.sql`): `get_availability(restaurant_id, date, party_size)` genera slot da `opening_hours` (rispettando min/max party size e fermando l'ultimo slot in modo che termini entro la chiusura) e verifica disponibilità tavoli. Le scritture sono divise in due livelli di fiducia: `request_reservation(...)` è la RPC pubblica (anon) usata dalla pagina di prenotazione — il cliente NON può scegliere tavolo, stato o source; il server ri-valida orari di apertura, lead time, orizzonte e party size, calcola `ends_at` dalla durata di default e auto-assegna il tavolo più piccolo libero (con retry su un altro tavolo se il vincolo di esclusione scatta per concorrenza; `table_id` resta null solo se il ristorante non ha ancora tavoli configurati). `create_reservation(...)` è riservata a staff/platform-admin (autorizzazione verificata dentro la funzione, grant solo ad `authenticated`) con pieno controllo su tavolo/stato/source/durata, usata da dashboard e import TheFork. `cancel_reservation(reservation_id, cancellation_token)` autorizza via token (guest) o via sessione staff/admin, e rifiuta prenotazioni già in stato finale. `visit_count` in `guest_directory` viene incrementato da un trigger quando la prenotazione entra in `seated`/`completed` (visita reale), non alla creazione; un trigger `set_updated_at` mantiene `updated_at`. Le impostazioni del ristorante sono modificabili solo da ruoli `owner`/`manager` (policy RLS con `current_staff_role()`).

## Struttura cartelle (parzialmente creata, vedi zip)

```
app/
  (public)/r/[restaurantSlug]/book/page.tsx         # da scrivere: booking pubblico, guest checkout
  (public)/r/[restaurantSlug]/book/confirm/page.tsx # da scrivere: conferma/cancellazione via token
  admin/...                                          # da scrivere: dashboard staff (scope da sessione, no restaurantId in URL)
  admin/reservations/import/page.tsx                 # da scrivere: upload PDF TheFork + anteprima
  platform/restaurants/new/...                        # da scrivere: onboarding nuovo ristorante
  api/v1/restaurants/[restaurantId]/{availability,bookings,bookings/[id]/cancel}/route.ts  # da scrivere
  api/admin/imports/thefork/route.ts                  # da scrivere: parsing PDF
  auth/callback/route.ts                              # da scrivere: solo login staff/platform-admin (magic link)
lib/
  supabase/{client,server,admin}.ts   # FATTO
  auth/session.ts                     # FATTO (getCurrentUser, getIsPlatformAdmin, getStaffProfile)
middleware.ts                          # FATTO (redirect a /admin/login, /platform/login se non autenticato)
supabase/migrations/0001_*.sql, 0002_*.sql  # FATTO
```

## Stato di avanzamento per fase

- **Fase 0 (scaffold)** — ✅ COMPLETATA: Next.js App Router + TypeScript + Tailwind scaffoldato, dipendenze installate (`@supabase/supabase-js`, `@supabase/ssr`, `zod`, `date-fns`, `resend`, `pdf-parse`), `lib/supabase/{client,server,admin}.ts`, `lib/auth/session.ts`, `middleware.ts`, `.env.example`, home page placeholder aggiornata.
- **Fase 1 (schema + RPC)** — ✅ COMPLETATA E DEPLOYATA: le migrazioni `0001_multi_tenant_schema.sql`, `0002_booking_rpcs.sql` e `0003_security_hardening.sql` sono applicate al progetto Supabase **`restaurant-crm`** (ref `ecptncxpmzrowjwruxbq`, org del nuovo account, regione `eu-central-1`, URL `https://ecptncxpmzrowjwruxbq.supabase.co`). Il frontend è deployato in production su Vercel (team "CRM Completo", progetto `restaurant-crm`, alias `restaurant-crm-alpha.vercel.app`). La `SUPABASE_SERVICE_ROLE_KEY` NON è ancora configurata su Vercel (serve per l'onboarding via invito email): copiarla dal dashboard Supabase → Settings → API nelle env di Vercel.
- **Fase 1 (onboarding + booking pubblico)** — ⏳ DA FARE: `/platform/restaurants/new` (invito owner via `supabase.auth.admin.inviteUserByEmail`, service-role client), `/r/[slug]/book` pagina pubblica.
- **Fase 2 (dashboard admin)** — ⏳ DA FARE: vista prenotazioni per stato, CRUD tavoli/sezioni, scheda cliente, impostazioni link Google/Facebook/Instagram.
- **Fase 2 (import TheFork)** — ⏳ DA FARE: upload PDF, parser deterministico (vedi formato analizzato sopra), anteprima/revisione, commit via `create_reservation`.
- **Fase 3 (prefill Google/Meta)** — ⏳ DA FARE.
- **Fase 4 (doc collegamento + Partner Interest Form)** — ⏳ DA FARE.

## Prossimi passi consigliati nella nuova sessione

1. Creare/clonare il nuovo repo GitHub (nuovo account) e scompattare `restaurant-crm-code.zip` al suo interno (contiene tutto il codice già scritto: `app/`, `lib/`, `supabase/migrations/`, `middleware.ts`, config varie).
2. `npm install` per reinstallare `node_modules` (non incluso nello zip).
3. Creare un nuovo progetto Supabase (nel nuovo account, senza il limite di 2 progetti raggiunto) e applicare le due migrazioni SQL con `apply_migration` (o CLI Supabase).
4. Compilare `.env.local` da `.env.example` con le chiavi del nuovo progetto Supabase.
5. Riprendere dalla Fase 1 rimanente (onboarding + booking pubblico) seguendo le fasi sopra elencate.
6. Se serve ri-analizzare il formato PDF di TheFork per tarare il parser, l'utente ha un export reale (ristorante "Benthos Porto Rotondo") — la struttura tabellare è descritta in dettaglio sopra, ma ri-caricare il PDF nella nuova sessione aiuta a verificare i dettagli di formattazione durante l'implementazione del parser.

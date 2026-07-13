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
- **Fase 1 (schema + RPC)** — ✅ COMPLETATA E DEPLOYATA: migrazioni `0001`–`0006` applicate al progetto Supabase **`restaurant-crm`** (ref `ecptncxpmzrowjwruxbq`, regione `eu-central-1`, URL `https://ecptncxpmzrowjwruxbq.supabase.co`). `0004`/`0005` aggiungono due nuove RPC pubbliche (`get_restaurant_public`, `get_reservation_for_management`) necessarie alle pagine sotto. `0006` è hardening difensivo (grant esplicito, non un fix di un bug live — verificato via `has_function_privilege` sul progetto reale prima e dopo). Il frontend in production su Vercel ha ora anche `SUPABASE_SERVICE_ROLE_KEY` configurata (serve per l'invito owner).
- **Fase 1 (booking pubblico)** — ✅ COMPLETATA (sul branch `claude/new-project-feedback-xw4022`, non ancora mergiata su `main`/produzione): `/r/[slug]/book` (server component + `BookingForm` client, chiama `get_availability`/`request_reservation`, nessuna scelta tavolo per il cliente) e `/r/[slug]/book/confirm/[id]?token=...` (lookup e cancellazione via `cancellation_token`).
- **Fase 1 (onboarding)** — ✅ COMPLETATA (stesso branch): `/platform/login` e `/admin/login` (magic link via `signInWithOtp`), `/auth/callback` (route handler condiviso, `exchangeCodeForSession`), `/platform/restaurants/new` (crea ristorante + invita owner via `inviteUserByEmail` col client service-role + assegna `staff_profiles.role='owner'`, autorizzazione ri-verificata dentro la server action).
- **Fase 2 (dashboard admin / "libro visite")** — ✅ COMPLETATA in stile Restoo (modellata sui 29 screenshot forniti dall'utente, PDF "Benthos x Crunch"): layout con menu hamburger (Libro visite / Clienti / Sale e tavoli / Impostazioni / Esci + logout), vista giornaliera con navigazione data e pulsante "Oggi", selettore servizio Pranzo/Cena derivato da `opening_hours`, tab per sezione sala, gruppi di stato collassabili con contatori prenotazioni/coperti, card con orario-nome-pax-tavolo-fonte e azioni rapide di stato; nuova prenotazione manuale con ricerca cliente nel database (suggerimenti da `guest_directory`, migrazione `0007` aggiunge `guest_name` con backfill); dettaglio prenotazione con scheda cliente (prenotazioni/visite/cancellazioni/no-show), storico, cambio tavolo (con messaggio dedicato se il tavolo è occupato — vincolo di esclusione) e note private; pagina Clienti con ricerca; CRUD Sale e tavoli (attiva/disattiva); Impostazioni (nome/telefono/indirizzo/link GBP-FB-IG, salvataggio riservato a owner/manager via RLS, mostra il link pubblico di prenotazione da collegare ai social). Nuovi helper `lib/tz.ts` (conversione fuso a due passaggi, testata CEST/CET) e `lib/services.ts`. Fuori scope e rimandati: piantina grafica, campagne marketing, recensioni, reports, inbox/in sospeso, utenti multipli con permessi granulari.
- **Fase 2 (import TheFork)** — ⏳ DELIBERATAMENTE NON INIZIATA: scrivere il parser PDF senza il file reale (caricato in una sessione precedente, non disponibile in questa) rischiava mappature sbagliate non verificabili qui. Da fare ricaricando il PDF di esempio.
- **Fase 3 (prefill Google/Meta)** — ⏳ DA FARE.
- **Fase 4 (doc collegamento + Partner Interest Form)** — ⏳ DA FARE.

## Stato produzione (fine sessione 13/07 — TUTTO LIVE E VERIFICATO)

- **URL stabili di produzione** (branch `main`, deploy automatico da Git):
  - Prenotazione pubblica: `https://restaurant-crm-alpha.vercel.app/r/demo/book` (verificata 200, form funzionante)
  - Gestionale staff: `https://restaurant-crm-alpha.vercel.app/admin/login` (verificata 200, form email+password)
  - Platform admin: `https://restaurant-crm-alpha.vercel.app/platform/login`
- **Login con password** è il metodo primario (aggiunto perché i magic link dipendono dalla configurazione Auth URL di Supabase, che risulta ancora ferma a localhost lato server nonostante i tentativi di modifica — vedi sotto). L'utente ha un account owner sul ristorante demo con password comunicata in chat.
- **Config client pubblica committata** in `.env.production` (URL Supabase + anon key, pubbliche per design): ogni build Vercel è autosufficiente, le env del dashboard restano solo per i segreti e hanno comunque precedenza.
- **Cose rimaste da sistemare nel dashboard** (non bloccanti):
  1. `SUPABASE_SERVICE_ROLE_KEY` su Vercel va spuntata anche per l'ambiente Production (oggi probabilmente solo Preview) — serve SOLO per l'invito email dei nuovi owner da `/platform/restaurants/new`.
  2. Supabase → Authentication → URL Configuration: Site URL e Redirect URLs risultano ancora `localhost` lato server (i log di GoTrue ripiegano su localhost anche con redirect corretti in ingresso). Da sistemare solo se si vogliono usare i magic link / gli inviti email; il login password non ne dipende.

## Nota per la revisione (sessione del 13/07, effort ridotto su Sonnet 5)

Tutto il lavoro sopra (Fasi 1 e 2 base) è stato fatto con l'utente offline, quindi **non è stato mergiato su `main`** e **non è stato deployato in produzione** — resta sul branch `claude/new-project-feedback-xw4022`, pushato e pronto per la revisione. Motivo: questo sandbox non può raggiungere `supabase.co`/`vercel.app` direttamente (policy di rete dell'organizzazione blocca le richieste HTTP dirette da Bash/Node, solo i tool MCP dedicati Supabase/Vercel passano), quindi non potevo verificare il comportamento live dopo un eventuale deploy. La verifica è stata fatta con: build/typecheck/lint Next.js puliti ad ogni step, e test funzionali approfonditi di RPC/RLS su un Postgres 16 locale che replica lo schema reale (incluse simulazioni di sessioni `anon`/`authenticated` con JWT finti, isolamento multi-tenant tra ristoranti, concorrenza ottimistica sui cambi di stato).

Un bug reale è stato trovato e corretto durante questo lavoro: la migrazione `0003` revocava `EXECUTE` su alcune funzioni helper RLS da `public, anon`, il che nel test locale toglieva l'accesso anche ad `authenticated` (ereditato solo tramite `PUBLIC`). Verificato poi che sul progetto Supabase reale `authenticated` aveva già il privilegio tramite i default privilege di Supabase (nessun bug live), ma `0006` lo rende comunque esplicito.

Nota minor: nel commit "Add magic-link auth..." un backtick nel messaggio è stato interpretato dalla shell come comando, per cui una riga del messaggio di quel commit è leggermente corrotta (contenuto del codice non toccato). Non l'ho corretta con un amend per non riscrivere history già pushata senza permesso.

C'è anche un ristorante demo già seedato sul progetto Supabase reale (slug `demo`, 2 tavoli) per poter provare subito `/r/demo/book` una volta deployato.

## Prossimi passi consigliati

1. Rivedere il diff del branch `claude/new-project-feedback-xw4022` (9 commit sopra `main`).
2. Se ok, mergiare su `main` per far scattare il deploy automatico Vercel, poi verificare live `/r/demo/book`, il flusso onboarding (`/platform/login` con l'email platform admin) e la dashboard `/admin`.
3. Verificare in Supabase Dashboard → Authentication → URL Configuration che i redirect URL `https://<dominio>/auth/callback` siano nella allow-list (altrimenti `signInWithOtp`/`inviteUserByEmail` falliscono in produzione anche se il codice è corretto).
4. Fase 2 import TheFork: ricaricare il PDF di esempio ("Benthos Porto Rotondo") per implementare il parser con dati reali.
5. Fase 2 rimanente: CRUD tavoli/sezioni, scheda cliente/guest_directory, impostazioni link social.

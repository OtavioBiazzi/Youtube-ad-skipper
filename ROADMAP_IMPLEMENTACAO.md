# Roadmap de implementacao

Data: 2026-05-10

Projeto: YouTube Extension / Youtube-ad-skipper

Documento base: `PLANO_DE_IMPLEMENTACAO.md`

## Objetivo

Transformar a extensao em um projeto mais estavel, leve e facil de manter, corrigindo primeiro os bugs que afetam o uso real do YouTube e depois refatorando a arquitetura para permitir novas features com menos risco.

Prioridade absoluta:

1. Corrigir o player pausando sozinho.
2. Corrigir o miniplayer/player ficando abaixo dos comentarios.
3. Otimizar o runtime para reduzir trabalho repetitivo no DOM.
4. Unificar configuracoes para evitar divergencia entre popup, options e content.
5. Modularizar `src/content.ts` e `src/options.ts`.

## Regras de execucao

- Nao misturar refatoracao grande com mudanca de comportamento.
- Trabalhar em etapas pequenas e testaveis.
- Rodar `npm run check` depois de cada etapa relevante.
- Rodar build apenas quando a etapa pedir sincronizacao de bundles.
- Nao apagar alteracoes locais existentes sem confirmacao.
- Toda correcao de bug precisa ter criterio manual de verificacao.
- Recursos instaveis devem ser marcados como experimentais ou desativados por padrao.

## Estado inicial

Arquivos ja modificados antes deste roadmap:

- `options.css`
- `options.html`
- `src/background.ts`
- `src/content.ts`
- `src/options.ts`
- `src/override.ts`

Arquivos de planejamento adicionados:

- `PLANO_DE_IMPLEMENTACAO.md`
- `ROADMAP_IMPLEMENTACAO.md`

## Fase 0: baseline e seguranca do trabalho

Objetivo: garantir que qualquer mudanca futura seja rastreavel e reversivel.

Tarefas:

- [ ] Revisar diff atual antes de mexer no codigo.
- [x] Rodar `npm run check`.
- [x] Rodar `node scripts/verify-extension.mjs`.
- [x] Decidir quando rodar `npm run build`, porque ele sobrescreve bundles na raiz e em `dist/`.
- [x] Criar uma lista de arquivos gerados e arquivos fonte.
- [x] Definir se os bundles da raiz continuam versionados ou se o release usara apenas `dist/`.

Arquivos provaveis:

- `package.json`
- `scripts/build-extension.mjs`
- `scripts/verify-extension.mjs`
- `.gitignore`
- `README.md`

Criterio de aceite:

- O projeto passa no TypeScript.
- Sabemos exatamente quais arquivos sao fonte e quais sao gerados.
- Nenhuma alteracao local existente foi perdida.

## Fase 1: bugs criticos do player

Objetivo: corrigir os problemas que atrapalham assistir videos.

### 1.1 Player pausando sozinho

Sintoma:

- O YouTube pausa sozinho em momentos aleatorios.

Hipoteses:

- `autoplayBlockBackground` ou `autoplayBlockForeground` pausando video em falso positivo.
- `pauseBackgroundTabs` pausando a aba errada.
- `autoplayDisableAll` ou `autoplayStopPreload` interferindo em video normal.
- `hasRecentPlaybackIntent()` com janela curta demais.
- `getAdPlaying()` detectando anuncio onde nao existe.
- `cleanupRuntimeState()` ou restore de playback rodando fora de hora.

Tarefas:

- [x] Mapear todos os lugares que chamam `pauseVideo()`.
- [x] Mapear todos os lugares que chamam `cleanupRuntimeState()`.
- [x] Adicionar logger interno controlado por flag, sem poluir console por padrao.
- [x] Registrar motivo de cada pausa feita pela extensao.
- [x] Registrar estado: `document.hidden`, URL, video key, ad active, ad playing, user intent recente.
- [x] Ajustar regras para nunca pausar video em primeiro plano quando houver intencao recente do usuario.
- [x] Revisar `pauseBackgroundTabs` para nao pausar a propria aba ativa.
- [x] Revisar transicoes de anuncio para nao pausar video normal ao sair do ad.

Arquivos provaveis:

- `src/content.ts`
- futuro: `src/content/player/autoplay.ts`
- futuro: `src/shared/logger.ts`

Criterio de aceite:

- Video normal nao pausa sozinho em aba ativa.
- Playlist nao pausa indevidamente.
- Video em comentarios nao pausa sozinho.
- Live nao pausa indevidamente.
- Se a extensao pausar algo, o log de debug mostra o motivo.

### 1.2 Miniplayer abaixo dos comentarios

Sintoma:

- Ao descer para ler comentarios, o player/miniplayer pode ficar abaixo dos comentarios ou em posicao ruim.

Hipoteses:

- `getPlayerAnchor()` escolhe container errado.
- `shouldUseMiniplayer()` depende de uma regra fragil de scroll/rect.
- O CSS aplica `position: fixed` no elemento errado.
- `z-index` e stacking context do YouTube vencem o miniplayer.
- Scroll/resize nao recalcula no momento certo.

Tarefas:

- [ ] Mapear DOM real usado em watch page normal, theater mode e comentarios.
- [x] Revisar `getPlayerAnchor()`.
- [x] Revisar `buildMiniplayerCss()`.
- [x] Garantir `position: fixed` no elemento certo.
- [x] Garantir `z-index` suficiente sem cobrir popup, menu do player ou PiP.
- [x] Usar `requestAnimationFrame` ou debounce no scroll.
- [x] Recalcular miniplayer em `yt-navigate-finish`, scroll, resize e troca de video.
- [ ] Criar modo debug visual opcional para mostrar a ancora escolhida.

Arquivos provaveis:

- `src/content.ts`
- futuro: `src/content/player/miniplayer.ts`
- futuro: `src/content/dom.ts`

Criterio de aceite:

- Ao descer para comentarios, o player fica visivel e acima da area de comentarios.
- Ao voltar para o topo, o player retorna ao layout normal.
- Nao ha duplicacao de player, toolbar ou estilos.
- Funciona em watch page normal e playlist.

## Fase 2: otimizacao do runtime

Objetivo: reduzir CPU, queries de DOM e efeitos colaterais.

Problemas atuais:

- `mainLoop` roda a cada 500ms.
- O loop chama varias tarefas de layout, CSS, player, toolbar e ad detection.
- Existem varios observers/listeners espalhados.
- Muitas queries amplas rodam repetidamente.

Tarefas:

- [x] Medir duracao do `mainLoop` em modo debug.
- [x] Separar tarefas por frequencia:
  - tempo real: ad skipper
  - eventos de video: play, pause, timeupdate, ratechange
  - eventos de pagina: `yt-navigate-finish`
  - eventos visuais: scroll, resize
  - eventos de storage: mudanca de configuracao
- [x] Debounce de `applyAppearanceFilters`.
- [x] Debounce de `updatePlayerToolbar`.
- [x] Debounce de `updateMiniplayer`.
- [x] Evitar reconstruir CSS quando assinatura nao mudou.
- [x] Evitar reconstruir toolbar quando assinatura nao mudou.
- [x] Reduzir `querySelectorAll` em loops quentes.
- [x] Garantir cleanup de observers ao trocar de video.

Arquivos provaveis:

- `src/content.ts`
- futuro: `src/content/scheduler.ts`
- futuro: `src/content/appearance/*`
- futuro: `src/content/player/*`

Criterio de aceite:

- `mainLoop` fica menor e com menos responsabilidades.
- Scroll em comentarios fica fluido.
- Toolbar e miniplayer nao piscam nem duplicam.
- Uma aba aberta por 10 minutos nao acumula observers duplicados.

## Fase 3: schema unico de configuracoes

Objetivo: uma unica fonte de verdade para defaults, tipos, normalizacao e migracao.

Problema atual:

- Defaults aparecem em `src/content.ts`, `src/options.ts`, `src/popup.ts`, `PLAYER_DEFAULTS_PROFILE` e `PLANNED_DEFAULTS`.

Tarefas:

- [x] Criar `src/shared/settings.ts`.
- [x] Criar tipo `ExtensionSettings`.
- [x] Criar `DEFAULT_SETTINGS`.
- [x] Criar `SETTINGS_VERSION`.
- [x] Criar `normalizeSettings(raw)`.
- [x] Criar `migrateSettings(raw)`.
- [x] Criar lista de chaves permitidas para import/export.
- [x] Migrar `src/content.ts` para usar schema compartilhado.
- [x] Migrar `src/options.ts` para usar schema compartilhado.
- [x] Migrar `src/popup.ts` para usar schema compartilhado.
- [x] Remover defaults duplicados.

Notas da etapa:

- `src/options.ts` usa a lista compartilhada de chaves para import/export.
- `DEFAULT_SETTINGS` e a unica fonte de defaults; a antiga camada `PLANNED_DEFAULTS` foi removida.
- A normalizacao descarta chaves desconhecidas e valores com tipo invalido.

Arquivos provaveis:

- `src/shared/settings.ts`
- `src/content.ts`
- `src/options.ts`
- `src/popup.ts`

Criterio de aceite:

- Reset usa o mesmo default que o content script.
- Import/export aceita apenas chaves conhecidas.
- Popup, options e content concordam sobre todos os nomes de configuracao.
- `npm run check` passa.

## Fase 4: build, package e CI

Objetivo: evitar descompasso entre fonte e bundles.

Tarefas:

- [x] Adicionar script `clean`.
- [x] Adicionar script `package`.
- [x] Gerar ZIP da extensao a partir de `dist/`.
- [x] Validar manifest dentro do ZIP.
- [x] Criar workflow de CI.
- [x] CI deve rodar:
  - `npm ci`
  - `npm run check`
  - `npm run build`
  - `node scripts/verify-extension.mjs`
- [x] Decidir se `content.js`, `options.js`, `popup.js`, `background.js`, `override.js` continuam versionados.

Decisao atual:

- Manter bundles da raiz versionados por enquanto, porque `manifest.json` na raiz referencia esses arquivos diretamente para carregamento local.
- Usar `dist/` como artefato de release e base do ZIP gerado por `npm run package`.
- Reavaliar depois se vale migrar para fluxo `dist/`-only.

Arquivos provaveis:

- `package.json`
- `scripts/build-extension.mjs`
- `scripts/verify-extension.mjs`
- `.github/workflows/ci.yml`
- `README.md`

Criterio de aceite:

- Build limpo gera extensao carregavel.
- CI falha se manifest referencia arquivo ausente.
- Release pode ser gerado sem passos manuais confusos.

## Fase 5: modularizacao de `src/content.ts`

Objetivo: reduzir o monolito sem alterar comportamento.

Ordem recomendada:

- [ ] Extrair tipos e estado.
- [ ] Extrair helpers de DOM e YouTube.
- [ ] Extrair normalizadores.
- [x] Extrair whitelist/blacklist.
- [x] Extrair shortcuts.
- [x] Extrair ad detection.
- [ ] Extrair skipper.
- [ ] Extrair autoplay.
- [ ] Extrair miniplayer.
- [ ] Extrair toolbar.
- [x] Extrair qualidade.
- [ ] Extrair aparencia/temas.
- [ ] Extrair anti-adblock.
- [ ] Deixar `src/content.ts` ou `src/content/index.ts` apenas como bootstrap/orquestrador.

Estrutura alvo:

```text
src/
  shared/
    settings.ts
    messages.ts
    logger.ts
    storage.ts
  content/
    index.ts
    state.ts
    scheduler.ts
    ad-detection.ts
    skipper.ts
    anti-adblock.ts
    whitelist.ts
    shortcuts.ts
    player/
      autoplay.ts
      miniplayer.ts
      toolbar.ts
      quality.ts
      volume.ts
      pip.ts
    appearance/
      themes.ts
      filters.ts
      cinema.ts
      layout.ts
```

Criterio de aceite:

- Cada extracao passa em `npm run check`.
- Comportamento externo continua igual.
- `src/content.ts` deixa de concentrar tudo.

## Fase 6: seguranca e MAIN world

Objetivo: reduzir risco de spoofing, CSP e conflito com pagina.

Tarefas:

- [x] Criar `src/shared/messages.ts`.
- [x] Adicionar token de sessao nas mensagens `window.postMessage`.
- [x] Exigir token em `src/override.ts`.
- [x] Criar feature flags para overrides globais.
- [x] Tornar override idempotente.
- [ ] Revisar `JSON.parse` override.
- [ ] Revisar `Response.prototype.json` override.
- [ ] Revisar `HTMLElement.prototype.addEventListener` override.
- [x] Remover `new Function` e o script customizado da UI.
- [x] Marcar script customizado como experimental se permanecer.

Arquivos provaveis:

- `src/override.ts`
- `src/content.ts`
- `src/shared/messages.ts`
- `src/options.ts`
- `options.html`

Criterio de aceite:

- A pagina nao consegue disparar comandos da extensao sem token.
- Overrides nao sao instalados duas vezes.
- Script customizado tem decisao clara: seguro, experimental ou removido.

## Fase 7: testes

Objetivo: criar protecao contra regressao.

Tarefas:

- [x] Adicionar `vitest`.
- [x] Testar normalizacao de settings.
- [x] Testar migracoes.
- [x] Testar whitelist/blacklist.
- [x] Testar shortcuts.
- [x] Testar escolha de qualidade.
- [x] Testar calculo de delay/speed.
- [x] Testar parsing de video id.
- [x] Adicionar smoke test para build/manifest.
- [x] Planejar smoke test com extensao carregada em Chromium.

Arquivos provaveis:

- `package.json`
- `src/**/*.test.ts`
- `tests/`

Criterio de aceite:

- `npm test` passa.
- Funcoes puras principais tem cobertura.
- Mudancas em settings quebram teste se criarem divergencia.

## Fase 8: polimento de UI e produto

Objetivo: deixar a extensao mais clara para usuario final.

Tarefas:

- [ ] Separar recursos estaveis de experimentais na UI.
- [ ] Criar preset seguro, equilibrado e agressivo.
- [ ] Melhorar mensagens de "precisa recarregar".
- [ ] Adicionar painel de diagnostico.
- [ ] Melhorar acessibilidade de popup/options.
- [ ] Corrigir textos sem acento quando fizer sentido manter UTF-8 corretamente.
- [x] Criar `CHANGELOG.md`.
- [x] Criar `PRIVACY.md`.
- [x] Criar `LICENSE`.
- [x] Atualizar README com instalacao via release ZIP.

Arquivos provaveis:

- `options.html`
- `options.css`
- `src/options.ts`
- `popup.html`
- `popup.css`
- `src/popup.ts`
- `README.md`
- `CHANGELOG.md`
- `PRIVACY.md`
- `LICENSE`

Criterio de aceite:

- Usuario entende quais recursos sao seguros e quais sao experimentais.
- Popup e options ficam coerentes.
- Documentacao acompanha o comportamento real.

## Checklist manual de QA

Rodar depois de fases que mexem no runtime:

- [ ] Abrir video normal e assistir por 10 minutos sem pausa indevida.
- [ ] Rolar ate comentarios e confirmar miniplayer visivel.
- [ ] Voltar ao topo e confirmar player normal.
- [ ] Abrir playlist e confirmar que autoplay/pausa nao quebra fluxo.
- [ ] Abrir live e confirmar que a extensao nao pausa indevidamente.
- [ ] Abrir Shorts com conversao ligada/desligada.
- [ ] Testar anuncio pulavel.
- [ ] Testar anuncio sem botao de pular.
- [ ] Testar popup.
- [ ] Testar pagina de options.
- [ ] Testar PiP.
- [ ] Testar toolbar.
- [ ] Testar qualidade.
- [ ] Testar backup/export/import.

## Criterio geral de pronto

Uma etapa so termina quando:

- `npm run check` passa.
- Build passa quando a etapa mexer em artefatos.
- Manifest verify passa.
- Nao ha regressao manual nos cenarios principais.
- O comportamento alterado esta documentado.
- O plano foi atualizado se alguma decisao mudar.

## Ordem imediata recomendada

1. Fase 0: baseline.
2. Fase 1.1: pausa espontanea.
3. Fase 1.2: miniplayer/comentarios.
4. Fase 2: otimizacao do runtime.
5. Fase 3: schema unico de settings.
6. Fase 4: build/package/CI.
7. Fase 5: modularizacao.

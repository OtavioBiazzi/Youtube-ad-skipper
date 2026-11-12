# Changelog

Todas as mudancas relevantes deste projeto serao registradas aqui.

## 5.1.0 — Estabilidade

### Corrigido

- O vídeo não pausa mais sozinho: a extensão usava o primeiro `<video>` da página (às vezes a prévia de uma miniatura) e pausava o player principal por engano.
- O skip de anúncio não avança mais o vídeo de verdade: as ações no contexto da página conferem se o anúncio ainda está passando antes de avançar ou acelerar.
- O bloqueio de autoplay só age no evento de play do vídeo principal, no máximo uma vez por vídeo e nunca logo depois de um anúncio. Retomar pelo fone ou pelos controles de mídia do sistema volta a funcionar.
- O bloqueio de autoplay em abas de fundo e a ordenação automática de comentários agora vêm desligados (migração que preserva as demais escolhas).
- O miniplayer não pisca mais ao descer para os comentários: tem margem de entrada/saída, reserva o espaço do player e funciona no modo teatro.
- Os menus do YouTube (como "Classificar comentários") abrem por cima do miniplayer.
- Tela preta em lives com filtros de codec ativos.
- O modo teatro automático não dessincroniza mais o player; o modo cinema não redimensiona mais o vídeo.
- Depois de remover o aviso de bloqueador de anúncios, o vídeo pausado pelo YouTube volta a tocar.

### Adicionado

- Continuar de onde parou (opcional): lembra a posição de vídeos com mais de 3 minutos.
- Botão para fechar o miniplayer até o player voltar a aparecer na tela.
- Diagnóstico de reprodução no Control Center: lista toda pausa/avanço feito pela extensão e o motivo.
- Atalhos rápidos de Miniplayer e Continuar no popup.

### Melhorado

- Carregamento de configurações unificado (cerca de 330 linhas duplicadas a menos); contadores sincronizados entre abas.
- Sem `MutationObserver` no documento inteiro para detectar navegação; ganchos globais de `JSON.parse` só quando há filtro de codec.
- Control Center: acentuação revisada, textos técnicos trocados por descrições claras, cabeçalho e menu fixos sem sobreposição, seção atual destacada no menu.

## 5.0.0

### Adicionado

- Busca instantanea no Control Center, com atalho `/` e estado sem resultados.
- Perfis Seguro, Equilibrado, Turbo e Foco para aplicar grupos coerentes de configuracoes.
- Temas de um clique Graphite Red, Deep Dark, Slate Blue e Warm Cinema.
- Deteccao testavel de avisos de adblock em portugues e ingles.
- Plano completo de analise e implementacao em `PLANO_DE_IMPLEMENTACAO.md`.
- Roadmap executavel em `ROADMAP_IMPLEMENTACAO.md`.
- Schema compartilhado inicial de configuracoes em `src/shared/settings.ts`.
- Constantes e helpers compartilhados de mensagens em `src/shared/messages.ts`.
- Token de sessao best-effort para mensagens entre content script e MAIN world.
- Testes com Vitest para settings e mensagens compartilhadas.
- Script `npm run clean`.
- Script `npm run package` para gerar ZIP de release a partir de `dist/`.
- Workflow de CI com install, check, test, build, verify e package.
- Estrategia testavel para escolher entre botao nativo, seek limitado e aceleracao.
- Modulo `src/content/adDom.ts` para deteccao de anuncio e controles de skip.

### Corrigido

- Anti-adblock agora remove apenas avisos relacionados a bloqueadores e preserva dialogs, backdrops e promocoes normais do YouTube.
- Titulos de status do popup e da visao geral agora acompanham corretamente o estado pausado.
- Dependencias de build foram atualizadas para remover vulnerabilidades conhecidas no ambiente de desenvolvimento.
- Reduzido risco de o player pausar sozinho por sinais antigos de outras abas.
- Corrigido o layout Cinema + Ultrawide para evitar player pequeno, crop agressivo e overflow em telas largas.
- Removido o atalho de Modo Teatro da barra rápida; o ajuste continua disponível pelas preferências de cinema e atalhos.
- Restore de velocidade agora so roda quando existe velocidade pre-anuncio capturada.
- Miniplayer recebeu ajustes de stacking/z-index para ficar acima da area de comentarios.
- Listeners de video antigos agora sao removidos ao trocar o elemento de video.
- O fallback de skip nao avanca mais o video quando a duracao do anuncio e desconhecida.
- Busca textual pelo botao de pular agora fica restrita ao player do YouTube.

### Melhorado

- `mainLoop` ficou menor e tarefas visuais foram desacopladas por frequencia.
- Toolbar, miniplayer e filtros de video evitam trabalho repetido desnecessario.
- Export/import de configuracoes usa lista compartilhada de chaves conhecidas.
- Popup foi reduzido a um painel compacto de 360 px com telemetria e controles essenciais.
- Observer do botao de pular agora acompanha o player em vez da pagina inteira.
- Configuracoes agora usam um unico objeto de defaults em popup, options, runtime, reset e backup.
- Valores desconhecidos ou com tipo invalido sao descartados ao normalizar configuracoes.

### Removido

- Controles que apenas salvavam valores sem comportamento no runtime: menu customizado de velocidades, tamanho customizado do miniplayer, popup em embeds, preservacao de barras pretas e seletor de idioma incompleto.
- Execucao de script personalizado por `new Function`, incompativel com o hardening esperado de Manifest V3.

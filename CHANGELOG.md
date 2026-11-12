# Changelog

Todas as mudancas relevantes deste projeto serao registradas aqui.

## 5.2.4

- Números legíveis: versão, contadores e tempos usam uma fonte normal; a fonte pixel fica só nos títulos.
- A extensão não briga mais com o YouTube pela altura do menu da engrenagem. A leve "piscada" que ainda aparece ao ligar/desligar uma opção é do próprio YouTube e acontece mesmo sem a extensão.

## 5.2.3

- Contagem de anúncios pulados corrigida: um mesmo anúncio podia ser contado duas vezes (quando o anúncio terminava, o vídeo voltava ao início enquanto o YouTube ainda marcava o player como em anúncio). Agora cada contagem exige um anúncio de pelo menos 0,8 s (ou um clique real no Pular) e 1,2 s entre contagens.
- Cada anúncio contado aparece em Avançado → Diagnóstico de reprodução, com a hora e o motivo.

## 5.2.2

- Menus do YouTube (Legendas, Qualidade, Timer…) não ficam mais com um espaço vazio no topo.
- Engrenagem: Repetir vídeo e Filtros de imagem logo abaixo dos liga/desliga do YouTube.
- Modo cinema removido do player e da engrenagem; a prévia desenhada no Control Center também saiu.
- Painel de filtros com o mesmo cabeçalho "‹ voltar" e a mesma animação dos menus do YouTube; o voltar reabre a engrenagem.
- Ícone de salvar frame no estilo contornado, como os do YouTube.
- Ao escolher 3x no menu de velocidade, o número no topo do painel também muda.

## 5.2.1

- Botão "Nova versão disponível" no popup: aparece quando há uma release mais nova no GitHub e leva direto ao download.

## 5.2.0 — Player mais integrado ao YouTube

### Adicionado

- **Menu de velocidade do YouTube até 10x:** a barrinha vai até 10x, o − e o + andam de 0,25 em 0,25 acima de 2x, e o chip "3,0" (só para Premium) funciona com a extensão. Velocidades acima de 2x se mantêm mesmo quando o YouTube tenta voltar para 2x.
- **Botão de atraso ao lado do "AO VIVO" do YouTube:** mostra a latência real da live e abre um menu no estilo do player com: Tirar atraso, Modo (Equilibrado ~4s / Perto ~3s / Extremo ~2s), Velocidade máxima, Pular para o ao vivo após 30 s, Ir para o ao vivo agora, além de atraso, buffer e velocidade atuais.

### Mudado

- **Lives:** o "tirar atraso" foi reescrito e vem **desligado por padrão**. Agora usa a latência real e a saúde do buffer informadas pelo próprio player do YouTube, aplica a velocidade pela API do player (que é o que funciona nas lives atuais), nunca acelera com o buffer baixo, tem uma margem para não ficar liga/desliga e não mexe quando você está assistindo atrás (DVR).
- **Engrenagem:** Repetir vídeo e Modo cinema ficam junto dos outros liga/desliga, e Filtros de imagem fica antes dos submenus do YouTube.
- **Ctrl + roda:** passa a andar de 0,25 em 0,25, como o YouTube (antes era 0,02).
- O "1x" da barra tem um peso de fonte mais leve.
- **Popup:** os três chips (Silenciar, Contagem, Pesquisas) têm o mesmo tamanho.
- **Control Center:** texto maior e com mais contraste, fonte pixel também nos títulos dos cards, e telas largas/ultrawide usam o espaço com mais colunas.

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

- Botões dentro da barra do próprio player (velocidade, repetir, filtros, frame, boost, cinema, janela, PiP), com ícones no padrão do YouTube e uma divisória separando dos botões nativos. Opção de deixá-los dentro do player, numa barra abaixo do vídeo, nos dois ou escondidos.
- Itens dentro do menu de configurações (engrenagem) do próprio YouTube: Filtros de imagem, Repetir vídeo, Modo cinema e, em lives, Tirar atraso. A barra fica com as ações rápidas: velocidade, frame, volume boost, janela e PiP.
- "Termina às" ao lado do tempo do vídeo (opcional), considerando a velocidade.
- Painel de filtros dentro do player, com o mesmo visual do menu de configurações do YouTube: predefinições (Vívido, Cinema, Noite, Clarear, P&B), brilho, contraste, saturação, tom, quente e preto e branco. Os filtros agora valem para todos os vídeos.
- Lives sem atraso: acelera de leve (até 1,25x) enquanto houver atraso acumulado e mostra o atraso no botão "AO VIVO".
- Pesquisas de anúncio ("Pular pesquisa") agora são puladas.
- Continuar de onde parou (opcional): lembra a posição de vídeos com mais de 3 minutos.
- Botão para fechar o miniplayer até o player voltar a aparecer na tela.
- Diagnóstico de reprodução no Control Center: lista toda pausa/avanço feito pela extensão e o motivo.
- Atalhos rápidos de Miniplayer e Continuar no popup.

### Corrigido na auditoria das opções antigas

- Qualidade automática: a extensão falava com o player do lado errado (onde a API do YouTube não existe) e nunca sabia a qualidade atual. Agora a escolha acontece no contexto da página, e "restaurar ao sair da tela cheia" volta a funcionar.
- Todo vídeo era tratado como playlist (o YouTube deixa um painel de playlist vazio na página), o que trocava a qualidade para a de playlists e desligava o bloqueio de autoplay.
- Velocidade padrão não "pegava" porque o YouTube reaplicava a velocidade dele logo depois de carregar o vídeo; não é mais aplicada em lives.
- Volume padrão agora atualiza o volume do próprio YouTube (barra e volume salvo).
- Volume boost podia deixar o vídeo mudo (processador de áudio criado antes de qualquer clique); agora só é criado após interação e é retomado no próximo clique.
- O atalho "Cinema" ativava o modo teatro.
- A rodinha do mouse dentro do painel de filtros ou da engrenagem mudava volume/velocidade.
- O CSS de aparência era reconstruído (com três redimensionamentos) a cada vídeo; seletores de Shorts atualizados.
- Botão flutuante de PiP antigo, duplicado e sem estilo, aposentado (o PiP fica na barra).

### Adicionado

- Pular pesquisas automaticamente (opção, ligada por padrão): pula pesquisas de anúncio e esconde as pesquisas de opinião do YouTube.
- `npm run e2e:audit`: confere no YouTube real qualidade, velocidade, volume, atalhos, rodinha, barra abaixo do vídeo e Shorts.

### Melhorado

- Redesign do popup e do Control Center: fontes embutidas (Pixelify Sans nos títulos, IBM Plex no texto), menu lateral, superfícies retas, sem selos decorativos e textos reescritos.
- O aviso de anúncio no player virou uma pílula no estilo do YouTube que diz o que está acontecendo de verdade ("Pulando em 2s", "Esperando o botão Pular", "Acelerando…").
- Notificação de anúncio pulado e balões de velocidade/volume no estilo do YouTube.

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

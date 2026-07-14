# Privacy

Esta extensao roda localmente no navegador e foi projetada para atuar apenas em paginas do YouTube.

## Dados armazenados

A extensao usa `chrome.storage.local` e, em alguns casos tecnicos, `localStorage` da pagina para guardar preferencias locais, por exemplo:

- estado ligado/desligado;
- configuracoes do skipper;
- lista de canais permitidos/bloqueados;
- preferencias de player, aparencia, qualidade, atalhos e temas;
- contadores locais de anuncios pulados;
- configuracoes tecnicas de codec;
- codigo de script customizado, se o usuario habilitar esse recurso experimental.

## Dados transmitidos

A extensao nao envia dados para servidores proprios do projeto.

Ela interage com paginas do YouTube no navegador do usuario para aplicar configuracoes, detectar anuncios, ajustar player e atualizar a interface. Qualquer comunicacao de rede normal da pagina continua sendo responsabilidade do proprio YouTube/navegador.

## Permissoes

As permissoes principais sao:

- `storage`: salvar configuracoes localmente.
- `*://*.youtube.com/*`: executar a extensao em paginas do YouTube.

## Scripts customizados

O recurso de script customizado executa codigo fornecido pelo proprio usuario. Ele deve ser tratado como experimental e usado apenas com codigo confiavel.

## Remocao de dados

Para remover os dados locais, use o reset da pagina de opcoes ou remova a extensao pelo navegador. O navegador tambem pode limpar dados associados ao site/extensao nas configuracoes de privacidade.

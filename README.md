# YouTube Extension

> Versao atual: **v5.0.0** (pacote revisado e atualizado em 14/07/2026).

> O contador de anuncios evita duplicar o mesmo anuncio quando o YouTube faz rebuffer, troca de stream ou reposiciona o video.

Uma extensão experimental de navegador para reunir **skipper inteligente, controles de player, aparência e recursos avançados do YouTube** em um único painel.

> A base atual ainda preserva o skipper: ela automatiza o processo de clicar no botão "Pular anúncio" do YouTube e prepara a evolução para um control center completo.

<br>

<div align="center">
  <a href="https://github.com/OtavioBiazzi/Youtube-ad-skipper/releases/download/v5.0.0/youtube-extension-v5.0.0.zip">
    <img src="https://img.shields.io/badge/Baixar_Vers%C3%A3o_5.0.0_(.ZIP)-000000?style=for-the-badge&logo=github&logoColor=white" alt="Baixar YouTube Extension 5.0.0" />
  </a>
  <br><br>
  <a href="https://github.com/OtavioBiazzi/Youtube-ad-skipper/releases">Ver todas as versões</a>
</div>

<br>

## ✨ Funcionalidades

| Funcionalidade | Descrição |
|---|---|
| ⏭️ **Pular Automático** | Detecta anúncios e clica no botão de pular automaticamente |
| ⏱️ **Delay Configurável** | Escolha de 1s até 30s antes de pular |
| 🔇 **Mutar Anúncios** | Silencia automaticamente durante o anúncio |
| 🎬 **Overlay Interativo** | Mostra countdown no vídeo com opção de assistir ou pular |
| 👁 **Modo Assistir** | Opção de cancelar o skip e ver o anúncio se quiser |
| 📊 **Estatísticas** | Conta quantos anúncios foram pulados e tempo economizado |
| ⚙️ **Popup de Configuração** | Menu bonito e intuitivo para personalizar tudo |

## 📸 Como funciona

Quando um anúncio aparece no YouTube:

1. A extensão **detecta automaticamente** o anúncio
2. **Muta o vídeo** (se configurado)
3. Mostra um **overlay** no canto do vídeo com countdown
4. Após o delay configurado (ou instantaneamente), **clica no botão de pular**
5. Se não encontrar o botão, **avança o vídeo até o final**
6. **Restaura** o som e a velocidade normal

## 🛠️ Como Baixar e Instalar

### Chrome / Opera GX / Edge / Brave

1. **[Baixe o pacote pronto da versão 5.0.0](https://github.com/OtavioBiazzi/Youtube-ad-skipper/releases/download/v5.0.0/youtube-extension-v5.0.0.zip)**.
2. **Extraia (descompacte)** o arquivo `youtube-extension-v5.0.0.zip` em uma pasta permanente no seu computador.
3. Abra o seu navegador e vá para a página de extensões:
   - Chrome: `chrome://extensions/`
   - Opera GX: `opera://extensions/`
   - Edge: `edge://extensions/`
   - Brave: `brave://extensions/`
4. Ative a opção **"Modo do desenvolvedor"** (geralmente no canto superior direito).
5. Clique no botão **"Carregar sem compactação"** (ou *"Load unpacked"*).
6. Selecione a **pasta extraída que contém o arquivo `manifest.json`**.
7. Pronto! A extensão já está instalada e ativa. ⚡

> Não escolha o arquivo `.zip` diretamente: o navegador precisa da pasta descompactada. Para atualizar, baixe a versão nova, substitua a pasta e clique em **Recarregar** na página de extensões.

## ⚙️ Configurações

Clique no ícone da extensão na barra de ferramentas para acessar o menu:

- **🛡️ Extensão Ativa** — Liga/desliga a extensão
- **⏱️ Tempo para Pular** — Slider de 1s até 30s
- **🔇 Mutar Anúncios** — Silencia durante o anúncio
- **🎬 Mostrar Overlay** — Mostra/oculta o overlay no vídeo
- **⚡ Velocidade dos Anúncios** — Automática e segura até 3x; opções beta liberam velocidade manual ou adaptação agressiva por tempo
- **📊 Estatísticas** — Anúncios pulados e tempo economizado

## 🧑‍💻 Desenvolvimento

### Estrutura do projeto

```
├── manifest.json      # Configuração da extensão (Manifest V3)
├── src/               # Código-fonte TypeScript
├── scripts/           # Build e verificação da extensão
├── content.js         # Build gerado do script principal
├── override.js        # Build gerado do script injetado no MAIN world
├── popup.html         # Interface do menu popup
├── popup.css          # Estilos do popup
├── popup.js           # Build gerado da lógica do popup
├── icon48.png         # Ícone 48x48
└── icon128.png        # Ícone 128x128
```

### Build moderno

O projeto usa **TypeScript + Vite** para gerar os scripts finais da extensão.

```bash
npm install
npm run verify
npm run package
```

- `npm run check` valida os arquivos em `src/` com TypeScript.
- `npm run build` gera os scripts finais na raiz e monta a extensão limpa em `dist/`.
- `npm run verify` roda a checagem TypeScript, build e valida os arquivos referenciados pelo `manifest.json`.
- `npm run package` gera o ZIP de release em `release/` usando os arquivos de `dist/`.

### Como funciona tecnicamente

- **`override.js`** — Injetado no contexto da página (`world: MAIN`) antes dos scripts do YouTube. Faz override do `addEventListener` nos botões de skip para que cliques programáticos sejam aceitos como `isTrusted`.

- **`content.js`** — Roda como content script. Detecta anúncios verificando elementos como `.ytp-ad-visit-advertiser-button`, `.ytp-ad-badge`, e a classe `ad-showing`. Quando detecta um anúncio, agenda o skip baseado no delay configurado.

## 📝 Créditos

Este projeto foi criado por **[OtavioBiazzi](https://github.com/OtavioBiazzi)** com o auxílio de um **agente de IA (Antigravity by Google DeepMind)**.

Inspirado no projeto open-source [yt-ad-autoskipper](https://github.com/squgeim/yt-ad-autoskipper) por [@squgeim](https://github.com/squgeim).

## 📄 Licença

Este projeto é de uso pessoal e educacional. Use por sua própria conta e risco.

Consulte tambem [LICENSE](LICENSE) e [PRIVACY.md](PRIVACY.md).

---

⭐ **Se esta extensão te ajudou, deixe uma estrela no repositório!**

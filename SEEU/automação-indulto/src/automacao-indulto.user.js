// ==UserScript==
// @name         SEEU - Automação Indulto
// @version      1.0
// @namespace    https://github.com/4Vara
// @author       Scheeee
// @description  Fluxo completo Indulto (Salvar + Assinar + Voltar)
// @match        https://seeu.pje.jus.br/seeu/visualizacaoProcesso.do*
// @match        https://seeu.pje.jus.br/seeu/movimentarProcesso.do*
// @match        https://seeu.pje.jus.br/seeu/modeloDocumento/modeloDocumento.do*
// @match        https://seeu.pje.jus.br/seeu/processo/juntarDocumento.do*
// @match        https://seeu.pje.jus.br/seeu/processo.do*
// @match        https://seeu.pje.jus.br/seeu/areaAtuacao.do*
// @match        https://seeu.pje.jus.br/seeu/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * Este script orquestra o fluxo completo de automação do indulto:
 * seleciona modelo e tipo de arquivo, preenche campos, assina e navega entre telas.
 * Os comentários abaixo explicam a estrutura do processo sem modificar o comportamento.
 */

(function () {
  'use strict';

  const STATE_KEY = 'seeuIndultoState_v19_directCall';
  const TEXTO_TIPO_ARQUIVO = 'Ato Ordinatório';
  const TEXTO_BUSCA_MODELO = 'Ato Ordinatório';
  const TEXTO_MODELO_FINAL = '(Leticia Copetti Walter - Analista Judiciário ) - 2 ATO ORDINATÓRIO INDULTO';
  const ID_MODELO_FALLBACK = '663048';

  /**
   * Registra mensagens de log do fluxo de automação do indulto.
   * @param {...any} args Itens a serem exibidos no console.
   */
  const log = (...args) => console.log('[SEEU Indulto]', ...args);

  /**
   * Dispara um clique robusto em um botão, simulando eventos do navegador.
   * @param {HTMLElement} btn Elemento que receberá o clique.
   * @param {Window} [btnWindow] Janela de contexto usada para criar o evento.
   */
  function clickRobusto(btn, btnWindow) {
    log('⚡ Usando clique robusto...');
    try {
      ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((ev) =>
        btn.dispatchEvent(
          new MouseEvent(ev, {
            bubbles: true,
            cancelable: true,
            view: btnWindow || window,
          })
        )
      );
    } catch (e) {
      log('⚠️ Erro na simulação de eventos, tentando .click() simples', e);
      btn.click();
    }
  }

  // --- waitFor com suporte a iframe ---
  /**
   * Aguarda a presença de um elemento na página ou em iframe.
   * @param {string} selector Seletor CSS usado para localizar o elemento.
   * @param {(element: Element, window?: Window) => void} cb Função executada quando o elemento for encontrado.
   * @param {number} [timeout=20000] Tempo máximo de espera em milissegundos.
   */
  function waitFor(selector, cb, timeout = 20000) {
    const start = Date.now();
    const interval = setInterval(() => {
      let el = document.querySelector(selector);
      let elWindow = el ? window : null;
      let frameUrl = null;

      if (!el) {
        const frames = document.querySelectorAll('iframe');
        for (let i = 0; i < frames.length; i++) {
          try {
            const frameDoc = frames[i].contentDocument || frames[i].contentWindow.document;
            if (frameDoc) {
              el = frameDoc.querySelector(selector);
              if (el) {
                elWindow = frames[i].contentWindow;
                frameUrl = frames[i].src;
                break;
              }
            }
          } catch (e) {
            // Cross-origin ignore
          }
        }
      }

      if (el) {
        clearInterval(interval);
        if (frameUrl) {
          log(`✅ Elemento encontrado no iframe com URL: ${frameUrl}`);
        }
        cb(el, elWindow);
      } else if (Date.now() - start > timeout) {
        clearInterval(interval);
        console.error('[SEEU Indulto] Timeout aguardando:', selector);
      }
    }, 300);
  }

  // --- Autocomplete tipo de arquivo ---
  function observarAutocompleteTipoArquivo() {
    return new Promise((resolve) => {
      const container = document.querySelector('#ajaxAuto_descricaoTipoArquivo');
      if (!container) return resolve(false);

      const observer = new MutationObserver(() => {
        const itens = document.querySelectorAll('#ajaxAuto_descricaoTipoArquivo li');
        if (itens.length > 0) {
          const alvo = Array.from(itens).find((i) => i.innerText.includes(TEXTO_TIPO_ARQUIVO));
          if (alvo) {
            observer.disconnect();
            ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((ev) =>
              alvo.dispatchEvent(new MouseEvent(ev, { bubbles: true }))
            );
            document.body.click();
            resolve(true);
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(false); }, 10000);
    });
  }

  // --- Autocomplete modelo ---
  function observarAutocompleteModelo() {
    return new Promise((resolve) => {
      const container = document.querySelector('#ajaxAuto_descricaoModelo');
      if (!container) return resolve(false);

      const observer = new MutationObserver(() => {
        const itens = document.querySelectorAll('#ajaxAuto_descricaoModelo li');
        if (itens.length > 0) {
          let alvo = Array.from(itens).find((i) => i.innerText.includes(TEXTO_MODELO_FINAL));
          if (!alvo) alvo = Array.from(itens).find((i) => i.innerText.includes('INDULTO'));
          if (!alvo) alvo = document.getElementById(ID_MODELO_FALLBACK);

          if (alvo) {
            observer.disconnect();
            ['mouseover', 'mousedown', 'mouseup', 'click'].forEach((ev) =>
              alvo.dispatchEvent(new MouseEvent(ev, { bubbles: true }))
            );
            document.body.click();
            resolve(true);
          }
        }
      });
      observer.observe(container, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); resolve(false); }, 10000);
    });
  }

  // --- Preencher campos com digitação fake ---
  /**
   * Preenche um campo com texto simulando digitação e dispara o autocomplete.
   * @param {string} selector Seletor CSS do campo a ser preenchido.
   * @param {string} texto Texto a ser digitado.
   * @param {boolean} [isModelo=false] Indica se o campo é relacionado ao modelo.
   * @returns {Promise<boolean>} Indica se o autocomplete foi concluído com sucesso.
   */
  async function preencherCampo(selector, texto, isModelo = false) {
    const campo = document.querySelector(selector);
    if (!campo) return false;

    campo.focus();
    campo.value = '';
    campo.dispatchEvent(new Event('input', { bubbles: true }));

    for (const ch of texto) {
      campo.value += ch;
      campo.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((r) => setTimeout(r, 20));
    }

    campo.focus();
    campo.dispatchEvent(new Event('keydown', { bubbles: true }));
    campo.dispatchEvent(new Event('keyup', { bubbles: true }));

    let sucesso;
    if (isModelo) sucesso = await observarAutocompleteModelo();
    else sucesso = await observarAutocompleteTipoArquivo();

    campo.blur();
    document.body.click();

    if (typeof window.ajaxAutoCompleteOnBlurInput === 'function') {
      try {
        if (isModelo) window.ajaxAutoCompleteOnBlurInput('codModelo', 'descricaoModelo');
        else window.ajaxAutoCompleteOnBlurInput('codTipoArquivo', 'descricaoTipoArquivo');
      } catch (e) { /* ignore */ }
    }
    return sucesso;
  }

  // --- STATE ---
  /**
   * Atualiza o estado de execução no armazenamento da sessão.
   * @param {string} s Novo estado a ser salvo.
   */
  function goToState(s) {
    sessionStorage.setItem(STATE_KEY, s);
    log('➡️ Estado definido:', s);
  }
  function getState() {
    return sessionStorage.getItem(STATE_KEY);
  }

  // --- ROTEAMENTO ---
  const path = location.pathname;
  const state = getState();
  log('📍 Path:', path, '| Estado:', state || 'nenhum');

  if (state === 'aguardandoVoltar') {
    paginaAguardarVoltar();
  }
  else if (path.includes('/visualizacaoProcesso.do')) {
    if (state === 'voltandoAba') paginaVoltarParaAba();
    else paginaVisualizacao();
  }
  else if (path.includes('/movimentarProcesso.do') && state === 'active') {
    paginaMovimentar();
  }
  else if ((path.includes('/modeloDocumento/modeloDocumento.do') || path.includes('/areaAtuacao.do')) && state === 'modelo') {
    paginaModeloDocumento();
  }
  else if (path.includes('/processo/juntarDocumento.do') || path.includes('/processo.do')) {
    if (state === 'juntar') {
      paginaJuntarDocumento();
    } else if (state === 'assinar') {
      paginaProcessoAssinar();
    } else if (state === 'modelo') {
      log('⚠️ Fallback: Caiu em juntarDocumento/processo com state=modelo.');
      paginaJuntarDocumento();
    }
  }

  // ------------------------------------------------------------------------
  // ETAPA 1: Botão "Indulto"
  // ------------------------------------------------------------------------
  function paginaVisualizacao() {
    waitFor('input[type="button"][value*="Juntar Documento"]', (orig) => {
      if (document.getElementById('botao-indulto')) return;
      const btn = document.createElement('input');
      btn.type = 'button';
      btn.id = 'botao-indulto';
      btn.value = 'Indulto';
      btn.className = 'button';
      Object.assign(btn.style, {
        backgroundColor: '#6f42c1',
        color: 'white',
        marginLeft: '8px',
        cursor: 'pointer',
      });

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        goToState('active');
        orig.click();
      });
      orig.after(btn);
    });
  }

  // ------------------------------------------------------------------------
  // ETAPA 2: Movimentar
  // ------------------------------------------------------------------------
  async function paginaMovimentar() {
    const select = document.querySelector('#idTipoDocumento');
    if (select) {
      select.value = '87'; // Ato Ordinatório
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }

    const sucessoTipo = await preencherCampo('#descricaoTipoArquivo', TEXTO_TIPO_ARQUIVO, false);
    if (sucessoTipo) {
      const sucessoModelo = await preencherCampo('#descricaoModelo', TEXTO_BUSCA_MODELO, true);
      if (sucessoModelo) {
        waitFor('#digitarButton', (btn, btnWindow) => {
          goToState('modelo');
          if (btnWindow.digitar && typeof btnWindow.digitar === 'function') {
            btnWindow.digitar();
          } else {
            clickRobusto(btn, btnWindow);
          }
        });
      }
    }
  }

  // ------------------------------------------------------------------------
  // ETAPA 3: Editor
  // ------------------------------------------------------------------------
  function paginaModeloDocumento() {
    log('🔎 Procurando botão "Continuar" do editor (#editButton)...');
    waitFor('#editButton', (btn, btnWindow) => {
      goToState('juntar');

      try {
        if (btnWindow && typeof btnWindow.continuar === 'function') {
          log('✅ Chamando window.continuar() (do iframe)');
          btnWindow.continuar();
        } else {
          log('⚠️ Função window.continuar() não encontrada. Usando clique robusto...');
          clickRobusto(btn, btnWindow);
        }
      } catch (e) {
        log('Erro no clique do editor, tentando nativo', e);
        btn.click();
      }
    });
  }

  // ------------------------------------------------------------------------
  // ETAPA 4: Juntar Documento
  // ------------------------------------------------------------------------
  function paginaJuntarDocumento() {
    log('🕓 Etapa juntarDocumento... procurando "Continuar" ou "Salvar" (#submitButton).');

    waitFor('#submitButton', (btn, btnWindow) => {
      const btnValue = btn.value;

      // Se for "Continuar", apenas avança, mantendo state=juntar
      if (btnValue === 'Continuar') {
        log('🔎 Botão "Continuar" encontrado. Clicando automaticamente para avançar...');
        goToState('juntar');
        clickRobusto(btn, btnWindow);
        return;
      }

      if (btnValue === 'Salvar') {
        log('🔎 Botão "Salvar" encontrado. Disparando fluxo de Salvar + Assinar encadeado...');
        goToState('assinar');

        let actionTriggered = false;

        const functionsToTry = [
          'validaEExecuta',
          'salvarDocumento',
          'continuar',
          'validaEDireciona',
          'submitFormulario'
        ];

        // TENTATIVA 1: usar onclick
        const nativeOnClick = btn.getAttribute('onclick');
        if (nativeOnClick && btnWindow) {
          log('💡 Código onclick nativo encontrado:', nativeOnClick);

          try {
            const cleanNativeOnClick = nativeOnClick.replace(/;?\s*return\s+(false|true)\s*;\s*$/, '');
            const match = cleanNativeOnClick.match(/(\w+)\s*\((.*)\)/);

            if (match && match[1] && typeof btnWindow[match[1]] === 'function') {
              const funcName = match[1];
              log(`🚀 Executando função nativa descoberta no iframe: ${funcName}(btn).`);
              btnWindow[funcName].call(btnWindow, btn);
              actionTriggered = true;
            } else if (btn.onclick) {
              log('🚀 Executando função do objeto onclick nativo...');
              btn.onclick.call(btn, { target: btn, currentTarget: btn });
              actionTriggered = true;
            }
          } catch (e) {
            log('⚠️ Erro ao executar nativeOnClick:', e);
            actionTriggered = false;
          }
        } else {
          log('💡 Nenhum onclick nativo encontrado, tentando funções conhecidas...');
        }

        // TENTATIVA 2: funções conhecidas no iframe
        if (!actionTriggered) {
          for (const funcName of functionsToTry) {
            if (btnWindow && typeof btnWindow[funcName] === 'function') {
              log(`🚀 Executando btnWindow.${funcName}(btn).`);
              try {
                btnWindow[funcName].call(btnWindow, btn);
                actionTriggered = true;
                break;
              } catch (e) {
                log(`⚠️ Erro ao executar ${funcName} com argumento. Tentando sem...`, e);
                try {
                  btnWindow[funcName]();
                  actionTriggered = true;
                  break;
                } catch (e2) {
                  log(`⚠️ Erro ao executar ${funcName} sem argumento:`, e2);
                }
              }
            }
          }
        }

        // TENTATIVA 3: clique robusto
        if (!actionTriggered) {
          log('⚠️ Funções JS falharam. Tentando clique robusto no "Salvar".');
          clickRobusto(btn, btnWindow);
        }

        // TENTATIVA 4: submit forçado
        setTimeout(() => {
          const win = btnWindow || window;
          if (win.document && win.document.body && win.document.body.contains(btn)) {
            log('☢️ Fallback Nuclear: forçando submit() do form.');
            const form = btn.closest('form');
            if (form) {
              form.submit();
            } else {
              log('ERRO FATAL: Formulário não encontrado para submit().');
            }
          }
        }, 50);

        // 🔁 Encadeia a tentativa de assinatura depois do salvar
        encadearAssinaturaAposSalvar();
        return;
      }

      // Qualquer outro botão
      log(`🔎 Botão não mapeado ("${btnValue}"). Clicando normalmente.`);
      clickRobusto(btn, btnWindow);
    });
  }

  // ------------------------------------------------------------------------
  // Fluxo encadeado de assinatura após salvar
  // ------------------------------------------------------------------------
  function encadearAssinaturaAposSalvar() {
    log('🔁 Preparando fluxo de assinatura após Salvar...');
    setTimeout(() => {
      waitFor('#celularButton, #desktopButton', (btnAssinar, btnWindow) => {
        log('🟢 Botão "Assinar" encontrado (fluxo encadeado após Salvar).');

        sessionStorage.setItem(STATE_KEY, 'aguardandoVoltar');

        try {
          if (btnWindow && typeof btnWindow.clickAssinar === 'function') {
            btnWindow.clickAssinar();
          } else if (typeof window.clickAssinar === 'function') {
            window.clickAssinar();
          } else {
            btnAssinar.click();
          }
        } catch (e) {
          console.error('Erro ao assinar (encadeado), tentando clique simples', e);
          btnAssinar.click();
        }
      }, 20000);
    }, 2000);
  }

  // ------------------------------------------------------------------------
  // ETAPA 5: Assinar
  // ------------------------------------------------------------------------
  function paginaProcessoAssinar() {
    log('🕓 Etapa assinatura (rota tradicional)...');
    setTimeout(() => {
      waitFor('#celularButton, #desktopButton', (btnAssinar, btnWindow) => {
        log('🟢 Botão "Assinar" encontrado (rota tradicional).');

        sessionStorage.setItem(STATE_KEY, 'aguardandoVoltar');

        try {
          if (btnWindow && typeof btnWindow.clickAssinar === 'function') {
            btnWindow.clickAssinar();
          } else if (typeof window.clickAssinar === 'function') {
            window.clickAssinar();
          } else {
            btnAssinar.click();
          }
        } catch (e) {
          console.error('Erro ao assinar, tentando clique simples', e);
          btnAssinar.click();
        }
      }, 20000);
    }, 2000);
  }

  // ------------------------------------------------------------------------
  // ETAPA 6: Voltar
  // ------------------------------------------------------------------------
  function paginaAguardarVoltar() {
    log('🕓 Aguardando botão "Voltar"...');
    waitFor('#backButton', (btnVoltar) => {
      goToState('voltandoAba');
      btnVoltar.click();
    }, 60000);
  }

  // ------------------------------------------------------------------------
  // ETAPA 7: Reset na Aba
  // ------------------------------------------------------------------------
  function paginaVoltarParaAba() {
    log('🕓 Retornou ao processo. Resetando aba...');
    waitFor('#tabItemprefix4', (aba) => {
      if (!aba.classList.contains('currentTab')) {
        aba.click();
      }
      sessionStorage.removeItem(STATE_KEY);
      log('🏁 Fluxo finalizado.');
    });
  }

})();

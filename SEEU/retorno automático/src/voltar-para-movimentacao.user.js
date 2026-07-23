// ==UserScript==
// @name         SEEU - Voltar para Movimentação
// @version      1.0
// @namespace    https://github.com/4Vara
// @author       Scheeee
// @description  Após assinar, aguarda a conclusão do processo (mudança de tela) para clicar em Voltar e selecionar a aba Movimentar.
// @match        https://seeu.pje.jus.br/seeu/visualizacaoProcesso.do*
// @match        https://seeu.pje.jus.br/seeu/processo/juntarDocumento.do*
// @match        https://seeu.pje.jus.br/seeu/processo.do*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

/*
 * Este script monitora o fluxo de assinatura e, quando o processo é concluído,
 * clica em Voltar e abre a aba de movimentação para continuar o trabalho.
 * A documentação abaixo descreve o objetivo do automação sem alterar a lógica existente.
 */

(function() {
    'use strict';

    // CONFIGURAÇÃO
    const ID_ABA_MOVIMENTAR = 'tabItemprefix4';
    const KEY_STATUS = 'seeu_status_automacao';
    /**
     * Registra mensagens de log do fluxo de automação.
     * @param {...any} args Itens a serem exibidos no console.
     */
    const log = (...args) => console.log('[Auto Voltar]', ...args);
    const path = location.pathname;
    const statusAtual = sessionStorage.getItem(KEY_STATUS);
    if (path.includes('/juntarDocumento.do') || path.includes('/processo.do')) {


        monitorarCliqueAssinar();

        if (statusAtual === 'assinando') {
            aguardarConclusaoAssinatura();
        }
    }

    if (path.includes('/visualizacaoProcesso.do')) {
        if (statusAtual === 'voltar_clicado') {
            selecionarAbaMovimentar();
        }
    }

    // --- FUNÇÕES ---

    function monitorarCliqueAssinar() {

        const adicionarGatilho = () => {
            const botoes = document.querySelectorAll('#celularButton, #desktopButton');
            botoes.forEach(btn => {
                if (!btn.dataset.monitorado) {
                    btn.dataset.monitorado = 'true';
                    btn.addEventListener('click', () => {
                        log('Botão Assinar clicado! Salvando estado "assinando"...');
                        sessionStorage.setItem(KEY_STATUS, 'assinando');

                        aguardarConclusaoAssinatura();
                    });
                }
            });
        };

        adicionarGatilho();
        const observer = new MutationObserver(adicionarGatilho);
        observer.observe(document.body, { childList: true, subtree: true });
    }

    function aguardarConclusaoAssinatura() {
        log('⏳ Aguardando conclusão da assinatura (sumiço dos botões de assinar + aparecimento do Voltar)...');


        const checkInterval = setInterval(() => {
            const btnVoltar = document.getElementById('backButton');
            const btnAssinarCelular = document.getElementById('celularButton');
            const btnAssinarDesktop = document.getElementById('desktopButton');
            const assinarSumiu = !btnAssinarCelular && !btnAssinarDesktop;

            if (btnVoltar && btnVoltar.offsetParent !== null && assinarSumiu) {
                clearInterval(checkInterval);
                log('Processo concluído (tela de sucesso detectada). Clicando em Voltar...');

                sessionStorage.setItem(KEY_STATUS, 'voltar_clicado');
                btnVoltar.click();
            }
        }, 1000);
    }

    function selecionarAbaMovimentar() {
        log('Retorno ao processo detectado. Selecionando aba...');
        sessionStorage.removeItem(KEY_STATUS);

        const intervalo = setInterval(() => {
            const aba = document.getElementById(ID_ABA_MOVIMENTAR);
            if (aba) {
                clearInterval(intervalo);
                if (!aba.classList.contains('currentTab')) {
                    aba.click();
                    log('Aba Movimentar clicada.');
                }
            }
        }, 300);
        setTimeout(() => clearInterval(intervalo), 10000);
    }

})();
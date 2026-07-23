// ==UserScript==
// @name         SEEU - Automação Remessa
// @version      1.1
// @namespace    https://github.com/4Vara
// @author       Scheeee
// @description  Insere valores e remove campos indesejados na remessa.
// @match        https://seeu.pje.jus.br/seeu/visualizacaoProcesso.do*
// @match        https://seeu.pje.jus.br/seeu/processo/remessaAutos.do*
// @match        https://seeu.pje.jus.br/seeu/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

/*
 * Este script automatiza a abertura e o preenchimento do formulário de remessa,
 * escondendo campos desnecessários e preenchendo dados padrão para o fluxo.
 * A documentação abaixo acompanha as duas áreas do fluxo: iframe e tela principal.
 */

(function () {
    'use strict';

    // --- ESTILOS ---
    GM_addStyle(`
        .remessa-btn {
            background-color: #4CAF50; border: none; color: white; padding: 2px 8px;
            text-align: center; display: inline-block; font-size: 11px; margin-left: 5px;
            cursor: pointer; border-radius: 3px; vertical-align: middle;
        }
        .remessa-btn:hover { background-color: #45a049; }
    `);

    // =================================================================
    // LÓGICA 1: DENTRO DO IFRAME (MODAL DE REMESSA)
    // =================================================================
    if (window.location.href.includes('remessaAutos.do')) {

        function limparInterface() {
            // Seletores de tudo que queremos esconder
            const seletoresIndesejados = [
                'input[name="tipoRemessa"][value="distribuidor"]',
                'input[name="tipoRemessa"][value="entidadeRemessa"]',
                'select[name="codFinalidadeRemessaDistribuidor"]',
                'textarea[name="orientacoesDistribuidor"]',
                'select[name="codEntidadeRemessa"]',
                'select[name="codFinalidadeRemessaEntidade"]',
                'textarea[name="orientacoesOutras"]'
            ];

            seletoresIndesejados.forEach(seletor => {
                const elementos = document.querySelectorAll(seletor);
                elementos.forEach(el => {
                    // Sobe até encontrar a tabela pai e a esconde
                    const tabela = el.closest('table.form') || el.closest('table');
                    if (tabela) {
                        tabela.style.display = 'none';
                        tabela.setAttribute('style', 'display: none !important');
                    }
                });
            });

            // Remove tabelas que contêm textos específicos de aviso
            document.querySelectorAll('td').forEach(td => {
                if (td.innerText && td.innerText.includes('Para remessa à instância superior')) {
                    const tbl = td.closest('table');
                    if (tbl) tbl.setAttribute('style', 'display: none !important');
                }
            });
        }

        function forcarDadosCorretos() {
            const chkMP = document.querySelector('input[name="tipoRemessa"][value="ministerioPublico"]');
            const chkDP = document.querySelector('input[name="tipoRemessa"][value="defensoriaPublica"]');

            // 1. Marca Checkboxes
            if (chkMP && !chkMP.checked) chkMP.click();
            if (chkDP && !chkDP.checked) chkDP.click();

            // Função auxiliar para definir valores e disparar eventos
            const setVal = (id, val) => {
                const el = document.getElementById(id);
                if (el && el.value !== val) {
                    el.value = val;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.dispatchEvent(new Event('keyup', { bubbles: true }));
                }
            };

            // 2. Define Finalidades (Manifestação = 5) e Prazos (5 e 10)
            setVal('finalidadeRemessa', '5');
            setVal('finalidadeRemessaDP', '5');
            setVal('prazo', '5');
            setVal('prazoDP', '10');
        }

        // Observer vigia o Iframe para garantir limpeza constante
        const observer = new MutationObserver(() => {
            limparInterface();
            forcarDadosCorretos();
        });

        function initIframe() {
            limparInterface();
            forcarDadosCorretos();
            observer.observe(document.body, { childList: true, subtree: true });

            // Loop de segurança inicial
            let checks = 0;
            const interval = setInterval(() => {
                limparInterface();
                forcarDadosCorretos();
                checks++;
                if (checks > 15) clearInterval(interval);
            }, 400);
        }

        if (document.readyState === 'loading') window.addEventListener('load', initIframe);
        else initIframe();

        return;
    }


    // =================================================================
    // LÓGICA 2: PÁGINA PRINCIPAL (CAPA DO PROCESSO)
    // =================================================================

    /**
     * Abre o menu de remessa a partir da imagem de contexto da capa do processo.
     * @param {HTMLImageElement} imgMenu Imagem que dispara o menu contextual.
     */
    function acionarRemessa(imgMenu) {
        if (!imgMenu) return;
        imgMenu.click();
        setTimeout(() => {
            const menus = document.querySelectorAll('table.contextMenu');
            for (const menu of menus) {
                if (menu.style.display === 'none') continue;
                const opcoes = menu.querySelectorAll('td');
                for (const td of opcoes) {
                    if (td.innerText.trim() === 'Realizar Remessa') {
                        td.click();
                        return;
                    }
                }
            }
        }, 250);
    }

    function processarBotoesCapa() {
        const imagens = document.querySelectorAll('img.contextMenu');

        imagens.forEach(img => {
            // --- CORREÇÃO DEFINITIVA DE CONFLITO ---

            // 1. Verifica se a imagem tem um pai (está no DOM)
            if (!img.parentNode) return;

            // 2. FILTRO NOVO: Ignora menus dentro da área de Movimentações
            // O outro script atua nessas divs, e não queremos botão de remessa lá.
            if (img.closest('div[id^="divArquivosMovimentacao"]')) {
                return;
            }

            // 3. Em vez de olhar só o irmão vizinho (nextSibling),
            // olhamos para o CONTAINER PAI (geralmente o TD ou DIV).
            // Se já existe UM botão de remessa dentro desse container, não criamos outro.
            if (img.parentNode.querySelector('.remessa-btn')) {
                return; // Já existe botão aqui, aborta.
            }

            // Cria o botão
            const btn = document.createElement('button');
            btn.className = 'remessa-btn';
            btn.innerText = 'Remessa';
            btn.type = 'button';
            btn.title = 'Preencher remessa automática (MP e Defensoria)';

            btn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();
                acionarRemessa(img);
            };

            // Insere no container pai, logo após a imagem
            img.parentNode.insertBefore(btn, img.nextSibling);
        });
    }

    // Observer para lidar com carregamento dinâmico
    const observerCapa = new MutationObserver((mutations) => {
        // Debounce para evitar processamento excessivo causado pelo outro script
        if (window.seeuTimeout) clearTimeout(window.seeuTimeout);
        window.seeuTimeout = setTimeout(processarBotoesCapa, 500);
    });

    function initCapa() {
        processarBotoesCapa();
        observerCapa.observe(document.body || document.documentElement, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initCapa);
    else initCapa();

})();
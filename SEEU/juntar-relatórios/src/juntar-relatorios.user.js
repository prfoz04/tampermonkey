// ==UserScript==
// @name        SEEU - Automação para Juntar Relatórios
// @namespace    https://github.com/4Vara
// @version     2.3
// @description Seleciona o tipo com base no nome de cada arquivo, desmarca pendência, assina, conclui, volta e navega para as movimentações.
// @match       https://seeu.pje.jus.br/seeu/visualizacaoProcesso.do*
// @match       https://seeu.pje.jus.br/seeu/movimentarProcesso.do*
// @match       https://seeu.pje.jus.br/seeu/processo/juntarDocumento.do*
// @match       https://seeu.pje.jus.br/seeu/processo.do*
// @grant       none
// @run-at      document-idle
// @icon        https://www.google.com/s2/favicons?sz=64&domain=pje.jus.br
// ==/UserScript==

/*
 * Este script automatiza a junção de relatórios, selecionando tipo de documento,
 * enviando arquivos, assinando e retornando para a aba de movimentações.
 * A documentação abaixo descreve o roteamento por estado da sessão sem mudar o fluxo.
 */

(function() {
    'use strict';
    // A chave de estado foi atualizada para garantir que a nova lógica seja usada
    const STATE_KEY = 'seeuJuntarRelatoriosState_v2.1';
    const logPrefix = '[SEEU Automação Juntar]';

    /**
     * Registra mensagens de log do fluxo de automação.
     * @param {...any} args Itens a serem exibidos no console.
     */
    function log(...args) {
        console.log(logPrefix, ...args);
    }

    log(`Script iniciado. Versão 2.1 Estado atual: ${sessionStorage.getItem(STATE_KEY) || 'inativo'}`);

    // Função auxiliar para normalizar texto (remover acentos, tornar minúsculo) para comparação
    /**
     * Normaliza texto para comparar descrições de arquivos.
     * @param {string} text Texto a ser normalizado.
     * @returns {string} Texto normalizado.
     */
    function normalizeText(text) {
        if (!text) return '';
        return text.toString().toLowerCase()
            .normalize("NFD") // Decompõe caracteres acentuados
            .replace(/[\u0300-\u036f]/g, "") // Remove as marcas de acento
            .replace(/ç/g, "c") // Lida com caracteres específicos
            .trim();
    }

    /**
     * Aguarda um elemento existir na página antes de executar a callback.
     * @param {string} selector Seletor CSS a ser buscado.
     * @param {(element: Element) => void} callback Função executada quando o elemento é encontrado.
     * @param {number} [timeout=10000] Tempo máximo de espera em milissegundos.
     */
    function waitForElement(selector, callback, timeout = 10000) {
        log(`Aguardando pelo elemento: "${selector}"`);
        const startTime = Date.now();
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                log(`Elemento "${selector}" encontrado.`);
                clearInterval(interval);
                callback(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                console.error(`${logPrefix} Tempo esgotado à espera de: ${selector}. Limpando estado para evitar loops.`);
                sessionStorage.removeItem(STATE_KEY);
            }
        }, 300);
    }

    // Função principal de roteamento baseada no estado da sessão
    function router() {
        const url = window.location.href;
        const currentState = sessionStorage.getItem(STATE_KEY);
        log("A verificar URL:", url, "| Estado:", currentState);

        if (url.includes('visualizacaoProcesso.do') && currentState === 'returned_pending_movements_tab') {
            clicarAbaMovimentacoes();
            return;
        }

        if (url.includes('visualizacaoProcesso.do')) {
            setupPaginaVisualizacao();
            return;
        }

        switch (currentState) {
            case 'active':
                selectDocTypeAndPromptForFile();
                break;
            case 'file_selected':
                waitForElement('form[name="juntarDocumentoForm"] table tbody', processFilesAndSign);
                break;
            case 'concluded_pending_return':
                waitForElement('#backButton', voltarParaProcesso);
                break;
            default:
                log("Estado desconhecido ou inativo. Parando o roteamento.");
                break;
        }
    }

    function setupPaginaVisualizacao() {
        waitForElement('input[type="button"][value*="Juntar Documento"]', (originalButton) => {
            if (document.getElementById('botao-juntar-relatorios')) return;
            log("Botão 'Juntar Documento' encontrado. A criar botão de automação.");

            const newButton = document.createElement("button");
            newButton.id = "botao-juntar-relatorios";
            newButton.innerText = "Juntar Relatórios";
            newButton.className = 'button';
            Object.assign(newButton.style, {
                backgroundColor: '#28a745', color: 'white',
                cursor: 'pointer', fontWeight: 'bold'
            });

            newButton.addEventListener("click", (ev) => {
                ev.preventDefault();
                log("Botão 'Juntar Relatórios' clicado. A ativar automação.");
                sessionStorage.setItem(STATE_KEY, 'active');
                originalButton.click();
            });

            originalButton.parentNode.insertBefore(newButton, originalButton.nextSibling);
        });
    }

    function selectDocTypeAndPromptForFile() {
        waitForElement('#idTipoDocumento', (select) => {
            if (select.options.length > 1) {
                log('A selecionar tipo de documento...');
                select.value = '18003'; // COMPROVANTE DE CUMPRIMENTO PENA SUBSTITUTIVA
                select.dispatchEvent(new Event('change', { bubbles: true }));

                const pendenciaCheckbox = document.getElementById('ckbsGerarPendenciaAnlaiseJuntada');
                if (pendenciaCheckbox && pendenciaCheckbox.checked) {
                    log('A desmarcar a caixa "Gerar Pendência para Análise".');
                    pendenciaCheckbox.click();
                }

                promptForFileUpload();
            } else {
                log('A aguardar preenchimento das opções do tipo de documento...');
                setTimeout(() => selectDocTypeAndPromptForFile(), 300);
            }
        });
    }

    function promptForFileUpload() {
        const fileInputSelector = '#arquivosFile';
        log('A pedir ao utilizador para selecionar um ficheiro...');

        waitForElement(fileInputSelector, (inputArquivo) => {
            const userMessage = document.createElement('span');
            userMessage.innerHTML = `<span style="padding: 5px; border-left: 5px solid #ffc107; background-color: #fff3cd; color: #856404; font-weight: bold; margin-left: 10px; font-size: 14px; display: inline-block;">AÇÃO NECESSÁRIA: selecione o(s) arquivo(s) e a automação continua.</span>`;

            // Adiciona a mensagem ao lado do botão.
            inputArquivo.insertAdjacentElement('afterend', userMessage);

            // Adiciona um estilo flexível ao elemento pai para que o botão e a mensagem fiquem lado a lado
            const parent = inputArquivo.parentElement;
            if (parent) {
                parent.style.display = 'flex';
                parent.style.alignItems = 'center';
            }

            inputArquivo.scrollIntoView({ behavior: 'smooth', block: 'center' });

            const checkFileInterval = setInterval(() => {
                if (inputArquivo.files.length > 0) {
                    clearInterval(checkFileInterval);
                    log(`${inputArquivo.files.length} ficheiro(s) selecionado(s). A definir estado para "file_selected" e a aguardar recarregamento da página/tabela.`);
                    userMessage.remove();
                    sessionStorage.setItem(STATE_KEY, 'file_selected');
                }
            }, 500);
        });
    }

    /**
     * Processa os arquivos da tabela, seleciona descrições e inicia a assinatura.
     * @param {HTMLTableSectionElement} tableBody Corpo da tabela com os arquivos.
     */
    function processFilesAndSign(tableBody) {
        log('Estado "file_selected" detetado. A processar ficheiros na tabela.');

        const fileRows = tableBody.querySelectorAll('tr');
        log(`Encontrados ${fileRows.length} ficheiros na tabela para processar.`);

        fileRows.forEach((row, index) => {
            const fileNameElement = row.querySelector('td:nth-child(2)');
            const selectDescricao = row.querySelector(`select[id^="tipo"]`);

            if (!fileNameElement || !selectDescricao) {
                log(`Aviso: Não foi possível encontrar o nome do ficheiro ou a descrição para a linha ${index + 1}. A saltar.`);
                return;
            }

            const filename = fileNameElement.textContent.trim();
            log(`Processando Linha ${index + 1}: Ficheiro "${filename}"`);

            let descriptionFound = false;
            if (filename) {
                const filenameWithoutExt = filename.replace(/\.[^/.]+$/, "");
                const match = filenameWithoutExt.match(/^(?:[\d.-]+(?:[|_ -][\d.-]+)*)[\s|_|-]+(.+)/);

                if (match && match[1]) {
                    const extractedDescription = match[1].trim();
                    const normalizedDescription = normalizeText(extractedDescription);
                    log(`Descrição extraída e normalizada: "${normalizedDescription}"`);

                    const options = Array.from(selectDescricao.options);
                    const foundOption = options.find(opt => normalizeText(opt.textContent) === normalizedDescription);

                    if (foundOption) {
                        log(`Opção correspondente encontrada para a linha ${index + 1}: "${foundOption.textContent}". A selecionar.`);
                        selectDescricao.value = foundOption.value;
                        descriptionFound = true;
                    } else {
                        log(`Nenhuma opção correspondente encontrada para "${extractedDescription}" na linha ${index + 1}.`);
                    }
                } else {
                    log(`Padrão de nome de ficheiro não reconhecido na linha ${index + 1}: "${filename}".`);
                }
            }

            if (!descriptionFound) {
                const fallbackOption = Array.from(selectDescricao.options).find(opt => opt.value === '57');
                if (fallbackOption) {
                     selectDescricao.value = fallbackOption.value;
                     log(`Descrição selecionada por fallback para a linha ${index + 1}: Informação (57)`);
                } else {
                     log(`Aviso: A opção de fallback "Informação" não foi encontrada para a linha ${index + 1}.`);
                }
            }
            selectDescricao.dispatchEvent(new Event('change', { bubbles: true }));
        });

        log("Processamento de todas as descrições concluído.");

        waitForElement('#celularButton', (botaoAssinar) => {
            log('A tentar assinar...');
            if (typeof window.clickAssinar === 'function') {
                log('Função clickAssinar() encontrada. A chamá-la.');
                sessionStorage.setItem(STATE_KEY, 'signed_pending_conclusion');
                window.clickAssinar();
            } else {
                log('Função clickAssinar() não encontrada. Tentando clicar no botão.');
                if (botaoAssinar) {
                    sessionStorage.setItem(STATE_KEY, 'signed_pending_conclusion');
                    botaoAssinar.click();
                } else {
                     console.error(`${logPrefix} Erro: O botão de assinatura não foi encontrado.`);
                     sessionStorage.removeItem(STATE_KEY);
                }
            }
        }, 5000);
    }

    function voltarParaProcesso() {
        log('Estado "concluded_pending_return" detetado. A procurar botão "Voltar para o Processo".');
        waitForElement('#backButton', (botaoVoltar) => {
            log('Botão "Voltar para o Processo" encontrado. A clicar...');
            sessionStorage.setItem(STATE_KEY, 'returned_pending_movements_tab');
            botaoVoltar.click();
        });
    }

    function clicarAbaMovimentacoes() {
        log('Estado "returned_pending_movements_tab" detetado. A procurar aba "Movimentações".');
        const selectorAba = '#tabHorz a';
        waitForElement(selectorAba, () => {
            const abaMovimentacoes = Array.from(document.querySelectorAll(selectorAba))
                .find(link => link.textContent.trim().toLowerCase() === 'movimentações');

            if (abaMovimentacoes) {
                log('Aba "Movimentações" encontrada. A clicar...');
                sessionStorage.removeItem(STATE_KEY);
                abaMovimentacoes.click();
                log("Fluxo de automação concluído com sucesso!");
            } else {
                console.error(`${logPrefix} Erro: Não foi possível encontrar a aba "Movimentações".`);
                sessionStorage.removeItem(STATE_KEY);
            }
        });
    }

    router();
})();
// ==UserScript==
// @name         SEEU - Filtro de Tipo de Documento
// @namespace    https://github.com/4Vara
// @version      1.4
// @description  Adiciona pesquisa ao tipo de documento, preenche tipo de arquivo e movimento conforme o modelo e desmarca pendências.
// @author       Scheeee
// @match        https://seeu.pje.jus.br/seeu/movimentarProcesso.do*
// @match        https://seeu.pje.jus.br/seeu/processo/juntarDocumento.do*
// @grant        none
// @run-at       document-idle
// @icon         https://www.google.com/s2/favicons?sz=64&domain=pje.jus.br
// ==/UserScript==

/*
 * Este script adiciona uma busca por texto aos campos de tipo de documento e modelo,
 * facilitando a seleção de opções no SEEU sem alterar o fluxo de automação.
 * A documentação a seguir descreve as etapas de preenchimento e limpeza de campos.
 */

(function() {
    'use strict';
    /**
     * Normaliza texto para comparação mais simples.
     * @param {string} text Texto a ser normalizado.
     * @returns {string} Texto normalizado em minúsculas sem acentos.
     */
    function normalizeText(text) {
        if (!text) return '';
        return text.toString().toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .trim();
    }

    /**
     * Aguarda um elemento existir na página.
     * @param {string} selector Seletor CSS a ser observado.
     * @param {(element: Element) => void} callback Função executada quando o elemento for encontrado.
     * @param {number} [timeout=10000] Tempo máximo de espera em milissegundos.
     */
    function waitForElement(selector, callback, timeout = 10000) {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(interval);
                callback(element);
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                console.error(`Tempo esgotado à espera de: ${selector}`);
            }
        }, 300);
    }

    /**
     * Aguarda o seletor receber opções válidas.
     * @param {HTMLSelectElement} selectElement Seletor a ser monitorado.
     * @param {() => void} callback Função executada quando houver opções.
     */
    function waitForOptions(selectElement, callback) {
        const interval = setInterval(() => {
            if (selectElement.options.length > 1) {
                clearInterval(interval);
                callback();
            }
        }, 300);
    }

    // Função principal que encontra os seletores e adiciona a funcionalidade de pesquisa
    function addSearchFilterToSelectors() {

        const h4Element = document.querySelector('h4');
        const trFiltroModelos = document.querySelector('#trFiltroModelos');
        const trModelo = document.querySelector('#trModelo');
        const trDigitarTexto = document.querySelector('#trDigitarTexto');
        if (h4Element && trFiltroModelos && trModelo && trDigitarTexto) {
            const newTable = document.createElement('table');
            newTable.classList.add('form');
            const newTbody = document.createElement('tbody');
            newTbody.appendChild(trFiltroModelos);
            newTbody.appendChild(trModelo);
            newTbody.appendChild(trDigitarTexto);
            newTable.appendChild(newTbody);
            h4Element.insertAdjacentElement('afterend', newTable);
        }

        const selectElements = document.querySelectorAll('select[name^="tipos"], select#idTipoDocumento');
        selectElements.forEach(selectElement => {

            if (selectElement.previousElementSibling && selectElement.previousElementSibling.classList.contains('seeu-autocomplete-container')) {
                return;
            }

            // Aguarda as opções válidas antes de continuar
            waitForOptions(selectElement, () => {
                // Esconde o seletor original
                selectElement.style.display = 'none';

                // Cria o container para a pesquisa e lista de resultados
                const container = document.createElement('div');
                container.classList.add('seeu-autocomplete-container');
                Object.assign(container.style, {
                    position: 'relative',
                    width: '524px',
                    marginBottom: '5px',
                    boxSizing: 'border-box'
                });

                // Cria o campo de pesquisa (input)
                const searchInput = document.createElement('input');
                searchInput.type = 'text';
                searchInput.placeholder = 'Digite para pesquisar...';
                searchInput.classList.add('seeu-autocomplete-input');
                Object.assign(searchInput.style, {
                    width: '100%',
                    boxSizing: 'border-box',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #ccc',
                    borderRadius: '4px'
                });

                // Cria uma lista de opções (ul)
                const optionsList = document.createElement('ul');
                optionsList.classList.add('seeu-autocomplete-list');
                Object.assign(optionsList.style, {
                    position: 'absolute',
                    zIndex: '100',
                    listStyleType: 'none',
                    padding: '0',
                    margin: '0',
                    border: '1px solid #ccc',
                    maxHeight: '200px',
                    overflowY: 'auto',
                    width: '100%',
                    backgroundColor: '#fff',
                    display: 'none', // Começa oculto
                    boxSizing: 'border-box',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.1)',
                    borderRadius: '4px'
                });

                container.appendChild(searchInput);
                container.appendChild(optionsList);
                selectElement.parentNode.insertBefore(container, selectElement);

                // Armazena todas as opções do seletor original, exceto a opção padrão
                const allOptions = Array.from(selectElement.options)
                    .filter(opt => opt.value !== '0')
                    .map(opt => ({
                        value: opt.value,
                        text: opt.textContent,
                        normalizedText: normalizeText(opt.textContent)
                    }));

                // Adiciona evento de entrada para filtrar a lista
                searchInput.addEventListener('input', () => {
                    const searchTerm = normalizeText(searchInput.value);
                    optionsList.innerHTML = '';
                    if (searchTerm.length > 0) {
                        optionsList.style.display = 'block';
                        const filteredOptions = allOptions.filter(opt => opt.normalizedText.includes(searchTerm));
                        filteredOptions.forEach(opt => {
                            const li = document.createElement('li');
                            li.textContent = opt.text;
                            Object.assign(li.style, {
                                padding: '8px',
                                cursor: 'pointer',
                                borderBottom: '1px solid #eee',
                                transition: 'background-color 0.2s ease-in-out'
                            });
                            // Adiciona evento de hover
                            li.addEventListener('mouseenter', () => { li.style.backgroundColor = '#f0f0f0'; });
                            li.addEventListener('mouseleave', () => { li.style.backgroundColor = ''; });
                            // Destaca o termo de pesquisa
                            const regex = new RegExp(searchInput.value.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
                            li.innerHTML = li.textContent.replace(regex, `<strong style="background-color:#ffff00; font-weight: normal;">$&</strong>`);
                            li.addEventListener('click', () => {
                                searchInput.value = opt.text;
                                selectElement.value = opt.value;
                                selectElement.dispatchEvent(new Event('change', { bubbles: true })); // Dispara o evento de mudança para que o sistema reaja
                                optionsList.style.display = 'none';
                            });
                            optionsList.appendChild(li);
                        });
                    } else {
                        optionsList.style.display = 'none';
                    }
                });

                // Oculta a lista quando o foco está perdido (com um pequeno atraso para permitir o clique)
                searchInput.addEventListener('blur', () => {
                    setTimeout(() => {
                        optionsList.style.display = 'none';
                    }, 200);
                });

                // Atualiza a entrada de pesquisa quando o seletor oculto muda
                selectElement.addEventListener('change', () => {
                    const selectedOption = selectElement.options[selectElement.selectedIndex];
                    if (selectedOption) {
                        searchInput.value = selectedOption.textContent;
                    }
                });

                // Verifica o valor atual ao carregar
                const currentSelectedOption = selectElement.options[selectElement.selectedIndex];
                if (currentSelectedOption && currentSelectedOption.value !== '0') {
                    searchInput.value = currentSelectedOption.textContent;
                }
            });
        });
    }

    /**
     * Preenche os campos de tipo de arquivo com texto e código.
     * @param {string} texto Texto descritivo do tipo de arquivo.
     * @param {string} id Código do tipo de arquivo.
     */
    function preencherCampoTipoArquivo(texto, id) {
        const descricaoInput = document.getElementById('descricaoTipoArquivo');
        const codigoInput = document.getElementById('codTipoArquivo');

        if (!descricaoInput || !codigoInput) {
            console.warn("[Automação] Campos de autocomplete 'Tipo de Arquivo' não encontrados.");
            return;
        }

        console.log(`[Automação] Preenchendo campo 'Tipo de Arquivo' com Texto: "${texto}", ID: "${id}"`);
        descricaoInput.value = texto;
        codigoInput.value = id;


        descricaoInput.dispatchEvent(new Event('input', { bubbles: true }));
        descricaoInput.dispatchEvent(new Event('change', { bubbles: true }));
        descricaoInput.dispatchEvent(new Event('blur', { bubbles: true }));
    }


    /**
     * Limpa os campos de tipo de arquivo e movimento.
     * @param {HTMLSelectElement} tiposSelect Seletor do tipo de movimento.
     * @param {HTMLInputElement} searchInput Campo de pesquisa associado.
     */
    function limparCampos(tiposSelect, searchInput) {

        preencherCampoTipoArquivo('', '');


        if (tiposSelect && searchInput) {
             console.log(`[Automação] Limpando campo 'Tipo de Movimento'.`);
            tiposSelect.value = '0';
            searchInput.value = '';
            tiposSelect.dispatchEvent(new Event('change', { bubbles: true }));
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }


    // Função para adicionar a automação do campo de modelo
    function addModeloAutomation() {
        waitForElement('#codModelo', (codModeloInput) => {
            const modeloObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'value') {
                        const modeloValue = document.querySelector('#descricaoModelo').value;
                        console.log(`[Automação] Modelo alterado para: "${modeloValue}"`);

                        const tiposSelect = document.querySelector('select#idTipoDocumento');
                        const searchInputTipoMovimentacao = tiposSelect?.previousElementSibling?.querySelector('input.seeu-autocomplete-input');
                        const normalizedModeloValue = normalizeText(modeloValue);

                        // Mapeamento para o campo "TIPO DE ARQUIVO", com base nos valores do pop-up
                        const tipoArquivoMap = {
                            'ato ordinatorio': { id: '126', text: 'Ato Ordinatório' },
                            'certidao': { id: '37', text: 'Certidão' }
                        };

                        let targetKeyword = '';
                        if (normalizedModeloValue.includes('ato ordinatorio') || normalizedModeloValue.includes('ato inic')) {
                            targetKeyword = 'ato ordinatorio';
                        } else if (normalizedModeloValue.includes('cert')) {
                            targetKeyword = 'certidao';
                        }

                        if (targetKeyword) {
                            // --- 1. Preenche o campo "Tipo de ARQUIVO" ---
                            const arquivoData = tipoArquivoMap[targetKeyword];
                            if (arquivoData) {
                                preencherCampoTipoArquivo(arquivoData.text, arquivoData.id);
                            }

                            // --- 2. Preenche o campo "Tipo de MOVIMENTO" ---
                            if (tiposSelect && searchInputTipoMovimentacao) {
                                const movimentoOption = Array.from(tiposSelect.options).find(opt => normalizeText(opt.textContent) === targetKeyword);
                                if (movimentoOption) {
                                    const movimentoId = movimentoOption.value;
                                    const movimentoText = movimentoOption.textContent;
                                    console.log(`[Automação] Preenchendo 'Tipo de Movimento' com: "${movimentoText}" (ID: ${movimentoId})`);
                                    searchInputTipoMovimentacao.value = movimentoText;
                                    tiposSelect.value = movimentoId;
                                    // Dispara eventos para garantir a persistência
                                    tiposSelect.dispatchEvent(new Event('change', { bubbles: true }));
                                    searchInputTipoMovimentacao.dispatchEvent(new Event('input', { bubbles: true }));
                                    searchInputTipoMovimentacao.dispatchEvent(new Event('change', { bubbles: true }));
                                    searchInputTipoMovimentacao.dispatchEvent(new Event('blur', { bubbles: true }));
                                } else {
                                     console.warn(`[Automação] Opção '${targetKeyword}' não encontrada na lista 'Tipo de Movimento'.`);
                                }
                            }
                        } else {
                            // Limpa os campos se não houver correspondência de modelo
                            limparCampos(tiposSelect, searchInputTipoMovimentacao);
                        }
                    }
                });
            });
            modeloObserver.observe(codModeloInput, { attributes: true, childList: false, subtree: false });
        });
    }

    // Função para desmarcar a caixa de seleção de pendência
    function uncheckPendencia() {
        waitForElement('#ckbsGerarPendenciaAnlaiseJuntada', (pendenciaCheckbox) => {
            if (pendenciaCheckbox.checked) {
                pendenciaCheckbox.checked = false;
            }
        });
    }

    // Inicia as funções principais do script
    addSearchFilterToSelectors();
    addModeloAutomation();
    uncheckPendencia();

})();


// ==UserScript==
// @name         Filtro de Localizadores SEEU
// @namespace    https://github.com/4Vara
// @version      1
// @description  Cria uma lista de seleção para filtrar a tabela de localizadores.
// @author       Scheeee
// @match        https://seeu.pje.jus.br/seeu/processo/tipoLocalizador.do*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==
// ==UserScript==

/*
 * Este script cria um filtro interativo na tabela de localizadores do SEEU,
 * permitindo selecionar quais itens devem permanecer visíveis.
 * A documentação foi adicionada sem alterar o fluxo de leitura e persistência do estado.
 */

(function () {
    'use strict';

    let filterInitialized = false;

    function waitForTable() {
        const table = document.querySelector('table.resultTable');
        if (table && table.querySelector("tbody tr")) {
            if (!filterInitialized) {
                console.log("✅ Tabela encontrada, criando filtro...");
                initializeFilter(table);
            }
        } else {
            console.log("⏳ Esperando tabela carregar...");
            setTimeout(waitForTable, 1000);
        }
    }

    /**
     * Inicializa o filtro na tabela recebida.
     * @param {HTMLTableElement} table Tabela de localizadores a ser filtrada.
     */
    function initializeFilter(table) {
        filterInitialized = true;

        const headers = Array.from(table.querySelectorAll('thead th'));
        const columnIndex = headers.findIndex(th => th.textContent.trim() === 'Descrição');

        if (columnIndex === -1) {
            console.error("❌ Não foi possível encontrar a coluna 'Descrição'. O script não pode continuar.");
            return;
        }
        console.log(`🔎 Coluna "Descrição" encontrada no índice: ${columnIndex}`);

        const localizadores = extractLocalizadores(table, columnIndex);
        console.log("Localizadores encontrados (final):", localizadores);
        if (localizadores.length === 0) {
            console.log("⚠️ Nenhum localizador encontrado!");
            return;
        }

        injectStyles();
        const filterContainer = createFilterUI(localizadores, table, columnIndex);
        loadAndApplyInitialState(filterContainer, table, columnIndex);
    }

    /**
     * Extrai os valores únicos da coluna de descrição.
     * @param {HTMLTableElement} table Tabela contendo os localizadores.
     * @param {number} columnIndex Índice da coluna de descrição.
     * @returns {string[]} Lista dos localizadores únicos.
     */
    function extractLocalizadores(table, columnIndex) {

        const localizadoresArr = [];
        const rows = table.querySelectorAll('tbody tr');

        console.log("Total de linhas encontradas em resultTable:", rows.length);

        rows.forEach((row, i) => {
            const cell = row.querySelectorAll('td')[columnIndex];
            if (cell) {
                let text = '';
                const link = cell.querySelector('a');
                if (link) {
                    text = link.textContent.trim();
                } else {
                    // Fallback caso o texto não seja um link
                    text = cell.textContent.trim();
                }

                if (text) {
                    // Garante que o item seja único antes de adicionar
                    if (!localizadoresArr.includes(text)) {
                        console.log(`Linha ${i}: Adicionando "${text}" à lista.`);
                        localizadoresArr.push(text);
                    }
                }
            } else {
                 console.log(`Linha ${i}: nenhuma célula encontrada no índice ${columnIndex}`);
            }
        });

        console.log("🔎 Localizadores únicos extraídos:", localizadoresArr);
        return localizadoresArr.sort((a, b) => a.localeCompare(b));
    }

    /**
     * Cria a interface de filtro com checkboxes para os localizadores.
     * @param {string[]} localizadores Lista de valores para montar os filtros.
     * @param {HTMLTableElement} table Tabela alvo do filtro.
     * @param {number} columnIndex Índice da coluna a ser filtrada.
     * @returns {HTMLDivElement} Container da interface criada.
     */
    function createFilterUI(localizadores, table, columnIndex) {
        const container = document.createElement("div");
        container.id = "localizador-filter-container";
        container.innerHTML = `
            <h3>Filtrar Localizadores</h3>
            <label><input type="checkbox" id="selectAll" checked> <strong>Todos</strong></label>
            <div id="checkbox-list"></div>
        `;
        table.parentNode.insertBefore(container, table);

        const checkboxList = container.querySelector("#checkbox-list");

        localizadores.forEach(nome => {
            const label = document.createElement("label");
            const cb = document.createElement("input");
            cb.type = "checkbox";
            cb.value = nome;
            cb.className = "localizador-checkbox";
            cb.checked = true;
            label.appendChild(cb);
            label.appendChild(document.createTextNode(" " + nome));
            checkboxList.appendChild(label);
        });

        container.addEventListener("change", (e) => {
            if (e.target.id === "selectAll") {
                const checked = e.target.checked;
                container.querySelectorAll(".localizador-checkbox").forEach(cb => cb.checked = checked);
                filterTable(table, columnIndex);
            } else if (e.target.classList.contains("localizador-checkbox")) {
                const allBoxes = container.querySelectorAll(".localizador-checkbox");
                document.getElementById("selectAll").checked =
                    Array.from(allBoxes).every(cb => cb.checked);
                filterTable(table, columnIndex);
            }
        });

        return container;
    }

    /**
     * Aplica os filtros selecionados à tabela.
     * @param {HTMLTableElement} table Tabela a ser filtrada.
     * @param {number} columnIndex Índice da coluna usada para comparação.
     */
    function filterTable(table, columnIndex) {
        const checked = Array.from(document.querySelectorAll(".localizador-checkbox:checked"))
            .map(cb => cb.value);
        table.querySelectorAll("tbody tr").forEach(row => {
            const cell = row.querySelectorAll('td')[columnIndex];
            if (cell) {
                let text = '';
                const link = cell.querySelector("a");
                 if (link) {
                    text = link.textContent.trim();
                } else {
                    text = cell.textContent.trim();
                }

                if(text){
                    row.style.display = (checked.length === 0 || checked.includes(text)) ? "" : "none";
                }
            }
        });
        GM_setValue("savedLocalizadores", JSON.stringify(checked));
    }

    /**
     * Carrega o estado salvo e aplica os filtros iniciais.
     * @param {HTMLDivElement} container Container com os checkboxes do filtro.
     * @param {HTMLTableElement} table Tabela alvo do filtro.
     * @param {number} columnIndex Índice da coluna a ser filtrada.
     */
    async function loadAndApplyInitialState(container, table, columnIndex) {
        const savedValue = await GM_getValue("savedLocalizadores");

        if (savedValue !== undefined && savedValue !== null) {
            const saved = JSON.parse(savedValue);

            container.querySelectorAll(".localizador-checkbox").forEach(cb => {
                cb.checked = saved.includes(cb.value);
            });

            const allBoxes = container.querySelectorAll(".localizador-checkbox");
            document.getElementById("selectAll").checked = Array.from(allBoxes).every(cb => cb.checked);
        }

        filterTable(table, columnIndex);
    }

    function injectStyles() {
        if (document.getElementById("localizador-filter-styles")) return;
        const style = document.createElement("style");
        style.id = "localizador-filter-styles";
        style.textContent = `
            #localizador-filter-container {
                border: 1px solid #ccc; border-radius: 8px; padding: 10px;
                margin: 15px 0; background: #f9f9f9;
            }
            #checkbox-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 6px; margin-top: 10px; }
            #checkbox-list label, #localizador-filter-container > label { cursor: pointer; display: block; }
        `;
        document.head.appendChild(style);
    }

    waitForTable();

})();


// ==UserScript==
// @name         Alterar cor de processos - SEEU
// @namespace    https://github.com/4Vara
// @version      2.2
// @description  Aplica cor de fundo em vários elementos do SEEU conforme a Classe Processual.
// @author       sche
// @match        https://seeu.pje.jus.br/seeu/*
// @grant        none
// ==/UserScript==

/*
 * Este script aplica cores visuais aos processos e às linhas de tabelas de acordo
 * com a classe processual ou sigla identificada no SEEU.
 * A lógica de mapeamento e observação do DOM permanece intacta.
 */

(function() {
    'use strict';

    const coresProcesso = {
        "413": "#d4f7d4",
        "355": "#e0e0e0",
        "386": "#ffffff",
        "12729": "#f7d4e8"
    };

    const coresPorSigla = {
        "AgExPe": "#d4f7d4",
        "CartPrecCrim": "#e0e0e0",
        "ExMedAltJC": "#f7d4e8",
        "ExPe": "#ffffff"
    };

    const coresPorNomeCompleto = {
        "Agravo de Execução Penal": "#d4f7d4",
        "Execução de Medidas Alternativas no Juízo Comum": "#f7d4e8",
        "Carta Precatória Criminal": "#e0e0e0",
        "Execução da Pena": "#ffffff"
    };

    function aplicarCorProcesso() {
        const wrapper = document.querySelector("#informacoesProcessuais-wrapper");
        const classe = document.querySelector("td[data-label='classe processual'] + td a");

        if (wrapper && classe) {
            const texto = classe.textContent.trim();
            const codigo = texto.split(" -")[0];

            if (coresProcesso[codigo]) {
                wrapper.style.backgroundColor = coresProcesso[codigo];
                wrapper.style.transition = "background-color 0.5s ease";
            }
        }
    }

    function aplicarCorTabelaPorSigla() {
        const divsClasse = document.querySelectorAll("div[align='center'][title]");

        divsClasse.forEach(div => {
            const sigla = div.textContent.trim();
            const cor = coresPorSigla[sigla];

            if (cor) {
                const linha = div.closest('tr');
                if (linha && !linha.style.backgroundColor) { // Evita sobrepor cores
                    linha.style.backgroundColor = cor;
                    linha.style.transition = "background-color 0.5s ease";
                }
            }
        });
    }

    function aplicarCorTabelaPorNomeCompleto() {
        const tables = document.querySelectorAll("table.resultTable");

        tables.forEach(table => {
            const headers = table.querySelectorAll('th');
            let classeIndex = -1;

            headers.forEach((header, index) => {
                if (header.textContent.trim() === 'Classe') {
                    classeIndex = index;
                }
            });

            if (classeIndex === -1) return;

            const rows = table.querySelectorAll('tbody tr');
            rows.forEach(row => {
                const cell = row.children[classeIndex];
                if (cell) {
                    const classeTexto = cell.textContent.trim();
                    const cor = coresPorNomeCompleto[classeTexto];
                    if (cor) {
                        row.style.backgroundColor = cor;
                        row.style.transition = "background-color 0.5s ease";
                    }
                }
            });
        });
    }

    function aplicarTodasAsCores() {
        aplicarCorProcesso();
        aplicarCorTabelaPorSigla();
        aplicarCorTabelaPorNomeCompleto();
    }

    const observer = new MutationObserver(aplicarTodasAsCores);
    observer.observe(document.body, { childList: true, subtree: true });

    aplicarTodasAsCores();

})();


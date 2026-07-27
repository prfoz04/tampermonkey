// ==UserScript==
// @name         eproc - Geração de relatórios mensais
// @namespace    https://github.com/4Vara
// @version      1.0.8
// @description  Gera automaticamente os relatórios do último mês registrado para todos os prestadores no eproc.
// @author       Leonardo
// @match        https://eproc.jfpr.jus.br/eprocV2/controlador.php?acao=relatorio_diario_cumprimento_pena*
// @updateURL    https://raw.githubusercontent.com/prfoz04/tampermonkey/eproc/geracao de relatorios/src/geracao-de-relatorios.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/tampermonkey/eproc/geracao de relatorios/src/geracao-de-relatorios.user.js
// @run-at       document-idle
// @grant        GM_download
// ==/UserScript==

(async function () {
    'use strict';
    console.log('[eproc - geração de relatórios] script iniciado.');

    const ID_SELECT_PRESTADORES = '#cmbPrestador';

    const ID_SELECT_VARA = '#cmbVara';

    const ID_SELECT_ENTIDADE = '#cmbEntidade';

    const ID_FORM = '#frmConsulta';

    const ID_MES = '#cmbMesAno';

    //value necessário para fazer a requisição da geração de relatório
    const CMB_VARA = await aguardarSelect(ID_SELECT_VARA, option => option.textContent.includes('Foz do Iguaçu') && option.textContent.includes('4'));

    const DATE = new Date();

    /**
     * itera sobre os prestadores capturando os formulários
     * @param {string} mesAno
     */
    async function gerar(mesAno) {
        if (!mesAno || mesAno === 'Selecione')
            return;
        console.log(`Gerando relatórios para o mês ${mesAno}`);

        /**
         * @type {HTMLSelectElement}
         */
        const selectVara = document.querySelector(ID_SELECT_VARA);
        /**
         * @type {HTMLSelectElement}
         */
        const selectEntidade = document.querySelector(ID_SELECT_ENTIDADE);
        /**
         * @type {HTMLSelectElement}
         */
        const selectPrestadores = document.querySelector(ID_SELECT_PRESTADORES);
        /**
         * @type {HTMLFormElement}
         */
        const form = document.querySelector(ID_FORM);
        const linksPDF = [];

        forcarTrocaSelect(selectVara, CMB_VARA[0]);
        forcarChange(selectVara);

        const entidadeSelecionada = selectEntidade?.value || ' ';
        if (entidadeSelecionada && entidadeSelecionada.trim() !== ' ' && entidadeSelecionada.trim() !== 'Selecione') {
            forcarTrocaSelect(selectEntidade, entidadeSelecionada);
            forcarChange(selectEntidade);
        }

        const prestadoresDisponiveis = await aguardarSelect(ID_SELECT_PRESTADORES);
        for (const valorPrestador of prestadoresDisponiveis) {
            forcarTrocaSelect(selectPrestadores, valorPrestador);
            forcarChange(selectPrestadores);

            const mesesCumpridos = await aguardarSelect(ID_MES);
            const nomePrestador = selectPrestadores.options[selectPrestadores.selectedIndex]?.text || 'Prestador sem nome';
            const mesNormalizado = normalizarMesAno(mesAno);
            const mesesDisponiveisNormalizados = mesesCumpridos.map(normalizarMesAno);

            if (!mesesCumpridos.length || mesesDisponiveisNormalizados.indexOf(mesNormalizado) === -1) {
                continue;
            }

            /**
             * @type {HTMLSelectElement}
             */
            const selectMes = document.querySelector(ID_MES);
            const opcaoCorrespondente = Array.from(selectMes.options).find(opt => {
                const textoOption = normalizarMesAno(opt.textContent);
                const valorOption = normalizarMesAno(opt.value);
                const mesProcurado = mesNormalizado;
                return textoOption === mesProcurado || valorOption === mesProcurado;
            });

            if (!opcaoCorrespondente) {
                console.log(`[PULADO] Prestador ${nomePrestador} não possui relatório para ${mesAno}`);
                continue;
            }

            forcarTrocaSelect(selectMes, opcaoCorrespondente.value);
            forcarChange(selectMes);

            const formData = new FormData(form);
            // @ts-ignore
            const params = new URLSearchParams(formData);
            params.append('btnPesquisar', 'Gerar Relatório');
            params.set('cmbVara', selectVara.value);
            params.set('cmbEntidade', entidadeSelecionada);
            params.set('cmbPrestador', valorPrestador);
            params.set('cmbMesAno', opcaoCorrespondente.value);

            try {
                const formEmNovaAba = document.createElement('form');
                formEmNovaAba.method = form.method || 'POST';
                formEmNovaAba.action = form.action;
                formEmNovaAba.target = '_blank';
                formEmNovaAba.style.display = 'none';

                for (const [nomeCampo, valorCampo] of params.entries()) {
                    const input = document.createElement('input');
                    input.type = 'hidden';
                    input.name = nomeCampo;
                    input.value = valorCampo;
                    formEmNovaAba.appendChild(input);
                }

                document.body.appendChild(formEmNovaAba);
                formEmNovaAba.submit();
                formEmNovaAba.remove();

                linksPDF.push({ prestador: nomePrestador, pdfUrl: `${form.action}?${params.toString()}` });
            }
            catch (error) {
                console.error(`erro ao gerar relatório do prestador ${nomePrestador}: ${error}`);
            }
        }
        console.log(linksPDF);
        criaBotao();
    }

    /**
     * envia para a planilha API para que ela possa registrar os valores na planilha PSC e enviar os pdfs para o drive
     * @param {object} links 
     */
    function enviarParaPlanilhas(links) {
        const url = "https://script.google.com/macros/s/AKfycbxH4GeMfR5z0deOlwgFOpvlEY9LLKAzj921hYuEOgM4pt-oc7ce5sviMQxhqnzMP914/exec";
    }

    /**
     * @param {HTMLSelectElement} selectElement 
     * @param {string} valor 
     */
    function forcarTrocaSelect(selectElement, valor) {
        if (!selectElement) {
            return;
        }

        const option = Array.from(selectElement.options).find(opt => opt.value === valor);
        if (!option) {
            return;
        }

        Array.from(selectElement.options).forEach(opt => opt.selected = false);
        option.selected = true;
        selectElement.value = valor;
        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        if (window.$ || window.jQuery) {
            (window.$ || window.jQuery)(selectElement).trigger('change');
        }
    }

    /** 
     * @param {HTMLSelectElement} elemento 
     */
    function forcarChange(elemento) {
        elemento.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof window.jQuery !== 'undefined') {
            window.jQuery(elemento).trigger('change');
        }
    }

    /**
     * função necessária pois o select é preenchido alguns milissegundos atrasado
     * @param {string} idSelect 
     * @param {(option: HTMLOptionElement)=>boolean} [filtro=null] 
     * @return {Promise<string[]>}
     */
    async function aguardarSelect(idSelect, filtro = null) {
        return new Promise((response) => {
            const interval = setInterval(() => {
                const select = document.querySelector(idSelect);
                if (!select) {
                    return;
                }

                const options = select.querySelectorAll('option');
                const temOpcoesValidas = Array.from(options).some(option => option.value && option.value.trim() !== ' ' && option.value.trim() !== 'Selecione' && option.value.trim() !== 'null');

                if (options.length > 1 && temOpcoesValidas) {
                    clearInterval(interval);
                    let respostas = Array.from(options);
                    if (filtro)
                        respostas = respostas.filter(filtro);
                    respostas = respostas.filter(option => option.value && option.value.trim() !== ' ' && option.value.trim() !== 'Selecione' && option.value.trim() !== 'null');
                    response(respostas.map(option => option.value));
                }
                if (options.length === 1 && (!options[0].value || options[0].value.trim() === 'null')) {
                    clearInterval(interval);
                    response([]);
                }
            }, 300); //tempo de checagem
        });
    }

    function normalizarMesAno(valor) {
        return (valor || '')
            .toString()
            .normalize('NFKD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .replace(/\s+/g, '')
            .replace(/[^0-9]/g, '');
    }

    function criaBotao() {
        const div = document.querySelector(ID_FORM);
        const botao = document.createElement('button');
        botao.className = 'eproc-button-primary'
        botao.type = 'button'
        botao.onclick = criarInput;
        botao.id = 'gerar-tudo';
        botao.textContent = 'Gerar todos os relatórios'
        div.appendChild(botao);
    }

    function criarInput() {
        document.querySelector('#gerar-tudo').remove();
        const div = document.querySelector(ID_FORM);
        const select = document.createElement('select');
        select.className = 'eproc-select w-default';
        select.onchange = function() {
            gerar(select.value);
            select.remove();
        };
        select.appendChild(criarOption('Selecione'));
        for (let ano = DATE.getFullYear(); ano >= 2026; ano--) {
            for (let mes = DATE.getMonth() + 1; mes >= 1; mes--) {
                select.appendChild(criarOption(`${mes<10?"0"+mes:mes} / ${ano}`));
            }
        }
        div.appendChild(select);
    }

    /**
     * @param {string} text 
     * @returns {HTMLOptionElement}
     */
    function criarOption(text) {
        var option = document.createElement('option');
        option.value = text;
        option.textContent = text;
        return option
    }

    criaBotao();

})();

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
// @grant        GM_xmlhttpRequest
// @connect      https://api.emailjs.com
// @connect      https://cdn.jsdelivr.net
// ==/UserScript==

async function garantirEmailJs() {
    if (typeof window.emailjs !== 'undefined') {
        return window.emailjs;
    }

    await new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4/dist/email.min.js';
        script.async = true;
        const timeoutId = window.setTimeout(() => {
            script.remove();
            reject(new Error('Timeout ao carregar EmailJS'));
        }, 8000);

        script.onload = () => {
            window.clearTimeout(timeoutId);
            resolve();
        };
        script.onerror = () => {
            window.clearTimeout(timeoutId);
            reject(new Error('Falha ao carregar EmailJS'));
        };
        document.head.appendChild(script);
    });

    if (typeof window.emailjs === 'undefined') {
        throw new Error('EmailJS não ficou disponível na janela');
    }

    window.emailjs.init({ publicKey: 'vhgmZTHn-Jng65jzC' });
    return window.emailjs;
}

(async function () {
    try {
        await garantirEmailJs();
    } catch (error) {
        console.error('[eproc - geração de relatórios] erro ao carregar EmailJS:', error);
    }
})();
(async function () {
    'use strict';
    console.log('[eproc - geração de relatórios] script iniciado.');

    if (!window.__eprocBloquearAba) {
        const submitOriginal = HTMLFormElement.prototype.submit;
        HTMLFormElement.prototype.submit = function (...args) {
            const target = (this.getAttribute('target') || '').toLowerCase();
            if (target === '_blank' || target === '_new' || target === '_parent' || target === '_top') {
                console.warn('[eproc - geração de relatórios] bloqueando submit em nova aba', this.action, target);
                return;
            }
            return submitOriginal.apply(this, args);
        };

        const requestSubmitOriginal = HTMLFormElement.prototype.requestSubmit;
        HTMLFormElement.prototype.requestSubmit = function (...args) {
            const target = (this.getAttribute('target') || '').toLowerCase();
            if (target === '_blank' || target === '_new' || target === '_parent' || target === '_top') {
                console.warn('[eproc - geração de relatórios] bloqueando requestSubmit em nova aba', this.action, target);
                return;
            }
            return requestSubmitOriginal.apply(this, args);
        };

        window.__eprocBloquearAba = true;
    }

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

        let contagem = 0;

        let mensagem = '';

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
                mensagem += `[PULADO] Prestador ${nomePrestador} não possui relatório para ${mesAno}\n`;
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
                const urlRelatorio = new URL(form.action, window.location.href);
                urlRelatorio.search = params.toString();

                linksPDF.push({ prestador: nomePrestador, pdfUrl: urlRelatorio.toString() });
                contagem++;
            }
            catch (error) {
                mensagem += `erro ao gerar relatório do prestador ${nomePrestador}: ${error}\n`;
            }
        }
        console.log(linksPDF)
        await enviarEmails(`${contagem} relatórios gerados com sucesso\n${mensagem}`)
        await enviarParaPlanilhas(linksPDF);
        criaBotao();
    }

    /**
     * @typedef linkPrestador
     * @property {string} pdfUrl
     * @property {string} prestador
     */

    /**
     * envia para a planilha API para que ela possa registrar os valores na planilha PSC e enviar os pdfs para o drive
     * @param {linkPrestador[]} links 
     */
    async function enviarParaPlanilhas(links) {
        const url = "https://script.google.com/macros/s/AKfycbxH4GeMfR5z0deOlwgFOpvlEY9LLKAzj921hYuEOgM4pt-oc7ce5sviMQxhqnzMP914/exec";
        const formData = new FormData();
        formData.append("relatoriosEproc", JSON.stringify(links));
        try {
            await fetch(url, { method: 'POST', body: formData });
            alert('Relatórios enviados para o Drive com sucesso.');
        } catch (error) {
            await enviarEmails("Erro ao enviar para planilha eproc: " + error);
        }
    }

    /**
    * Envia mensagens automáticas por e-mail para registrar erros ocorridos na aplicação.
    * @param {string} mensagem - Texto da mensagem a ser enviada.
    */
    async function enviarEmails(mensagem) {
        const date = new Date();
        const dateStr = `${date.getHours()}:${date.getMinutes()}:${date.getSeconds()} - ${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`;
        const param = {
            message: mensagem,
            time: dateStr
        };

        console.log('enviando email de aviso para "prfoz04@gmail.com"');

        try {
            const emailjsApi = await garantirEmailJs();
            await emailjsApi.send('service_g087904', 'template_3zyi2h5', param);
            console.log('E-mail enviado com sucesso.');
        } catch (err) {
            console.error('Falha ao enviar e-mail via EmailJS:', err);
        }
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
        // @ts-ignore
        if (window.$ || window.jQuery) {
            // @ts-ignore
            (window.$ || window.jQuery)(selectElement).trigger('change');
        }
    }

    /** 
     * @param {HTMLSelectElement} elemento 
     */
    function forcarChange(elemento) {
        elemento.dispatchEvent(new Event('change', { bubbles: true }));
        // @ts-ignore
        if (typeof window.jQuery !== 'undefined') {
            // @ts-ignore
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

    /**
     * normaliza de forma robusta os meses
     * @param {string} valor 
     * @returns {string}
     */
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

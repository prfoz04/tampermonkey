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

    const ID_FORM = '#frmConsulta';

    const ID_MES = '#cmbMesAno';

    //value necessário para fazer a requisição da geração de relatório
    const CMB_VARA = await aguardarSelect(ID_SELECT_VARA, option => option.textContent.includes('Foz do Iguaçu') && option.textContent.includes('4'));

    const CMB_PRESTADORES = await aguardarSelect(ID_SELECT_PRESTADORES);

    //vazia pois não queremos filtrar por entidade
    const CMB_ENTIDADE = " ";

    const DATE = new Date();

    /**
     * itera sobre os prestadores capturando os formulários
     * @param {string} mesAno
     */
    async function gerar(mesAno) {
        if (mesAno === 'Selecione')
            return;
        console.log(`Gerando relatórios para o mês ${mesAno}`);
        //predefine a vara por garantia
        // @ts-ignore
        document.querySelector(ID_SELECT_VARA).value + CMB_VARA[0];
        /**
         * @type {HTMLSelectElement}
         */
        var selectPrestadores = document.querySelector(ID_SELECT_PRESTADORES);
        /**
         * @type {HTMLFormElement}
         */
        var form = document.querySelector(ID_FORM);
        var linksPDF = [];
        //itera sobre os prestadores utilizando o proprio forms da pagina
        for (let value of CMB_PRESTADORES) {
            selectPrestadores.value = value;
            selectPrestadores.dispatchEvent(new Event('change'));
            var mesesCumpridos = await aguardarSelect(ID_MES);
            var nomePrestador = selectPrestadores.options[selectPrestadores.selectedIndex].text;
            if (!mesesCumpridos[0] || mesesCumpridos.indexOf(mesAno) === -1) {
                continue;
            }
            // @ts-ignore
            document.querySelector(ID_MES).value = mesAno;

            const formData = new FormData(form);
            // @ts-ignore
            const params = new URLSearchParams(formData)
            try {
                const response = await fetch(form.action, {
                    method: form.method || 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: params.toString(),
                });
                if (response.url.endsWith('.pdf') || response.headers.get('content-type')?.includes('application/pdf')) {
                    linksPDF.push({ prestador: nomePrestador, pdfUrl: response.url });
                }
            }
            catch (error) {
                console.error(`erro ao gerar relatório do prestador ${nomePrestador}: ${error}`);
            }
        }
        baixarPDFs(linksPDF, mesAno);
        criaBotao();
    }

    /**
    * Baixa uma lista de objetos contendo { prestador, pdfUrl }
    * @param {Array<{prestador: string, pdfUrl: string}>} listaPDFs 
    * @param {string} mesAno 
    */
    function baixarPDFs(listaPDFs, mesAno) {
        if (!listaPDFs || listaPDFs.length === 0) {
            console.warn('Nenhum PDF para baixar.');
            return;
        }

        // Sanatiza a string mesAno para usar no nome do arquivo (ex: "05-2026")
        const mesAnoFormatado = mesAno.replace('/', '-').replace(/\s+/g, '');

        listaPDFs.forEach((item, index) => {
        // Nome limpo do arquivo
        const nomeArquivo = `Relatorio_${item.prestador}_${mesAnoFormatado}.pdf`;

        // Pequeno atraso (staggering) entre os downloads para evitar bloqueios do navegador
        setTimeout(() => {
            console.log(`Baixando: ${nomeArquivo}...`);

            GM_download({
                url: item.pdfUrl,
                name: nomeArquivo,
                onload: () => {
                    console.log(`[OK] Download concluído: ${nomeArquivo}`);
                },
                onerror: (err) => {
                    console.error(`[ERRO] Falha ao baixar ${nomeArquivo}:`, err);
                }
            });

            }, index * 1000); // Aguarda 1 segundo entre cada download
        });
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
                const options = select.querySelectorAll('option');
                //espera ter algo além da opção vazia
                if (options.length > 1) {
                    clearInterval(interval);
                    let respostas = Array.from(options);
                    if (filtro)
                        respostas = respostas.filter(filtro);
                    respostas = respostas.filter(option => option.value && option.value !== ' ' && option.value !== 'Selecione');
                    response(respostas.map(option => option.value));
                }
                if (options.length === 1 && (!options[0].value || options[0].value.trim() === 'null')) {
                    clearInterval(interval);
                    response([]);
            }
            }, 300) //tempo de checagem
        })
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

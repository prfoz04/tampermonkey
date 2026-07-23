// ==UserScript==
// @name         eproc - Geração de relatórios mensais
// @namespace    https://github.com/4Vara
// @version      1.0.7
// @description  Gera automaticamente os relatórios do último mês registrado para todos os prestadores no eproc.
// @author       Leonardo
// @match        https://eproc.jfpr.jus.br/eprocV2/controlador.php?acao=relatorio_diario_cumprimento_pena*
// @updateURL    https://raw.githubusercontent.com/prfoz04/tampermonkey/eproc/geracao-de-relatorios/src/geracao-de-relatorios.user.js
// @downloadURL  https://raw.githubusercontent.com/prfoz04/tampermonkey/eproc/geracao-de-relatorios/src/geracao-de-relatorios.user.js
// @run-at       document-idle
// ==/UserScript==

(async function () {
    'use strict';
    console.log('[eproc - geração de relatórios] script iniciado.');

    const ID_SELECT_PRESTADORES = '#cmbPrestador';

    const ID_SELECT_VARA = '#cmbVara';

    const ID_FORM = '#frmConsulta';

    //value necessário para fazer a requisição da geração de relatório
    const CMB_VARA = await aguardarSelect(ID_SELECT_VARA, option => option.textContent.includes('Foz do Iguaçu') && option.textContent.includes('4'));

    const CMB_PRESTADORES = await aguardarSelect(ID_SELECT_PRESTADORES);

    //vazia pois não queremos filtrar por entidade
    const CMB_ENTIDADE = " ";

    function gerar() {

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
                    let prestadores = Array.from(options);
                    if (filtro)
                        prestadores = prestadores.filter(filtro);
                    response(prestadores.map(option => option.value));
                }
            }, 300) //tempo de checagem
        })
    }

    function criaBotao() {
        const div = document.querySelector(ID_FORM);
        const botao = document.createElement('button');
        botao.className = 'eproc-button-primary'
        botao.onclick = gerar;
        botao.value = 'Gerar todos os relatórios';
        div.appendChild(botao);
    }

    criaBotao();

})();

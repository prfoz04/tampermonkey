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

    const MES_STR = DATE.getMonth() + 1 < 10 ? `0${(DATE.getMonth()+1).toString()}` : (DATE.getMonth()+1).toString();

    const ANO_STR = DATE.getFullYear().toString();

    async function gerar() {
        console.log(`Gerando relatórios par o mês ${MES_STR}/${ANO_STR}`);
        document.querySelector(ID_SELECT_VARA).value + CMB_VARA[0];
        const selectPrestadores = document.querySelector(ID_SELECT_PRESTADORES);
        selectPrestadores.value = CMB_PRESTADORES[0];
        selectPrestadores.dispatchEvent(new Event('change'));
        const selectMesAno = document.querySelector(ID_MES);
        const mesano = await aguardarSelect(ID_MES);
        console.log(mesano)
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
                if (!options[0].value) {
                    clearInterval(interval);
                    response(null);
                }
            }, 300) //tempo de checagem
        })
    }

    function criaBotao() {
        const div = document.querySelector(ID_FORM);
        const botao = document.createElement('button');
        botao.className = 'eproc-button-primary'
        botao.type = 'button'
        botao.onclick = gerar;
        botao.textContent = 'Gerar todos os relatórios'
        div.appendChild(botao);
    }

    criaBotao();

})();

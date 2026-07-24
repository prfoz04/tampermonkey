// ==UserScript==
// @name         eproc - Geração de relatórios mensais
// @namespace    https://github.com/4Vara
// @version      1.0.9
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

    const CMB_VARA = await aguardarSelect(ID_SELECT_VARA, option => option.textContent.includes('Foz do Iguaçu') && option.textContent.includes('4'));
    const CMB_PRESTADORES = await aguardarSelect(ID_SELECT_PRESTADORES);

    const DATE = new Date();

    async function gerar(mesAno) {
        if (mesAno === 'Selecione') return;
        console.log(`Gerando relatórios para o mês ${mesAno}`);

        // 1. CORREÇÃO DA ATRIBUIÇÃO DA VARA: = ao invés de +
        const selectVara = document.querySelector(ID_SELECT_VARA);
        if (selectVara && CMB_VARA && CMB_VARA[0]) {
            forcarTrocaSelect(selectVara, CMB_VARA[0]);
        }

        const selectPrestadores = document.querySelector(ID_SELECT_PRESTADORES);
        const form = document.querySelector(ID_FORM);
        const linksPDF = [];

        for (let value of CMB_PRESTADORES) {
            forcarTrocaSelect(selectPrestadores, value);
            
            const mesesCumpridos = await aguardarSelect(ID_MES);
            const nomePrestador = selectPrestadores.options[selectPrestadores.selectedIndex]?.text || value;

            if (!mesesCumpridos || mesesCumpridos.length === 0 || !mesesCumpridos.includes(mesAno)) {
                continue;
            }

            const selectMes = document.querySelector(ID_MES);
            const opcaoCorrespondente = Array.from(selectMes.options).find(opt => {
                const textoOption = opt.textContent.trim();
                const valorOption = opt.value.trim();
                const mesProcurado = mesAno.trim();
                return textoOption === mesProcurado || valorOption === mesProcurado;
            });

            if (!opcaoCorrespondente) {
                console.log(`[PULADO] Prestador ${nomePrestador} não possui relatório para ${mesAno}`);
                continue;
            }

            // Seleciona o mês no DOM
            forcarTrocaSelect(selectMes, opcaoCorrespondente.value);

            // 2. CONSTRUÇÃO MANUAL DO PAYLOAD
            const formData = new FormData(form);
            const params = new URLSearchParams(formData);

            // Força a inclusão do botão de pesquisa exigido pelo PHP do eproc
            params.append('btnPesquisar', 'Gerar Relatório');
            
            // Garante sobrescrita exata dos seletores principais
            params.set('cmbVara', selectVara.value);
            params.set('cmbPrestador', value);
            params.set('cmbMesAno', opcaoCorrespondente.value);

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
            } catch (error) {
                console.error(`Erro ao gerar relatório do prestador ${nomePrestador}: ${error}`);
            }
        }

        baixarPDFs(linksPDF.filter(obj => obj.prestador.includes('PICCOLI')), mesAno);
        criaBotao();
    }

    function forcarTrocaSelect(selectElement, valor) {
        if (!selectElement) return;
        selectElement.value = valor;
        
        Array.from(selectElement.options).forEach(opt => {
            opt.selected = (opt.value === valor);
        });

        selectElement.dispatchEvent(new Event('change', { bubbles: true }));
        if (typeof window.jQuery !== 'undefined') {
            window.jQuery(selectElement).trigger('change');
        }
    }

    function baixarPDFs(listaPDFs, mesAno) {
        if (!listaPDFs || listaPDFs.length === 0) {
            console.warn('Nenhum PDF para baixar.');
            return;
        }
        const mesAnoFormatado = mesAno.replace('/', '-').replace(/\s+/g, '');
        listaPDFs.forEach((item, index) => {
            const nomeArquivo = `Relatorio_${item.prestador}_${mesAnoFormatado}.pdf`;
            setTimeout(() => {
                GM_download({
                    url: item.pdfUrl,
                    name: nomeArquivo,
                    onerror: (err) => {
                        console.error(`[ERRO] Falha ao baixar ${nomeArquivo}:`, err);
                    }
                });
            }, index * 1000);
        });
    }

    async function aguardarSelect(idSelect, filtro = null) {
        return new Promise((response) => {
            const interval = setInterval(() => {
                const select = document.querySelector(idSelect);
                if (!select) return;

                const options = select.querySelectorAll('option');
                if (options.length > 1) {
                    clearInterval(interval);
                    let respostas = Array.from(options);
                    if (filtro) respostas = respostas.filter(filtro);
                    respostas = respostas.filter(option => option.value && option.value !== ' ' && option.value !== 'Selecione');
                    response(respostas.map(option => option.value));
                }
                if (options.length === 1 && (!options[0].value || options[0].value.trim() === 'null')) {
                    clearInterval(interval);
                    response([]);
                }
            }, 300);
        });
    }

    function criaBotao() {
        if (document.querySelector('#gerar-tudo')) return;
        const div = document.querySelector(ID_FORM);
        const botao = document.createElement('button');
        botao.className = 'eproc-button-primary';
        botao.type = 'button';
        botao.onclick = criarInput;
        botao.id = 'gerar-tudo';
        botao.textContent = 'Gerar todos os relatórios';
        div.appendChild(botao);
    }

    function criarInput() {
        const btn = document.querySelector('#gerar-tudo');
        if (btn) btn.remove();
        
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
                select.appendChild(criarOption(`${mes < 10 ? "0" + mes : mes} / ${ano}`));
            }
        }
        div.appendChild(select);
    }

    function criarOption(text) {
        const option = document.createElement('option');
        option.value = text;
        option.textContent = text;
        return option;
    }

    criaBotao();
})();
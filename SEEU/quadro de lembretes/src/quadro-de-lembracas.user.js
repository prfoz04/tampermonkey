// ==UserScript==
// @name         SEEU - Quadro de Lembretes Detalhado (post-it)
// @namespace    https://github.com/4Vara
// @version      1.3
// @description  Exibe lembretes no estilo post-it, clicáveis para abrir o detalhe
// @match        https://seeu.pje.jus.br/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      seeu.pje.jus.br
// ==/UserScript==

/*
 * Este script transforma os lembretes do SEEU em cards visuais tipo post-it,
 * carregando os detalhes de cada lembrete em segundo plano para facilitar a leitura.
 * A lógica de coleta e apresentação do conteúdo permanece preservada.
 */

(function() {
    'use strict';

    /**
     * Abrevia um nome completo para o primeiro e o último nome.
     * @param {string} nomeCompleto O nome a ser abreviado.
     * @returns {string} O nome abreviado.
     */
    function abreviarNome(nomeCompleto) {
        if (!nomeCompleto || typeof nomeCompleto !== 'string') {
            return 'Desconhecido';
        }
        const partes = nomeCompleto.trim().split(/\s+/);
        // Retorna o nome original se tiver 2 palavras ou menos
        if (partes.length <= 2) {
            return nomeCompleto;
        }
        // Retorna o primeiro e o último nome
        return `${partes[0]} ${partes[partes.length - 1]}`;
    }


    // --- estilo post-it (esconde lista original) ---
    GM_addStyle(`
        /* Esconde a tabela de lembretes original, mas mantém o título */
        #quadroLembretes {
            border: none;
            padding: 0;
            margin-bottom: 10px;
        }
        #quadroLembretes > table.form {
            display: none !important;
        }

        /* container de post-its */
        #quadroLembretesVisual {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 12px;
            padding: 10px;
            margin-top: 10px;
            max-width: 1200px;
        }

        /* post-it */
        #quadroLembretesVisual .lembrete {
            background: #fff79a;
            padding: 12px;
            border: 1px solid #e0e0a3;
            box-shadow: 2px 2px 6px rgba(0,0,0,0.18);
            border-radius: 6px;
            font-family: Arial, sans-serif;
            display: flex;
            flex-direction: column;
            min-height: 140px;
            overflow: hidden;
            cursor: pointer;
            transition: transform 0.2s, box-shadow 0.2s;
        }

        #quadroLembretesVisual .lembrete:hover {
            transform: translateY(-3px);
            box-shadow: 3px 6px 12px rgba(0,0,0,0.25);
        }

        #quadroLembretesVisual .lembrete h3 {
            margin: 0 0 8px 0;
            font-size: 14px;
            font-weight: bold;
            text-align: left;
            color: #3F577B;
            line-height: 1.2;
            white-space: pre-wrap; /* Adicionado para suportar quebras de linha no título */
        }

        #quadroLembretesVisual .lembrete .conteudo {
            flex: 1 1 auto;
            display: flex;
            align-items: center;
            justify-content: flex-start;
            text-align: justify;
            font-size: 13px;
            margin: 0 0 8px 0;
            word-break: break-word;
            white-space: pre-wrap;
            padding-right: 6px;
        }

        #quadroLembretesVisual .lembrete .criador {
            background: none !important;
            padding: 12px 0 0 0 !important;
            margin: auto 0 2px 0;
            font-weight: 600;
            color: #3F577B;
            font-size: 11.5px;
            line-height: 1.2;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            text-align: left;
            width: 100%;
        }

        #quadroLembretesVisual .lembrete .ativacao {
            background: none !important;
            padding: 0 !important;
            margin: 0;
            color: #666;
            font-weight: 400;
            font-size: 11px;
            line-height: 1.2;
            text-align: left;
            width: 100%;
        }
    `);

    // --- busca painel original ---
    const fieldset = document.querySelector('#quadroLembretes');
    if (!fieldset) return;

    // cria quadro visual (post-its)
    const visualBox = document.createElement('div');
    visualBox.id = 'quadroLembretesVisual';
    fieldset.parentNode.insertBefore(visualBox, fieldset.nextSibling);

    // seleciona os <em> dentro dos links (evita links "Desativar")
    const ems = fieldset.querySelectorAll('a.link > em');
    ems.forEach(em => {
        const link = em.closest('a');
        if (!link) return;

        const detailUrl = new URL(link.getAttribute('href'), location.origin).href;

        // tenta extrair ativação diretamente
        const tr = em.closest('tr');
        const nextTr = tr?.nextElementSibling;
        let ativacao = null;
        if (nextTr) {
            const spanInfo = nextTr.querySelector('span');
            if (spanInfo) {
                const m = spanInfo.textContent.match(/Ativado em\s*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/);
                if (m) ativacao = m[1];
            }
        }

        // cria o post-it
        const lembreteDiv = document.createElement('div');
        lembreteDiv.className = 'lembrete';

        // torna o post-it clicável
        lembreteDiv.addEventListener('click', () => {
            window.open(detailUrl, '_blank');
        });

        const tituloEl = document.createElement('h3');
        // Substitui o caractere "|" por uma quebra de linha no título
        tituloEl.textContent = em.textContent.trim().replace(/\|/g, '\n');

        const conteudoEl = document.createElement('div');
        conteudoEl.className = 'conteudo';
        conteudoEl.textContent = 'Carregando...';

        const criadorEl = document.createElement('div');
        criadorEl.className = 'criador';
        criadorEl.textContent = 'Carregando...';

        const ativacaoEl = document.createElement('div');
        ativacaoEl.className = 'ativacao';
        ativacaoEl.textContent = ativacao || 'Carregando...';

        lembreteDiv.appendChild(tituloEl);
        lembreteDiv.appendChild(conteudoEl);
        lembreteDiv.appendChild(criadorEl);
        lembreteDiv.appendChild(ativacaoEl);
        visualBox.appendChild(lembreteDiv);

        // requisita detalhe (conteúdo + criador)
        GM_xmlhttpRequest({
            method: 'GET',
            url: detailUrl,
            onload: function(res) {
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(res.responseText, 'text/html');
                    const conteudoContainer = doc.querySelector('.tabelaImpressao');
                    let conteudo = 'Sem conteúdo';

                    if (conteudoContainer) {
                        let html = conteudoContainer.innerHTML;


                        html = html.replace(/<br\s*\/?>/gi, '\n');
                        html = html.replace(/<\/(p|div)>/gi, '\n');
                        html = html.replace(/<[^>]*>/g, '');


                        const txtArea = document.createElement('textarea');
                        txtArea.innerHTML = html;
                        conteudo = txtArea.value.trim();
                    }

                    if (!conteudo) {
                        conteudo = 'Sem conteúdo';
                    }


                    let infoNome = null;
                    let infoData = null;
                    let labelNome = 'Criador';
                    let labelData = 'Criação';

                    const trs = Array.from(doc.querySelectorAll('tr'));

                    // 1. Tenta encontrar a linha de "Última Alteração" de forma mais robusta.
                    //    Verifica o texto dentro do primeiro <td> da linha, que é mais confiável.
                    let targetRow = trs.find(tr => {
                        const firstTd = tr.querySelector('td');
                        return firstTd && firstTd.textContent.trim().toLowerCase().includes('última alteração');
                    });

                    if (targetRow) {
                        labelNome = 'Alterado por';
                        labelData = 'Alterado em';
                    } else {
                        // 2. Fallback: Se não encontrou, busca a linha de "Criação".
                        targetRow = trs.find(tr => {
                            const firstTd = tr.querySelector('td');
                            return firstTd && firstTd.textContent.trim().toLowerCase().includes('criação');
                        });
                    }

                    // 3. Se encontrou uma linha (de alteração ou criação), extrai os dados dela.
                    if (targetRow) {
                        const tds = Array.from(targetRow.querySelectorAll('td'));
                        // A data é o conteúdo do segundo <td>
                        if (tds[1]) {
                            infoData = tds[1].textContent.trim().split(' ')[0];
                        }
                        // O nome é o conteúdo do quarto <td>
                        if (tds[3]) {
                            infoNome = tds[3].textContent.replace(/\s*\([^)]+\)\s*/g, '').replace(/\s+/g, ' ').trim();
                        }
                    }

                    if (!infoNome) infoNome = 'Desconhecido';

                    // --- Atualiza a UI (Interface do Usuário) com os dados encontrados ---
                    const nomeAbreviado = abreviarNome(infoNome);
                    conteudoEl.textContent = conteudo;
                    criadorEl.textContent = `${labelNome}: ${nomeAbreviado}`;
                    ativacaoEl.textContent = `${labelData}: ${infoData || 'Sem data'}`;

                } catch (err) {
                    conteudoEl.textContent = 'Erro ao carregar conteúdo';
                    criadorEl.textContent = 'Erro';
                    ativacaoEl.textContent = '';
                }
            },
            onerror: function() {
                conteudoEl.textContent = 'Erro na requisição';
                criadorEl.textContent = 'Erro';
                ativacaoEl.textContent = '';
            }
        });
    });
})();



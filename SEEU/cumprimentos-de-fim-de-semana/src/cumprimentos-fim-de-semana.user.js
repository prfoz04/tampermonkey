// ==UserScript==
// @name         SEEU - Cumprimentos de Fim de Semana
// @namespace    https://github.com/4Vara
// @version      1.0
// @author       Scheeee
// @description  Preenche datas de fim de semana com validação, salvando e abrindo próximo automaticamente.
// @match        https://seeu.pje.jus.br/seeu/processo/criminal/medidaAlternativa.do*
// @match        https://seeu.pje.jus.br/seeu/processo/criminal/cumprimentoMedida.do*
// @grant        none
// ==/UserScript==

/*
 * Este script preenche datas de fim de semana para o fluxo de medidas alternativas,
 * valida entradas e continua a automação automaticamente quando necessário.
 * A lógica de preenchimento e controle de estado foi preservada.
 */

(function () {
  'use strict';

  const KEY_DATAS  = 'seeu_fimsemana_datas_str';
  const KEY_INDEX  = 'seeu_fimsemana_index';
  const KEY_STOP   = 'seeu_stop_execution';

  // --------- valida data ---------
  /**
   * Valida uma data no formato brasileiro dd/mm/aaaa.
   * @param {string} str Data a ser validada.
   * @returns {boolean} Indica se a data é válida.
   */
  function isValidDateBR(str) {
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(str)) return false;

    const [dd, mm, yyyy] = str.split('/').map(Number);

    if (yyyy < 1900 || yyyy > 2100) return false;
    if (mm < 1 || mm > 12) return false;

    const date = new Date(yyyy, mm - 1, dd);

    return (
      date.getFullYear() === yyyy &&
      date.getMonth() === mm - 1 &&
      date.getDate() === dd
    );
  }

  // --------- máscara de data enquanto digita (dd/mm/aaaa) ---------
  /**
   * Aplica máscara de data em tempo real ao campo digitado.
   * @param {InputEvent} e Evento de entrada do input.
   */
  function mascararData(e) {
    let v = e.target.value.replace(/\D/g, '');
    if (v.length > 8) v = v.slice(0, 8);

    if (v.length > 4) {
      v = v.slice(0, 4) + '/' + v.slice(4);
    }
    if (v.length > 2) {
      v = v.slice(0, 2) + '/' + v.slice(2);
    }

    e.target.value = v;
  }

  // --------- espera elemento ---------
  /**
   * Aguarda um seletor existir na página.
   * @param {string} selector Seletor CSS a ser observado.
   * @param {(element: Element) => void} callback Função executada quando o elemento é encontrado.
   * @param {number} [interval=300] Intervalo em milissegundos entre as tentativas.
   * @param {number} [timeout=10000] Tempo máximo de espera em milissegundos.
   */
  function waitFor(selector, callback, interval = 300, timeout = 10000) {
    const start = Date.now();
    const timer = setInterval(() => {
      const el = document.querySelector(selector);
      if (el) {
        clearInterval(timer);
        callback(el);
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
      }
    }, interval);
  }

  // --------- calcula sábados e domingos ---------
  /**
   * Gera as datas de fim de semana dentro de um intervalo.
   * @param {Date} startDate Data inicial do período.
   * @param {Date} endDate Data final do período.
   * @returns {string[]} Lista de datas no formato dd/mm/aaaa.
   */
  function getWeekendDates(startDate, endDate) {
    const dates = [];
    let current = new Date(startDate);
    while (current <= endDate) {
      const day = current.getDay();
      if (day === 0 || day === 6) {
        const dd = String(current.getDate()).padStart(2, '0');
        const mm = String(current.getMonth() + 1).padStart(2, '0');
        const yyyy = current.getFullYear();
        dates.push(`${dd}/${mm}/${yyyy}`);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  // --------- seta valor no input igual ao console ---------
  /**
   * Define um valor em um input e dispara os eventos de alteração.
   * @param {string} elementId ID do elemento alvo.
   * @param {string} value Valor a ser preenchido.
   * @returns {HTMLElement|null} Elemento preenchido ou null caso não exista.
   */
  function setDateValue(elementId, value) {
    const el = document.getElementById(elementId);
    if (!el) {
      console.error('[SEEU-FIMSEMANA] Campo não encontrado:', elementId);
      return null;
    }

    try {
      el.focus();
      el.value = ''; // limpa
      el.dispatchEvent(new Event('input', { bubbles: true }));

      el.value = value; // define igual ao console
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      el.dispatchEvent(new Event('blur', { bubbles: true }));

      console.log('[SEEU-FIMSEMANA] Valor definido em #' + elementId + ':', el.value);
      return el;
    } catch (e) {
      console.error('[SEEU-FIMSEMANA] Erro ao definir valor no campo:', e);
      return null;
    }
  }

  // --------- continua automação na tela principal, se houver pendências ---------
  function continuarSePendentesNaTelaPrincipal() {
    try {
      if (localStorage.getItem(KEY_STOP) === 'true') return;

      const datasStr = localStorage.getItem(KEY_DATAS);
      const indexStr = localStorage.getItem(KEY_INDEX);

      if (!datasStr || indexStr === null) return;

      const datas = datasStr.split('|').filter(Boolean);
      let index = parseInt(indexStr, 10);

      if (!datas.length || isNaN(index) || index >= datas.length) return;

      const addBtn = document.querySelector('#addButton');
      if (!addBtn) {
        console.log('[SEEU-FIMSEMANA] Botão #addButton não encontrado para continuar automaticamente.');
        return;
      }

      console.log('[SEEU-FIMSEMANA] Reabrindo popup automaticamente para índice:', index);
      addBtn.click();
    } catch (e) {
      console.error('[SEEU-FIMSEMANA] Erro em continuarSePendentesNaTelaPrincipal:', e);
    }
  }

  // =================== TELA PRINCIPAL: medidaAlternativa ===================
  if (location.href.includes('medidaAlternativa.do')) {
    waitFor('table.form', tabela => {
      try {
        // Evita duplicar a linha
        if (document.getElementById('fsRowFimSemana')) {
          continuarSePendentesNaTelaPrincipal();
          return;
        }

        const rows = tabela.querySelectorAll('tr');
        let trPrimeiraApresentacao = null;

        for (const tr of rows) {
          const tdLabel = tr.querySelector('td.label');
          if (!tdLabel) continue;

          const dataLabel = tdLabel.getAttribute('data-label') || '';
          const texto = (tdLabel.textContent || '').trim().toLowerCase();

          if (
            dataLabel.toLowerCase() === 'primeira apresentação' ||
            texto.startsWith('primeira apresentação')
          ) {
            trPrimeiraApresentacao = tr;
            break;
          }
        }

        if (!trPrimeiraApresentacao) {
          console.log('[SEEU-FIMSEMANA] TR "Primeira Apresentação" não encontrada. Não será criada a UI.');
          return;
        }

        const novaTr = document.createElement('tr');
        novaTr.id = 'fsRowFimSemana';

        const tdLabel = document.createElement('td');
        tdLabel.className = 'label';
        tdLabel.textContent = 'Cumprimentos Fim de Semana:';

        const tdConteudo = document.createElement('td');

        const div = document.createElement('div');
        Object.assign(div.style, {
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '4px',
          fontSize: '11px'
        });

        // Campo Data inicial
        const spanInicio = document.createElement('span');
        spanInicio.textContent = 'Início:';
        const inputInicio = document.createElement('input');
        inputInicio.type = 'text';
        inputInicio.id = 'fsDataInicio';
        inputInicio.placeholder = 'dd/mm/aaaa';
        Object.assign(inputInicio.style, {
          width: '80px',
          padding: '2px 4px',
          fontSize: '11px'
        });

        // Campo Data final
        const spanFim = document.createElement('span');
        spanFim.textContent = 'Fim:';
        const inputFim = document.createElement('input');
        inputFim.type = 'text';
        inputFim.id = 'fsDataFim';
        inputFim.placeholder = 'dd/mm/aaaa';
        Object.assign(inputFim.style, {
          width: '80px',
          padding: '2px 4px',
          fontSize: '11px'
        });

        // Máscara de data nos dois inputs
        inputInicio.addEventListener('input', mascararData);
        inputFim.addEventListener('input', mascararData);

        // Botão iniciar fluxo (mais discreto)
        const btn = document.createElement('input');
        btn.type = 'button';
        btn.value = 'Adicionar';
        btn.id = 'btnFinsDeSemana';
        btn.className = 'button';
        Object.assign(btn.style, {
          backgroundColor: '#007bff',
          color: 'white',
          fontSize: '10px',
          padding: '2px 6px',
          whiteSpace: 'nowrap'
        });

        // Botão reset (mais discreto)
        const btnReset = document.createElement('input');
        btnReset.type = 'button';
        btnReset.value = 'Parar/Limpar';
        btnReset.className = 'button';
        Object.assign(btnReset.style, {
          backgroundColor: '#dc3545',
          color: 'white',
          fontSize: '10px',
          padding: '2px 6px',
          whiteSpace: 'nowrap'
        });

        div.appendChild(spanInicio);
        div.appendChild(inputInicio);
        div.appendChild(spanFim);
        div.appendChild(inputFim);
        div.appendChild(btn);
        div.appendChild(btnReset);

        tdConteudo.appendChild(div);
        novaTr.appendChild(tdLabel);
        novaTr.appendChild(tdConteudo);

        // Insere a nova TR logo depois da TR de Primeira Apresentação
        if (trPrimeiraApresentacao.nextSibling) {
          trPrimeiraApresentacao.parentNode.insertBefore(novaTr, trPrimeiraApresentacao.nextSibling);
        } else {
          trPrimeiraApresentacao.parentNode.appendChild(novaTr);
        }

        // Kill switch
        btnReset.addEventListener('click', () => {
          localStorage.removeItem(KEY_DATAS);
          localStorage.removeItem(KEY_INDEX);
          localStorage.setItem(KEY_STOP, 'true');
          alert('🛑 Automação INTERROMPIDA e memória limpa.');
        });

        // Iniciar fluxo usando os campos da nova TR
        btn.addEventListener('click', () => {
          try {
            localStorage.removeItem(KEY_STOP);
            localStorage.removeItem(KEY_DATAS);
            localStorage.removeItem(KEY_INDEX);

            const start = (inputInicio.value || '').trim();
            const end   = (inputFim.value || '').trim();

            if (!start || !end) {
              alert('Preencha as duas datas (início e fim).');
              return;
            }

            if (!isValidDateBR(start)) {
              alert('Data inicial inválida. Use o formato dd/mm/aaaa e uma data real.');
              inputInicio.focus();
              return;
            }

            if (!isValidDateBR(end)) {
              alert('Data final inválida. Use o formato dd/mm/aaaa e uma data real.');
              inputFim.focus();
              return;
            }

            const [d1, m1, y1] = start.split('/').map(Number);
            const [d2, m2, y2] = end.split('/').map(Number);

            const startDate = new Date(y1, m1 - 1, d1);
            const endDate   = new Date(y2, m2 - 1, d2);

            if (startDate > endDate) {
              alert('A data inicial não pode ser maior que a data final.');
              inputInicio.focus();
              return;
            }

            let lista = getWeekendDates(startDate, endDate).filter(isValidDateBR);

            if (!lista.length) {
              alert('Nenhum sábado/domingo válido no intervalo.');
              return;
            }

            // Guarda como string simples, separada por "|"
            const str = lista.join('|');
            localStorage.setItem(KEY_DATAS, str);
            localStorage.setItem(KEY_INDEX, '0');

            // Resumo
            alert(
              '📅 Fins de semana encontrados:\n\n' +
              lista.map((d, i) => `${i + 1}. ${d}`).join('\n') +
              `\n\nTotal: ${lista.length} datas.\nO primeiro popup será aberto agora.`
            );

            const addBtn = document.querySelector('#addButton');
            if (addBtn) {
              addBtn.click(); // abre o PRIMEIRO popup
            } else {
              alert('Botão "Adicionar" (#addButton) não encontrado.');
            }

          } catch (error) {
            alert(`Erro: ${error.message}`);
          }
        });

        // Se já havia uma lista em andamento, continua automaticamente
        continuarSePendentesNaTelaPrincipal();
      } catch (e) {
        console.error('[SEEU-FIMSEMANA] Erro ao montar TR de Fim de Semana:', e);
      }
    });
  }

  // =================== POPUP: cumprimentoMedida ===================
  if (location.href.includes('cumprimentoMedida.do')) {

    if (localStorage.getItem(KEY_STOP) === 'true') {
      console.log('[SEEU-FIMSEMANA] Execução abortada pelo usuário.');
      return;
    }

    const datasStr = localStorage.getItem(KEY_DATAS);
    const indexStr = localStorage.getItem(KEY_INDEX);

    if (!datasStr || indexStr === null) {
      console.log('[SEEU-FIMSEMANA] Sem lista de datas ou índice. Nada a fazer.');
      return;
    }

    const datas = datasStr.split('|').filter(Boolean);
    let index = parseInt(indexStr, 10);

    if (!datas.length) {
      alert('[SEEU] Lista de datas vazia. Execução interrompida.');
      localStorage.setItem(KEY_STOP, 'true');
      return;
    }

    if (index >= datas.length) {
      console.log('[SEEU-FIMSEMANA] Lista concluída (index >= datas.length).');
      localStorage.removeItem(KEY_DATAS);
      localStorage.removeItem(KEY_INDEX);
      alert('✅ Todas as datas de fim de semana já foram preenchidas.\nAgora é só conferir o histórico.');
      return;
    }

    const dataAtual = datas[index];

    if (!isValidDateBR(dataAtual)) {
      alert(
        '[SEEU] Data inválida detectada na lista!\n\n' +
        'Valor: ' + dataAtual + '\n\n' +
        'Execução interrompida para segurança.'
      );
      console.error('[SEEU-FIMSEMANA] Data inválida na lista:', dataAtual);
      localStorage.setItem(KEY_STOP, 'true');
      return;
    }

    console.log('[SEEU-FIMSEMANA] Inserindo data:', dataAtual);

    waitFor('#dataCumprimento', input => {
      if (localStorage.getItem(KEY_STOP) === 'true') return;

      input.style.backgroundColor = '#fff3cd';
      input.style.border = '3px solid orange';

      const campo = setDateValue('dataCumprimento', dataAtual);
      if (!campo) {
        input.style.backgroundColor = '#f8d7da';
        input.style.border = '4px solid red';
        alert('[SEEU] Não foi possível definir o valor no campo de data.\nExecução interrompida.');
        localStorage.setItem(KEY_STOP, 'true');
        return;
      }

      setTimeout(() => {
        if (localStorage.getItem(KEY_STOP) === 'true') return;

        const valorCampo = campo.value ? campo.value.trim() : '';

        // Validação estrita + validação real da data
        if (!valorCampo || valorCampo !== dataAtual || !isValidDateBR(valorCampo)) {
          campo.style.backgroundColor = '#f8d7da';
          campo.style.border = '4px solid red';
          console.error('[SEEU-FIMSEMANA] ERRO de validação. Esperado:', dataAtual, 'Campo:', valorCampo);
          alert(
            '[SEEU] Erro de validação na data!\n\n' +
            'Esperado: ' + dataAtual + '\n' +
            'Campo:   ' + valorCampo + '\n\n' +
            'A máscara ou validação do sistema alterou/limpou o valor.\n' +
            'A automação foi pausada.\n\n' +
            'Você pode ajustar manualmente e continuar sem o script.'
          );
          localStorage.setItem(KEY_STOP, 'true');
          return;
        }

        // OK
        campo.style.backgroundColor = '#d4edda';
        campo.style.border = '3px solid green';

        index += 1;
        localStorage.setItem(KEY_INDEX, String(index));
        console.log('[SEEU-FIMSEMANA] Data preenchida e validada. Próximo índice:', index);

        if (index >= datas.length) {
          console.log('[SEEU-FIMSEMANA] Última data preenchida, limpando memória.');
          localStorage.removeItem(KEY_DATAS);
          localStorage.removeItem(KEY_INDEX);
        }

        // Clica automaticamente em "Salvar"
        setTimeout(() => {
          if (localStorage.getItem(KEY_STOP) === 'true') return;

          const salvarBtn = document.querySelector('#btnAlterar');
          if (!salvarBtn) {
            alert('[SEEU-FIMSEMANA] Botão "Salvar" (#btnAlterar) não encontrado. Execução pausada.');
            localStorage.setItem(KEY_STOP, 'true');
            return;
          }

          console.log('[SEEU-FIMSEMANA] Clicando em "Salvar" para a data:', dataAtual);
          salvarBtn.click();
          // Quando o popup fechar, a tela principal cuida de abrir o próximo (se houver)
        }, 600);

      }, 800);
    });
  }
})();

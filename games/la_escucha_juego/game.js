
(() => {
  "use strict";

  const cases = window.CASES;
  const MAX_CHAIN = 5;

  const formulaInfo = {
    neurosis: { symbol: "$ ◇ a", label: "Fantasía neurótica" },
    psicosis: { symbol: "P₀ → Φ₀", label: "Forclusión / agujero" },
    perversion: { symbol: "a ◇ $", label: "Fantasía perversa" }
  };
  const mechanismInfo = [
    ["represion", "Represión"],
    ["forclusion", "Forclusión"],
    ["desmentida", "Desmentida"]
  ];
  const structureInfo = [
    ["neurosis", "Neurosis"],
    ["psicosis", "Psicosis"],
    ["perversion", "Perversión"]
  ];
  const registerInfo = ["Imaginario", "Simbólico", "Real"];

  const $ = (sel) => document.querySelector(sel);
  const els = {
    patientList: $("#patientList"),
    globalProgress: $("#globalProgress"),
    totalScore: $("#totalScore"),
    patientStage: $("#patientStage"),
    patientSprite: $("#patientSprite"),
    caseNumber: $("#caseNumber"),
    patientName: $("#patientName"),
    caseSubtitle: $("#caseSubtitle"),
    speakerName: $("#speakerName"),
    speechText: $("#speechText"),
    typingCursor: $("#typingCursor"),
    interventions: $("#interventions"),
    signifierBank: $("#signifierBank"),
    chain: $("#chain"),
    chainCounter: $("#chainCounter"),
    chainMessage: $("#chainMessage"),
    pivotChoices: $("#pivotChoices"),
    registerChoices: $("#registerChoices"),
    mechanismChoices: $("#mechanismChoices"),
    structureChoices: $("#structureChoices"),
    formulaChoices: $("#formulaChoices"),
    sinthomeChoices: $("#sinthomeChoices"),
    notes: $("#notes"),
    diagnoseButton: $("#diagnoseButton"),
    nextButton: $("#nextButton"),
    result: $("#result"),
    introModal: $("#introModal"),
    theoryModal: $("#theoryModal"),
    historyModal: $("#historyModal"),
    historyList: $("#historyList"),
    transitionOverlay: $("#transitionOverlay"),
    voiceName: $("#voiceName"),
    voiceToggle: $("#voiceToggle"),
    repeatVoice: $("#repeatVoice"),
    musicToggle: $("#musicToggle")
  };

  const safeStorage = {
    read() {
      try {
        return JSON.parse(window.localStorage.getItem("laEscuchaSave") || "{}");
      } catch (_) {
        return {};
      }
    },
    write(value) {
      try {
        window.localStorage.setItem("laEscuchaSave", JSON.stringify(value));
      } catch (_) {
        // El juego continúa aunque el navegador bloquee el almacenamiento local.
      }
    },
    clear() {
      try {
        window.localStorage.removeItem("laEscuchaSave");
      } catch (_) {
        // Sin almacenamiento disponible, basta con recargar el estado en memoria.
      }
    }
  };

  const saved = safeStorage.read();
  const state = {
    current: Number.isInteger(saved.current) ? saved.current : 0,
    completed: saved.completed || {},
    runtime: {},
    typingToken: 0,
    animationTimer: null,
    lastSpoken: "",
    voiceEnabled: saved.voiceEnabled !== false,
    musicEnabled: saved.musicEnabled === true,
    voices: [],
    audioReady: false,
    audio: null
  };

  function freshRuntime(index) {
    const c = cases[index];
    return {
      used: [],
      unlocked: [],
      chain: [],
      pivot: "",
      register: "",
      mechanism: "",
      structure: "",
      formula: "",
      sinthome: "",
      closed: false,
      notes: state.completed[c.id]?.notes || ""
    };
  }

  function runtime(index = state.current) {
    if (!state.runtime[index]) state.runtime[index] = freshRuntime(index);
    return state.runtime[index];
  }

  function save() {
    safeStorage.write({
      current: state.current,
      completed: state.completed,
      voiceEnabled: state.voiceEnabled,
      musicEnabled: state.musicEnabled
    });
  }

  function initAudio() {
    if (state.audioReady) return;
    state.audio = new Audio("assets/audio/gabinete_ambient.wav");
    state.audio.loop = true;
    state.audio.volume = 0.35;
    state.audioReady = true;
  }

  async function syncMusic() {
    initAudio();
    if (!state.audio) return;
    if (state.musicEnabled) {
      try { await state.audio.play(); } catch (_) {}
    } else {
      state.audio.pause();
      state.audio.currentTime = 0;
    }
    els.musicToggle.textContent = `Música: ${state.musicEnabled ? "ON" : "OFF"}`;
  }

  function totalScore() {
    return Object.values(state.completed).reduce((sum, row) => sum + (row.score || 0), 0);
  }

  function transition(text, callback) {
    const overlay = els.transitionOverlay;
    overlay.querySelector(".transition-text").textContent = text || "Preparando la siguiente sesión…";
    overlay.classList.remove("hidden");
    requestAnimationFrame(() => overlay.classList.add("active"));
    setTimeout(() => {
      callback?.();
      setTimeout(() => {
        overlay.classList.remove("active");
        setTimeout(() => overlay.classList.add("hidden"), 350);
      }, 150);
    }, 280);
  }

  function setSpriteFrame(frame) {
    const c = cases[state.current];
    els.patientSprite.src = `assets/patients/${c.id}/frame_${frame}.png`;
  }

  function stopAnimation() {
    if (state.animationTimer) clearInterval(state.animationTimer);
    state.animationTimer = null;
  }

  function idleAnimation() {
    stopAnimation();
    setSpriteFrame(0);
  }

  function talkAnimation() {
    stopAnimation();
    const frames = [1, 2, 1, 2, 3, 2];
    let i = 0;
    state.animationTimer = setInterval(() => {
      setSpriteFrame(frames[i++ % frames.length]);
    }, 155);
  }

  function loadVoices() {
    const available = speechSynthesis.getVoices();
    if (!available.length) return;
    state.voices = available;
    updateVoiceLabel();
  }

  function pickVoice(profile) {
    const voices = state.voices;
    if (!voices.length) return null;
    const isSpanish = v => /^es/i.test(v.lang || "") || /spanish|español|esp/i.test(v.name || "");
    const spanish = voices.filter(isSpanish);
    const pool = spanish.length ? spanish : voices;

    if (profile.gender === "female") {
      return pool.find(v => /helena|monica|paulina|sabina|zira|female|woman/i.test(v.name)) || pool[0];
    }
    if (profile.gender === "male") {
      return pool.find(v => /jorge|daniel|diego|pablo|raul|david|male|man/i.test(v.name)) || pool[0];
    }
    return pool[0];
  }

  function updateVoiceLabel() {
    if (!("speechSynthesis" in window)) {
      els.voiceName.textContent = "síntesis no disponible";
      els.voiceToggle.textContent = "Voz: OFF";
      return;
    }
    const c = cases[state.current];
    const voice = pickVoice(c.voice || {});
    const pretty = voice ? `${voice.name} · ${voice.lang}` : "voz del navegador";
    els.voiceName.textContent = state.voiceEnabled ? pretty : "voz desactivada";
    els.voiceToggle.textContent = `Voz: ${state.voiceEnabled ? "ON" : "OFF"}`;
  }

  function speak(text) {
    state.lastSpoken = text;
    updateVoiceLabel();
    if (!("speechSynthesis" in window) || !state.voiceEnabled || !text) return;
    speechSynthesis.cancel();
    const c = cases[state.current];
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "es-ES";
    utter.rate = c.voice?.rate || 1;
    utter.pitch = c.voice?.pitch || 1;
    utter.volume = c.voice?.volume || 1;
    const voice = pickVoice(c.voice || {});
    if (voice) utter.voice = voice;
    utter.onstart = () => talkAnimation();
    utter.onend = () => idleAnimation();
    utter.onerror = () => idleAnimation();
    speechSynthesis.speak(utter);
  }

  async function typeText(text) {
    const token = ++state.typingToken;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    els.speechText.textContent = "";
    els.typingCursor.classList.remove("hidden");
    talkAnimation();
    const speed = text.length > 260 ? 9 : 14;
    for (let i = 0; i < text.length; i++) {
      if (token !== state.typingToken) return;
      els.speechText.textContent += text[i];
      if (i % 3 === 0) await new Promise(r => setTimeout(r, speed));
    }
    els.typingCursor.classList.add("hidden");
    idleAnimation();
    speak(text);
  }

  function findSubsequence(chain, seq) {
    for (let i = 0; i <= chain.length - seq.length; i++) {
      let ok = true;
      for (let j = 0; j < seq.length; j++) {
        if (chain[i + j] !== seq[j]) { ok = false; break; }
      }
      if (ok) return i;
    }
    return -1;
  }

  function scoreSignifiers(caseData, chain) {
    const weights = caseData.weightedSignifiers || {};
    const ideal = caseData.idealChain || [];
    const selectedWeight = chain.reduce((sum, s) => sum + (weights[s] || 0), 0);
    const presenceScore = Math.round((selectedWeight / 15) * 9);

    const idealPairs = ideal.slice(0, -1).map((s, i) => [s, ideal[i + 1]]);
    const matchedPairs = idealPairs.filter(pair => findSubsequence(chain, pair) >= 0);
    const orderScore = matchedPairs.length; // 0..4

    const triples = caseData.privilegedTriples || [ideal.slice(0, 3)];
    const matchedTriple = triples.find(seq => findSubsequence(chain, seq) >= 0);
    const comboScore = matchedTriple ? 2 : 0;

    const weightedHits = chain
      .filter(signifier => Object.prototype.hasOwnProperty.call(weights, signifier))
      .map(signifier => ({ signifier, points: weights[signifier] }))
      .sort((a, b) => b.points - a.points);

    return {
      total: presenceScore + orderScore + comboScore,
      presenceScore,
      orderScore,
      comboScore,
      selectedWeight,
      weightedHits,
      ideal,
      matchedPairs,
      matchedTriple
    };
  }

  function advancedComment(caseData, row) {
    const parts = [];
    if (row.pivot) {
      if (row.pivot === caseData.idealPivot) parts.push(`Buen punto de capitón: ${row.pivot} funciona bien como S1.`);
      else parts.push(`Has elegido ${row.pivot} como pivote; es una opción posible, aunque el juego privilegia ${caseData.idealPivot}.`);
    }
    if (row.register) {
      if (row.register === caseData.dominantRegister) parts.push(`Registro dominante bien captado: ${row.register}.`);
      else parts.push(`Has elegido ${row.register}; el juego orienta este caso más bien hacia lo ${caseData.dominantRegister.toLowerCase()}.`);
    }
    return parts.join(" ");
  }

  function closingRemark(caseData, score) {
    const bucket = score >= 85 ? "high" : score >= 60 ? "medium" : "low";
    return caseData.endings?.[bucket]
      || (score >= 85 ? "Hoy algo ha quedado bien dicho." : score >= 60 ? "Se ha rozado algo importante." : "Todavía no me siento bien leído.");
  }

  function renderPatientList() {
    els.patientList.innerHTML = "";
    cases.forEach((c, i) => {
      const done = state.completed[c.id];
      const b = document.createElement("button");
      b.className = "patient-button" + (i === state.current ? " active" : "") + (done ? " done" : "");
      b.innerHTML = `
        <img src="assets/patients/${c.id}/frame_0.png" alt="">
        <span><b>${String(i + 1).padStart(2, "0")}. ${c.name}</b><span class="small">${c.subtitle}</span></span>
        <span class="status">${done ? done.score + "✓" : "—"}</span>
      `;
      b.addEventListener("click", () => transition(`Abriendo la sesión de ${c.name}…`, () => loadCase(i)));
      els.patientList.appendChild(b);
    });
    els.totalScore.textContent = `${totalScore()} / 1000`;
  }

  function renderStaticChoices() {
    els.mechanismChoices.innerHTML = "";
    mechanismInfo.forEach(([value, label]) => {
      const b = document.createElement("button");
      b.className = "choice-card";
      b.dataset.value = value;
      b.textContent = label;
      b.addEventListener("click", () => selectChoice("mechanism", value));
      els.mechanismChoices.appendChild(b);
    });

    els.structureChoices.innerHTML = "";
    structureInfo.forEach(([value, label]) => {
      const b = document.createElement("button");
      b.className = "choice-card";
      b.dataset.value = value;
      b.textContent = label;
      b.addEventListener("click", () => selectChoice("structure", value));
      els.structureChoices.appendChild(b);
    });

    els.formulaChoices.innerHTML = "";
    Object.entries(formulaInfo).forEach(([value, info]) => {
      const b = document.createElement("button");
      b.className = "formula-card";
      b.dataset.value = value;
      b.innerHTML = `<strong>${info.symbol}</strong><small>${info.label}</small>`;
      b.addEventListener("click", () => selectChoice("formula", value));
      els.formulaChoices.appendChild(b);
    });

    els.registerChoices.innerHTML = "";
    registerInfo.forEach(value => {
      const b = document.createElement("button");
      b.className = "choice-card";
      b.dataset.value = value;
      b.textContent = value;
      b.addEventListener("click", () => selectChoice("register", value, els.registerChoices));
      els.registerChoices.appendChild(b);
    });
  }

  function selectChoice(kind, value, parentOverride = null) {
    const rt = runtime();
    if (rt.closed) return;
    rt[kind] = value;
    const parent = parentOverride ||
      (kind === "mechanism" ? els.mechanismChoices :
       kind === "structure" ? els.structureChoices :
       kind === "formula" ? els.formulaChoices :
       kind === "register" ? els.registerChoices :
       els.pivotChoices);
    [...parent.children].forEach(el => el.classList.toggle("selected", el.dataset.value === value));
  }

  function renderInterventions() {
    const c = cases[state.current];
    const rt = runtime();
    els.interventions.innerHTML = "";
    c.interventions.forEach((iv, i) => {
      const b = document.createElement("button");
      b.className = "intervention" + (rt.used.includes(i) ? " used" : "");
      b.textContent = rt.used.includes(i) ? `✓ ${iv.label}` : iv.label;
      b.disabled = rt.used.includes(i) || rt.closed;
      b.addEventListener("click", () => useIntervention(i));
      els.interventions.appendChild(b);
    });
  }

  function useIntervention(i) {
    const c = cases[state.current];
    const rt = runtime();
    if (rt.used.includes(i) || rt.closed) return;
    rt.used.push(i);
    c.interventions[i].signifiers.forEach(s => {
      if (!rt.unlocked.includes(s)) rt.unlocked.push(s);
    });
    renderInterventions();
    renderSignifiers();
    typeText(c.interventions[i].text);
  }

  function setChainMessage(text = "", tone = "neutral") {
    els.chainMessage.textContent = text;
    els.chainMessage.style.color =
      tone === "warn" ? "#d5a264" :
      tone === "ok" ? "#9cc27f" :
      "#8c7d69";
  }

  function renderPivotChoices() {
    const rt = runtime();
    els.pivotChoices.innerHTML = "";
    if (!rt.chain.length) {
      els.pivotChoices.innerHTML = `<span class="microcopy">El pivote se elige a partir de la cadena construida.</span>`;
      return;
    }
    rt.chain.forEach(signifier => {
      const b = document.createElement("button");
      b.className = "choice-card" + (rt.pivot === signifier ? " selected" : "");
      b.dataset.value = signifier;
      b.textContent = signifier;
      b.disabled = rt.closed;
      b.addEventListener("click", () => {
        rt.pivot = signifier;
        renderPivotChoices();
      });
      els.pivotChoices.appendChild(b);
    });
  }

  function renderSignifiers() {
    const rt = runtime();
    els.signifierBank.innerHTML = "";
    els.chainCounter.textContent = `${rt.chain.length} / ${MAX_CHAIN}`;

    rt.unlocked.forEach(signifier => {
      const b = document.createElement("button");
      b.className = "chip" + (rt.chain.includes(signifier) ? " selected" : "");
      b.textContent = signifier;
      b.disabled = rt.closed;
      b.addEventListener("click", () => {
        if (rt.chain.includes(signifier)) return;
        if (rt.chain.length >= MAX_CHAIN) {
          setChainMessage("Solo puedes elegir cinco significantes. Retira uno para añadir otro.", "warn");
          return;
        }
        rt.chain.push(signifier);
        if (!rt.pivot) rt.pivot = signifier;
        setChainMessage("Añadido. Recuerda: importan la pertinencia, el orden y los encadenamientos.", "ok");
        renderSignifiers();
      });
      els.signifierBank.appendChild(b);
    });

    if (!rt.unlocked.length) {
      els.signifierBank.innerHTML = `<span class="microcopy">Los significantes aparecerán al intervenir.</span>`;
    }
    renderChain();
    renderPivotChoices();
  }

  function renderChain() {
    const rt = runtime();
    els.chain.innerHTML = "";
    els.chainCounter.textContent = `${rt.chain.length} / ${MAX_CHAIN}`;

    rt.chain.forEach((signifier, index) => {
      const b = document.createElement("button");
      b.className = "chain-chip";
      b.textContent = `${index + 1}. ${signifier}`;
      b.title = "Pulsa para retirar de la cadena";
      b.disabled = rt.closed;
      b.addEventListener("click", () => {
        rt.chain.splice(index, 1);
        if (rt.pivot === signifier) rt.pivot = rt.chain[0] || "";
        setChainMessage("Has retirado un significante.", "neutral");
        renderSignifiers();
      });
      els.chain.appendChild(b);
      if (index < rt.chain.length - 1) {
        const arrow = document.createElement("span");
        arrow.textContent = "→";
        arrow.style.color = "#8e795c";
        els.chain.appendChild(arrow);
      }
    });

    if (!rt.chain.length) {
      els.chain.innerHTML = `<span class="microcopy">S1 → S2 → S3 → S4 → S5</span>`;
    }
  }

  function renderSinthomes() {
    const c = cases[state.current];
    const rt = runtime();
    els.sinthomeChoices.innerHTML = "";
    c.sinthomes.forEach(([value, text]) => {
      const b = document.createElement("button");
      b.className = "sinthome-card" + (rt.sinthome === value ? " selected" : "");
      b.dataset.value = value;
      const parts = text.split(":");
      const title = parts.shift() || text;
      b.innerHTML = `<strong>${title}</strong>${parts.join(":") || ""}`;
      b.disabled = rt.closed;
      b.addEventListener("click", () => {
        rt.sinthome = value;
        renderSinthomes();
      });
      els.sinthomeChoices.appendChild(b);
    });
  }

  function applySelections() {
    const rt = runtime();
    [
      [els.mechanismChoices, rt.mechanism],
      [els.structureChoices, rt.structure],
      [els.formulaChoices, rt.formula],
      [els.registerChoices, rt.register]
    ].forEach(([parent, value]) => {
      [...parent.children].forEach(el => el.classList.toggle("selected", el.dataset.value === value));
    });
    renderPivotChoices();
  }

  function loadCase(index) {
    state.typingToken++;
    if ("speechSynthesis" in window) speechSynthesis.cancel();
    stopAnimation();
    state.current = index;
    save();
    const c = cases[index];
    const rt = runtime(index);

    els.globalProgress.textContent = `Paciente ${index + 1} de ${cases.length}`;
    els.caseNumber.textContent = `CASO ${String(index + 1).padStart(2, "0")}`;
    els.patientName.textContent = c.name;
    els.caseSubtitle.textContent = c.subtitle;
    els.speakerName.textContent = c.name;
    els.patientSprite.alt = `Sprite animado de ${c.name}`;
    const stage = c.stage || {};
    els.patientSprite.style.setProperty("--sprite-scale", String(stage.scale ?? 1));
    els.patientSprite.style.setProperty("--sprite-x", `${stage.x ?? 0}px`);
    els.patientSprite.style.setProperty("--sprite-y", `${stage.y ?? 0}px`);
    els.notes.value = rt.notes;
    els.result.className = "result hidden";
    els.nextButton.classList.add("hidden");
    els.diagnoseButton.classList.toggle("hidden", rt.closed);
    updateVoiceLabel();

    renderPatientList();
    renderInterventions();
    renderSignifiers();
    renderSinthomes();
    applySelections();

    if (rt.closed && state.completed[c.id]) {
      showStoredResult(state.completed[c.id], c);
      idleAnimation();
    } else {
      idleAnimation();
      typeText(c.opening);
    }
  }

  function diagnose() {
    const c = cases[state.current];
    const rt = runtime();

    const missing = [];
    if (rt.used.length < 3) missing.push("escuchar las tres intervenciones");
    if (rt.chain.length !== MAX_CHAIN) missing.push(`construir una cadena de exactamente ${MAX_CHAIN} significantes`);
    if (!rt.mechanism) missing.push("elegir la operación");
    if (!rt.structure) missing.push("elegir la estructura");
    if (!rt.formula) missing.push("elegir la fórmula");
    if (!rt.sinthome) missing.push("proponer un sinthome");

    if (missing.length) {
      els.result.className = "result partial";
      els.result.innerHTML = `<h3>Sesión todavía abierta</h3><p>Falta ${missing.join(", ")}.</p>`;
      els.result.classList.remove("hidden");
      return;
    }

    const signEval = scoreSignifiers(c, rt.chain);
    let score = 0;
    score += rt.structure === c.structure ? 30 : 0;
    score += rt.mechanism === c.mechanism ? 25 : 0;
    score += rt.formula === c.formula ? 20 : 0;
    score += signEval.total;
    score += rt.sinthome === c.sinthome ? 10 : 0;

    const closing = closingRemark(c, score);
    rt.closed = true;
    rt.notes = els.notes.value;

    state.completed[c.id] = {
      score,
      signifierEval: signEval,
      structure: rt.structure,
      mechanism: rt.mechanism,
      formula: rt.formula,
      sinthome: rt.sinthome,
      chain: rt.chain,
      pivot: rt.pivot,
      register: rt.register,
      closing,
      notes: rt.notes,
      diagnosedAt: new Date().toLocaleString("es-ES")
    };
    save();

    renderPatientList();
    renderInterventions();
    renderSinthomes();
    renderHistory();
    showStoredResult(state.completed[c.id], c);
    els.diagnoseButton.classList.add("hidden");
    els.nextButton.classList.remove("hidden");

    typeText(closing);
  }

  function labelFor(list, value) {
    return (list.find(x => x[0] === value) || ["", value])[1];
  }

  function showStoredResult(row, c) {
    const cls = row.score >= 80 ? "good" : row.score >= 55 ? "partial" : "bad";
    const signEval = row.signifierEval || scoreSignifiers(c, row.chain || []);
    const weightedList = signEval.weightedHits.length
      ? signEval.weightedHits.map(item => `${item.signifier} (+${item.points})`).join(" · ")
      : "ningún significante puntuable";
    const pairText = signEval.matchedPairs.length
      ? signEval.matchedPairs.map(pair => pair.join(" → ")).join(" · ")
      : "ningún enlace privilegiado";
    const tripleText = signEval.matchedTriple ? signEval.matchedTriple.join(" → ") : "ninguno";
    const idealText = signEval.ideal.join(" → ");
    const advText = advancedComment(c, row) || "No has completado la formalización avanzada.";

    let chainComment = "";
    if (signEval.total >= 13) chainComment = "Cadena muy bien formalizada: elegiste significantes pertinentes y los articulaste de manera sólida.";
    else if (signEval.total >= 9) chainComment = "La cadena es prometedora, pero todavía pierde precisión en el orden o en los enlaces clave.";
    else chainComment = "La cadena recoge material, pero aún no privilegia suficientemente los significantes decisivos ni su articulación.";

    els.result.className = `result ${cls}`;
    els.result.innerHTML = `
      <h3>Lectura de la sesión</h3>
      <div class="score-big">${row.score} / 100</div>
      <p><b>Tu hipótesis:</b> ${labelFor(structureInfo, row.structure)} · ${labelFor(mechanismInfo, row.mechanism)} · ${formulaInfo[row.formula]?.symbol || "—"}</p>
      <p><b>Puntuación significante:</b> ${signEval.total} / 15</p>
      <p>— Pertinencia: ${signEval.presenceScore} / 9</p>
      <p>— Orden (pares correctos): ${signEval.orderScore} / 4</p>
      <p>— Encadenamiento privilegiado: ${signEval.comboScore} / 2</p>
      <p><b>Significantes que te han puntuado:</b> ${weightedList}</p>
      <p><b>Pares bien articulados:</b> ${pairText}</p>
      <p><b>Triple privilegiado detectado:</b> ${tripleText}</p>
      <p><b>Cadena ideal del caso:</b> ${idealText}</p>
      <p><b>Lectura de la cadena:</b> ${chainComment}</p>
      <p><b>Formalización avanzada:</b> ${advText}</p>
      <p><b>Orientación del caso:</b> ${c.feedback}</p>
      <p><b>Lectura estructural esperada por el juego:</b> ${labelFor(structureInfo, c.structure)} / ${labelFor(mechanismInfo, c.mechanism)} / ${formulaInfo[c.formula].symbol}.</p>
    `;
    els.result.classList.remove("hidden");
    els.nextButton.classList.remove("hidden");
  }

  function renderHistory() {
    const entries = cases
      .map(c => ({ caseData: c, row: state.completed[c.id] }))
      .filter(x => !!x.row);

    if (!entries.length) {
      els.historyList.innerHTML = `<div class="history-empty">Todavía no has cerrado ninguna sesión.</div>`;
      return;
    }

    els.historyList.innerHTML = entries.map(({ caseData, row }, idx) => `
      <article class="history-card">
        <h3>${String(idx + 1).padStart(2, "0")}. ${caseData.name} — ${row.score}/100</h3>
        <div class="history-meta">
          <p><b>Fecha:</b> ${row.diagnosedAt || "sin fecha"}</p>
          <p><b>Estructura:</b> ${labelFor(structureInfo, row.structure)} · <b>Operación:</b> ${labelFor(mechanismInfo, row.mechanism)} · <b>Fórmula:</b> ${formulaInfo[row.formula]?.symbol || "—"}</p>
          <p><b>Cadena:</b> ${(row.chain || []).join(" → ") || "—"}</p>
          <p><b>Pivote / S1:</b> ${row.pivot || "—"} · <b>Registro:</b> ${row.register || "—"}</p>
          <p><b>Sinthome:</b> ${row.sinthome || "—"}</p>
          <p><b>Cierre del paciente:</b> ${row.closing || "—"}</p>
        </div>
      </article>
    `).join("");
  }

  function nextCase() {
    const nextIncomplete = cases.findIndex((c, i) => i > state.current && !state.completed[c.id]);
    if (nextIncomplete >= 0) {
      return transition("Pasando al siguiente paciente…", () => loadCase(nextIncomplete));
    }
    const anyIncomplete = cases.findIndex(c => !state.completed[c.id]);
    if (anyIncomplete >= 0) {
      return transition("Reanudando el archivo clínico…", () => loadCase(anyIncomplete));
    }

    els.result.className = "result good";
    els.result.innerHTML = `
      <h3>Archivo clínico completado</h3>
      <div class="score-big">${totalScore()} / 1000</div>
      <p>Has cerrado las diez sesiones. Puedes volver a cualquier caso para revisar la cadena, las notas y la formalización elegida.</p>
    `;
    els.result.classList.remove("hidden");
    els.nextButton.classList.add("hidden");
  }

  function resetAll() {
    if (!confirm("¿Borrar todo el progreso y comenzar de nuevo?")) return;
    safeStorage.clear();
    location.reload();
  }

  renderStaticChoices();
  renderHistory();

  els.diagnoseButton.addEventListener("click", diagnose);
  els.nextButton.addEventListener("click", nextCase);
  els.notes.addEventListener("input", () => { runtime().notes = els.notes.value; });

  $("#theoryButton").addEventListener("click", () => els.theoryModal.classList.remove("hidden"));
  $("#closeTheory").addEventListener("click", () => els.theoryModal.classList.add("hidden"));

  $("#historyButton").addEventListener("click", () => {
    renderHistory();
    els.historyModal.classList.remove("hidden");
  });
  $("#closeHistory").addEventListener("click", () => els.historyModal.classList.add("hidden"));

  els.theoryModal.addEventListener("click", e => { if (e.target === els.theoryModal) els.theoryModal.classList.add("hidden"); });
  els.historyModal.addEventListener("click", e => { if (e.target === els.historyModal) els.historyModal.classList.add("hidden"); });

  els.voiceToggle.addEventListener("click", () => {
    state.voiceEnabled = !state.voiceEnabled;
    if ("speechSynthesis" in window && !state.voiceEnabled) speechSynthesis.cancel();
    updateVoiceLabel();
    save();
  });

  els.musicToggle.addEventListener("click", async () => {
    state.musicEnabled = !state.musicEnabled;
    save();
    await syncMusic();
  });

  els.repeatVoice.addEventListener("click", () => {
    if (state.lastSpoken) speak(state.lastSpoken);
  });

  $("#resetAllButton").addEventListener("click", resetAll);

  $("#startButton").addEventListener("click", async () => {
    els.introModal.classList.add("hidden");
    initAudio();
    await syncMusic();
    typeText(cases[state.current].opening);
  });

  if ("speechSynthesis" in window) {
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
  } else {
    els.voiceName.textContent = "síntesis no disponible";
    els.voiceToggle.textContent = "Voz: OFF";
  }

  updateVoiceLabel();
  syncMusic();
  loadCase(state.current);
})();

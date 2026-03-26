/* Aptitude Practice: topic selection -> quiz -> scoring -> results.
   This is a small SPA implemented with three sections toggled by JS. */

(() => {
  const $ = (sel) => document.querySelector(sel);

  const pageTopics = $("#page-topics");
  const pageQuiz = $("#page-quiz");
  const pageResult = $("#page-result");

  const startBtn = $("#startBtn");
  const resetBtn = $("#resetBtn");
  const topicsGrid = $("#topicsGrid");
  const topicSearch = $("#topicSearch");
  const categoryButtons = Array.from(document.querySelectorAll(".seg-btn[data-cat]"));

  const quizHeading = $("#quizHeading");
  const quizSubheading = $("#quizSubheading");

  const progressBar = $("#progressBar");
  const quizCount = $("#quizCount");

  const questionText = $("#questionText");
  const optionsGrid = $("#optionsGrid");
  const feedbackBox = $("#feedbackBox");

  const nextBtn = $("#nextBtn");
  const backBtn = $("#backBtn");
  const skipBtn = $("#skipBtn");

  const resultTitle = $("#resultTitle");
  const resultScore = $("#resultScore");
  const resultLine = $("#resultLine");
  const resultMeta = $("#resultMeta");
  const practiceAgainBtn = $("#practiceAgainBtn");
  const reviewList = $("#reviewList");
  const reviewEmpty = $("#reviewEmpty");

  const ringProgress = $("#ringProgress");

  // --- Deterministic RNG (so each topic produces 25 stable questions) ---
  function hashStringToSeed(str) {
    // FNV-1a (32-bit)
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function pick(rng, arr) {
    return arr[randInt(rng, 0, arr.length - 1)];
  }

  function shuffleWithRng(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function uniqueOptions(correct, distractors, maxChoices = 4) {
    const out = [correct];
    for (const d of distractors) {
      if (out.length >= maxChoices) break;
      if (d === correct) continue;
      if (out.includes(d)) continue;
      out.push(d);
    }
    return out;
  }

  function makeMCQ({ id, question, correct, distractors, explanation }) {
    const options = uniqueOptions(correct, distractors);
    // Pad to 4 options if generator didn't produce enough distinct distractors
    while (options.length < 4) options.push(`${correct} (alt ${options.length})`);
    return {
      id,
      question,
      options,
      correctIndex: 0,
      explanation,
      _correctValue: correct,
    };
  }

  function finalizeQuestions(rng, questions) {
    // Randomize option order per question while preserving correctness.
    return questions.map((q) => {
      const zipped = q.options.map((opt) => ({
        opt,
        isCorrect: opt === q._correctValue,
      }));
      const shuffled = shuffleWithRng(rng, zipped);
      const options = shuffled.map((z) => z.opt);
      const correctIndex = shuffled.findIndex((z) => z.isCorrect);
      return {
        id: q.id,
        question: q.question,
        options,
        correctIndex: correctIndex < 0 ? 0 : correctIndex,
        explanation: q.explanation || "",
      };
    });
  }

  // --- Topic generators (25 questions each) ---
  const NAMES = ["Aarav", "Diya", "Ishaan", "Meera", "Rahul", "Anaya", "Vikram", "Sana", "Kabir", "Nisha"];

  function genPercentage(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const base = randInt(rng, 40, 240);
      const p = pick(rng, [5, 10, 12.5, 15, 20, 25, 30, 40, 50, 60, 75]);
      const correct = String(Math.round((base * p) / 100));
      const distractors = [
        String(Math.round((base * (p + 5)) / 100)),
        String(Math.round((base * (p - 5)) / 100)),
        String(Math.round((base * p) / 100) + randInt(rng, 1, 8)),
      ];
      qs.push(
        makeMCQ({
          id: `${prefix}-pct-${i + 1}`,
          question: `What is ${p}% of ${base}?`,
          correct,
          distractors,
          explanation: `${p}% of ${base} = (${p}/100)*${base} = ${correct}.`,
        })
      );
    }
    return qs;
  }

  function genRatioProportion(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const a = randInt(rng, 2, 9);
      const b = randInt(rng, 2, 12);
      const k = randInt(rng, 2, 10);
      const x = a * k;
      const y = b * k;
      const ask = pick(rng, ["x", "y"]);
      const correct = ask === "x" ? String(x) : String(y);
      const distractors = [
        String((ask === "x" ? a : b) * (k + 1)),
        String((ask === "x" ? a : b) * Math.max(1, k - 1)),
        String(correct * 1 + randInt(rng, 1, 7)),
      ];
      qs.push(
        makeMCQ({
          id: `${prefix}-ratio-${i + 1}`,
          question: `If x:y = ${a}:${b} and x + y = ${x + y}, what is ${ask}?`,
          correct,
          distractors,
          explanation: `Let x=${a}k and y=${b}k. Then x+y=(${a + b})k=${x + y} => k=${k}. So ${ask}=${correct}.`,
        })
      );
    }
    return qs;
  }

  function genProfitLoss(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const cp = randInt(rng, 80, 600);
      const pct = pick(rng, [5, 8, 10, 12, 15, 20, 25, 30]);
      const type = pick(rng, ["profit", "loss"]);
      const sp = type === "profit" ? Math.round(cp * (1 + pct / 100)) : Math.round(cp * (1 - pct / 100));
      const correct = String(sp);
      const distractors = [
        String(Math.round(cp * (1 + (type === "profit" ? pct + 5 : -(pct + 5)) / 100))),
        String(Math.round(cp * (1 + (type === "profit" ? pct - 5 : -(pct - 5)) / 100))),
        String(sp + randInt(rng, 3, 17)),
      ];
      qs.push(
        makeMCQ({
          id: `${prefix}-pl-${i + 1}`,
          question: `Cost price is $${cp}. If there is a ${pct}% ${type}, what is the selling price?`,
          correct,
          distractors,
          explanation:
            type === "profit"
              ? `Selling price = CP*(1 + ${pct}/100) = ${cp}*${(1 + pct / 100).toFixed(2)} ≈ ${correct}.`
              : `Selling price = CP*(1 - ${pct}/100) = ${cp}*${(1 - pct / 100).toFixed(2)} ≈ ${correct}.`,
        })
      );
    }
    return qs;
  }

  function genTimeWork(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const a = randInt(rng, 4, 20);
      const b = randInt(rng, 4, 20);
      const lcm = (x, y) => (x * y) / gcd(x, y);
      const g = gcd(a, b);
      const L = lcm(a, b);
      const rate = 1 / a + 1 / b;
      const days = Math.round(1 / rate);
      // Use a consistent "nice" combined days by selecting pairs where combined is integer.
      const combined = (a * b) / (a + b);
      const combinedDays = Number.isInteger(combined) ? combined : days;
      const correct = String(combinedDays);
      const distractors = [String(a), String(b), String(Math.max(1, combinedDays - 1))];
      qs.push(
        makeMCQ({
          id: `${prefix}-tw-${i + 1}`,
          question: `A can finish a work in ${a} days and B can finish it in ${b} days. How many days will they take together (approximately)?`,
          correct,
          distractors,
          explanation: `Combined time = (a*b)/(a+b) = (${a}*${b})/(${a + b}) ≈ ${correct} days.`,
        })
      );
    }
    return qs;
  }

  function genTSD(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const speed = randInt(rng, 20, 80);
      const timeH = pick(rng, [0.5, 1, 1.5, 2, 2.5, 3]);
      const dist = Math.round(speed * timeH);
      const correct = String(dist);
      const distractors = [
        String(Math.round((speed + 10) * timeH)),
        String(Math.round(speed * (timeH + 0.5))),
        String(Math.max(1, dist - randInt(rng, 3, 15))),
      ];
      qs.push(
        makeMCQ({
          id: `${prefix}-tsd-${i + 1}`,
          question: `A person travels at ${speed} km/h for ${timeH} hours. What distance is covered (in km)?`,
          correct,
          distractors,
          explanation: `Distance = speed * time = ${speed} * ${timeH} = ${correct} km.`,
        })
      );
    }
    return qs;
  }

  function genInterest(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const P = randInt(rng, 500, 5000);
      const r = pick(rng, [5, 6, 8, 10, 12, 15]);
      const t = randInt(rng, 1, 4);
      const kind = pick(rng, ["SI", "CI"]);
      let A;
      let explanation;
      if (kind === "SI") {
        A = Math.round(P * (1 + (r * t) / 100));
        explanation = `SI amount A = P(1 + rt/100) = ${P}(1 + ${r}*${t}/100) = ${A}.`;
      } else {
        A = Math.round(P * Math.pow(1 + r / 100, t));
        explanation = `CI amount A = P(1 + r/100)^t = ${P}*(1 + ${r}/100)^${t} ≈ ${A}.`;
      }
      const correct = String(A);
      const distractors = [String(A + randInt(rng, 10, 90)), String(Math.max(1, A - randInt(rng, 10, 90))), String(P)];
      qs.push(
        makeMCQ({
          id: `${prefix}-int-${i + 1}`,
          question: `Principal is $${P} at ${r}% per annum for ${t} year(s). What is the amount (rounded) using ${kind}?`,
          correct,
          distractors,
          explanation,
        })
      );
    }
    return qs;
  }

  function genProbability(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const total = pick(rng, [6, 8, 10, 12, 15, 20]);
      const favorable = randInt(rng, 1, total - 1);
      const correct = `${favorable}/${total}`;
      const distractors = [`${total - favorable}/${total}`, `${favorable + 1}/${total}`, `${favorable}/${total + 1}`];
      qs.push(
        makeMCQ({
          id: `${prefix}-prob-${i + 1}`,
          question: `A bag has ${total} balls, of which ${favorable} are red and ${total - favorable} are blue. What is the probability of drawing a red ball?`,
          correct,
          distractors,
          explanation: `Probability = favorable/total = ${favorable}/${total}.`,
        })
      );
    }
    return qs;
  }

  function genNumberSystem(rng, count, prefix) {
    const qs = [];
    const types = ["gcd", "lcm", "rema", "digitSum"];
    for (let i = 0; i < count; i++) {
      const t = pick(rng, types);
      if (t === "gcd") {
        const a = randInt(rng, 12, 120);
        const b = randInt(rng, 12, 120);
        const g = gcd(a, b);
        qs.push(
          makeMCQ({
            id: `${prefix}-ns-${i + 1}`,
            question: `What is the HCF (GCD) of ${a} and ${b}?`,
            correct: String(g),
            distractors: [String(g + 1), String(Math.max(1, g - 1)), String((g * 2) % 100 || g * 2)],
            explanation: `HCF is the greatest number dividing both ${a} and ${b}. Here it is ${g}.`,
          })
        );
      } else if (t === "lcm") {
        const a = randInt(rng, 6, 36);
        const b = randInt(rng, 6, 36);
        const L = (a * b) / gcd(a, b);
        qs.push(
          makeMCQ({
            id: `${prefix}-ns-${i + 1}`,
            question: `What is the LCM of ${a} and ${b}?`,
            correct: String(L),
            distractors: [String(L + a), String(L - gcd(a, b)), String(a * b)],
            explanation: `LCM(a,b) = (a*b)/GCD(a,b) = (${a}*${b})/${gcd(a, b)} = ${L}.`,
          })
        );
      } else if (t === "rema") {
        const a = randInt(rng, 20, 200);
        const m = randInt(rng, 3, 12);
        const r = a % m;
        qs.push(
          makeMCQ({
            id: `${prefix}-ns-${i + 1}`,
            question: `What is the remainder when ${a} is divided by ${m}?`,
            correct: String(r),
            distractors: [String((r + 1) % m), String((r + 2) % m), String(Math.max(0, r - 1))],
            explanation: `${a} = ${m}*q + r, so remainder r = ${r}.`,
          })
        );
      } else {
        const n = randInt(rng, 100, 9999);
        const sum = String(n)
          .split("")
          .reduce((acc, d) => acc + Number(d), 0);
        qs.push(
          makeMCQ({
            id: `${prefix}-ns-${i + 1}`,
            question: `What is the sum of digits of ${n}?`,
            correct: String(sum),
            distractors: [String(sum + 1), String(Math.max(1, sum - 1)), String(sum + randInt(rng, 2, 7))],
            explanation: `Sum of digits of ${n} is ${sum}.`,
          })
        );
      }
    }
    return qs;
  }

  function genSeriesCompletion(rng, count, prefix) {
    const qs = [];
    const kinds = ["ap", "gp", "squares", "mixed"];
    for (let i = 0; i < count; i++) {
      const kind = pick(rng, kinds);
      let seq;
      let correct;
      let explanation;
      if (kind === "ap") {
        const a = randInt(rng, 1, 15);
        const d = randInt(rng, 2, 10);
        seq = [a, a + d, a + 2 * d, a + 3 * d, a + 4 * d];
        correct = a + 5 * d;
        explanation = `Arithmetic progression with common difference ${d}.`;
      } else if (kind === "gp") {
        const a = randInt(rng, 1, 5);
        const r = pick(rng, [2, 3]);
        seq = [a, a * r, a * r * r, a * r * r * r, a * r * r * r * r];
        correct = a * Math.pow(r, 5);
        explanation = `Geometric progression with ratio ${r}.`;
      } else if (kind === "squares") {
        const s = randInt(rng, 1, 8);
        seq = [s * s, (s + 1) * (s + 1), (s + 2) * (s + 2), (s + 3) * (s + 3)];
        correct = (s + 4) * (s + 4);
        explanation = `Sequence of squares: n^2.`;
      } else {
        // +1, +2, +3, +4...
        const start = randInt(rng, 1, 20);
        seq = [start];
        for (let k = 1; k <= 4; k++) seq.push(seq[seq.length - 1] + k);
        correct = seq[seq.length - 1] + 5;
        explanation = `Differences increase by 1 each step (+1,+2,+3,...).`;
      }
      const text = `${seq.join(", ")}, ?`;
      qs.push(
        makeMCQ({
          id: `${prefix}-ser-${i + 1}`,
          question: `Find the next number in the series: ${text}`,
          correct: String(correct),
          distractors: [String(correct + 1), String(Math.max(1, correct - 1)), String(correct + randInt(rng, 2, 7))],
          explanation: `Next term is ${correct}. ${explanation}`,
        })
      );
    }
    return qs;
  }

  function genDirectionSense(rng, count, prefix) {
    const qs = [];
    const dirs = ["North", "South", "East", "West"];
    for (let i = 0; i < count; i++) {
      let x = 0;
      let y = 0;
      const steps = randInt(rng, 3, 5);
      const moves = [];
      for (let s = 0; s < steps; s++) {
        const dir = pick(rng, dirs);
        const dist = randInt(rng, 2, 12);
        moves.push(`${dist} km ${dir}`);
        if (dir === "North") y += dist;
        if (dir === "South") y -= dist;
        if (dir === "East") x += dist;
        if (dir === "West") x -= dist;
      }
      const manhattan = Math.abs(x) + Math.abs(y);
      const correct = String(manhattan);
      qs.push(
        makeMCQ({
          id: `${prefix}-dir-${i + 1}`,
          question: `A person walks ${moves.join(", ")}. What is the total displacement in grid-distance (|x|+|y|) from the start (in km)?`,
          correct,
          distractors: [String(manhattan + 2), String(Math.max(0, manhattan - 2)), String(Math.abs(x) * Math.abs(y) || manhattan + 1)],
          explanation: `Net x=${x}, net y=${y}. Grid-distance = |${x}|+|${y}| = ${correct}.`,
        })
      );
    }
    return qs;
  }

  function genCodingDecoding(rng, count, prefix) {
    const qs = [];
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (let i = 0; i < count; i++) {
      const shift = pick(rng, [1, 2, 3, 4, 5]);
      const word = pick(rng, ["CAT", "DOG", "BEE", "FAN", "HAT", "SUN", "BOX", "KEY", "MAP", "PEN"]);
      const encode = (w) =>
        w
          .split("")
          .map((ch) => alphabet[(alphabet.indexOf(ch) + shift) % 26])
          .join("");
      const coded = encode(word);
      const options = shuffleWithRng(rng, [coded, encode(word.split("").reverse().join("")), encode(word) + "A".slice(0, 0), encode(word)]);
      // Ensure 4 unique options:
      const opts = Array.from(new Set(options));
      while (opts.length < 4) opts.push(encode(pick(rng, ["TOY", "CAR", "MAN", "TOP"])));
      const correct = coded;
      qs.push(
        makeMCQ({
          id: `${prefix}-code-${i + 1}`,
          question: `Coding rule: each letter is shifted forward by ${shift}. If ${word} is coded as ____ ?`,
          correct,
          distractors: shuffleWithRng(rng, opts.filter((o) => o !== correct)).slice(0, 3),
          explanation: `Shift each letter forward by ${shift} positions: ${word} -> ${coded}.`,
        })
      );
    }
    return qs;
  }

  function genBloodRelations(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const A = pick(rng, NAMES);
      const B = pick(rng, NAMES.filter((n) => n !== A));
      const C = pick(rng, NAMES.filter((n) => n !== A && n !== B));
      const D = pick(rng, NAMES.filter((n) => n !== A && n !== B && n !== C));
      // Template: A is father of B. B is sister of C. C is mother of D. Ask relation between A and D.
      qs.push(
        makeMCQ({
          id: `${prefix}-br-${i + 1}`,
          question: `${A} is the father of ${B}. ${B} is the sister of ${C}. ${C} is the mother of ${D}. How is ${A} related to ${D}?`,
          correct: "Grandfather",
          distractors: ["Uncle", "Father", "Brother"],
          explanation: `${A} is father of ${B}. ${B} and ${C} are siblings, so ${A} is also father of ${C}. ${C} is mother of ${D}, so ${A} is grandfather of ${D}.`,
        })
      );
    }
    return qs;
  }

  function genSyllogism(rng, count, prefix) {
    const qs = [];
    const categories = ["cats", "dogs", "birds", "students", "artists", "cars", "flowers"];
    for (let i = 0; i < count; i++) {
      const A = pick(rng, categories);
      let B = pick(rng, categories);
      let C = pick(rng, categories);
      if (B === A) B = pick(rng, categories.filter((x) => x !== A));
      if (C === A || C === B) C = pick(rng, categories.filter((x) => x !== A && x !== B));
      const stmt1 = `All ${A} are ${B}.`;
      const stmt2 = `Some ${B} are ${C}.`;
      const conclusion = `Some ${A} are ${C}.`;
      qs.push(
        makeMCQ({
          id: `${prefix}-syl-${i + 1}`,
          question: `Statements:\n1) ${stmt1}\n2) ${stmt2}\nConclusion: ${conclusion}\nWhat follows?`,
          correct: "Cannot be determined",
          distractors: ["Conclusion is true", "Conclusion is false", "Both true and false"],
          explanation: `From All A are B and Some B are C, overlap between A and C is not guaranteed. So it cannot be determined.`,
        })
      );
    }
    return qs;
  }

  function genPuzzles(rng, count, prefix) {
    const qs = [];
    for (let i = 0; i < count; i++) {
      const people = shuffleWithRng(rng, ["A", "B", "C", "D"]);
      const correct = people[0];
      qs.push(
        makeMCQ({
          id: `${prefix}-puz-${i + 1}`,
          question: `Four people ${people.join(", ")} are in a race. If ${people[0]} finishes before ${people[1]}, and ${people[1]} finishes before ${people[2]}, who finishes first?`,
          correct,
          distractors: [people[1], people[2], people[3]],
          explanation: `Given ${people[0]} > ${people[1]} > ${people[2]}, ${people[0]} must be first.`,
        })
      );
    }
    return qs;
  }

  function genSeatingArrangement(rng, count, prefix) {
    const qs = [];
    const persons = ["A", "B", "C", "D", "E"];
    for (let i = 0; i < count; i++) {
      const order = shuffleWithRng(rng, persons);
      const idxA = order.indexOf("A");
      const rightOfA = order[(idxA + 1) % order.length];
      qs.push(
        makeMCQ({
          id: `${prefix}-seat-${i + 1}`,
          question: `Five people sit in a circle in the order ${order.join("-")} (clockwise). Who sits immediately to the right of A?`,
          correct: rightOfA,
          distractors: shuffleWithRng(rng, persons.filter((p) => p !== rightOfA)).slice(0, 3),
          explanation: `In a clockwise circle, the person immediately after A is to A's right. Here, it's ${rightOfA}.`,
        })
      );
    }
    return qs;
  }

  function genSynAnt(rng, count, prefix) {
    const bank = [
      { w: "abundant", syn: "plentiful", ant: "scarce" },
      { w: "brave", syn: "courageous", ant: "cowardly" },
      { w: "ancient", syn: "old", ant: "modern" },
      { w: "expand", syn: "increase", ant: "reduce" },
      { w: "fragile", syn: "delicate", ant: "sturdy" },
      { w: "rapid", syn: "swift", ant: "slow" },
      { w: "optimistic", syn: "hopeful", ant: "pessimistic" },
      { w: "tiny", syn: "small", ant: "huge" },
      { w: "honest", syn: "truthful", ant: "deceitful" },
      { w: "silent", syn: "quiet", ant: "noisy" },
    ];
    const qs = [];
    for (let i = 0; i < count; i++) {
      const item = bank[i % bank.length];
      const mode = i % 2 === 0 ? "syn" : "ant";
      const correct = mode === "syn" ? item.syn : item.ant;
      const distractors = shuffleWithRng(
        rng,
        bank
          .filter((b) => b.w !== item.w)
          .map((b) => (mode === "syn" ? b.syn : b.ant))
      ).slice(0, 3);
      qs.push(
        makeMCQ({
          id: `${prefix}-sa-${i + 1}`,
          question: `Choose the ${mode === "syn" ? "synonym" : "antonym"} of "${item.w}".`,
          correct,
          distractors,
          explanation: `The ${mode === "syn" ? "synonym" : "antonym"} of "${item.w}" is "${correct}".`,
        })
      );
    }
    return qs;
  }

  function genGrammarChooseCorrect(rng, count, prefix, label) {
    const qs = [];
    const pairs = [
      { good: "Neither of the students is ready.", bad: "Neither of the students are ready." },
      { good: "He has fewer books than I do.", bad: "He has less books than I do." },
      { good: "She and I went to the market.", bad: "Me and her went to the market." },
      { good: "Each of the players was given a medal.", bad: "Each of the players were given a medal." },
      { good: "I have been living here for five years.", bad: "I am living here since five years." },
      { good: "The news is very important.", bad: "The news are very important." },
      { good: "He is good at mathematics.", bad: "He is good in mathematics." },
      { good: "Between you and me, this is confidential.", bad: "Between you and I, this is confidential." },
      { good: "If I were you, I would study.", bad: "If I was you, I would study." },
    ];
    for (let i = 0; i < count; i++) {
      const p = pairs[i % pairs.length];
      const correct = p.good;
      const distractors = shuffleWithRng(rng, [
        p.bad,
        pick(rng, pairs).bad,
        pick(rng, pairs).bad,
      ]).slice(0, 3);
      qs.push(
        makeMCQ({
          id: `${prefix}-gram-${i + 1}`,
          question: `${label}: Choose the correct sentence.`,
          correct,
          distractors,
          explanation: `Correct usage: "${p.good}"`,
        })
      );
    }
    return qs;
  }

  function genFillBlanks(rng, count, prefix) {
    const qs = [];
    const bank = [
      { s: "He was too tired to ____.", a: "doze", d: ["argue", "jog", "boast"] },
      { s: "She completed the work ____ time.", a: "on", d: ["in", "at", "for"] },
      { s: "The teacher asked us to ____ attention.", a: "pay", d: ["give", "take", "make"] },
      { s: "He is known for his ____ honesty.", a: "utter", d: ["under", "upper", "outer"] },
      { s: "We must ____ the rules.", a: "follow", d: ["borrow", "throw", "blow"] },
    ];
    for (let i = 0; i < count; i++) {
      const it = bank[i % bank.length];
      qs.push(
        makeMCQ({
          id: `${prefix}-fb-${i + 1}`,
          question: `Fill in the blank: ${it.s}`,
          correct: it.a,
          distractors: shuffleWithRng(rng, it.d).slice(0, 3),
          explanation: `Best fit is "${it.a}".`,
        })
      );
    }
    return qs;
  }

  function genParaJumbles(rng, count, prefix) {
    const qs = [];
    const sets = [
      {
        parts: [
          "A) The sun was setting behind the hills.",
          "B) The sky turned orange and pink.",
          "C) Birds flew back to their nests.",
          "D) The village lights began to glow.",
        ],
        correct: "A-B-C-D",
        distractors: ["B-A-C-D", "A-C-B-D", "A-B-D-C"],
      },
      {
        parts: [
          "A) She opened the box carefully.",
          "B) A tiny note lay inside.",
          "C) The handwriting looked familiar.",
          "D) She smiled as she read it.",
        ],
        correct: "A-B-C-D",
        distractors: ["A-C-B-D", "B-A-C-D", "A-B-D-C"],
      },
      {
        parts: [
          "A) First, gather all the ingredients.",
          "B) Next, mix them in a bowl.",
          "C) Then, bake the mixture until golden.",
          "D) Finally, let it cool before serving.",
        ],
        correct: "A-B-C-D",
        distractors: ["B-A-C-D", "A-C-B-D", "A-B-D-C"],
      },
      {
        parts: [
          "A) The team discussed the plan.",
          "B) Everyone agreed on their roles.",
          "C) They started work immediately.",
          "D) The project finished ahead of schedule.",
        ],
        correct: "A-B-C-D",
        distractors: ["A-C-B-D", "B-A-C-D", "A-B-D-C"],
      },
      {
        parts: [
          "A) The phone rang suddenly.",
          "B) He answered and listened quietly.",
          "C) The message surprised him.",
          "D) He decided to leave at once.",
        ],
        correct: "A-B-C-D",
        distractors: ["B-A-C-D", "A-C-B-D", "A-B-D-C"],
      },
    ];
    for (let i = 0; i < count; i++) {
      const s = sets[i % sets.length];
      qs.push(
        makeMCQ({
          id: `${prefix}-pj-${i + 1}`,
          question: `Para jumbles: Arrange the sentences in a logical order.\n${s.parts.join("\n")}`,
          correct: s.correct,
          distractors: shuffleWithRng(rng, s.distractors).slice(0, 3),
          explanation: `A natural flow is: ${s.correct}.`,
        })
      );
    }
    return qs;
  }

  function genReadingComprehension(prefix) {
    // 5 passages x 5 questions = 25 (fixed, high-quality, no RNG needed)
    const passages = [
      {
        p:
          "Passage 1: A library is more than a storehouse of books. It is a shared space where curiosity is rewarded and quiet effort becomes a habit. Regular readers often develop better focus and vocabulary over time.",
        qs: [
          { q: "What is the main idea of the passage?", c: "A library supports learning habits.", d: ["Libraries are always silent.", "Books are expensive.", "Curiosity is discouraged."] },
          { q: "According to the passage, regular reading improves:", c: "focus and vocabulary", d: ["speed and height", "taste and smell", "wealth and fame"] },
          { q: "A library is described as:", c: "a shared space", d: ["a private club", "a noisy market", "an empty hall"] },
          { q: "The word closest to 'storehouse' is:", c: "warehouse", d: ["window", "river", "festival"] },
          { q: "The tone of the passage is:", c: "positive", d: ["sarcastic", "angry", "fearful"] },
        ],
      },
      {
        p:
          "Passage 2: Small daily improvements are easier to sustain than rare bursts of effort. When goals are broken into tiny steps, progress becomes visible, and motivation tends to follow action rather than precede it.",
        qs: [
          { q: "What does the passage recommend?", c: "small daily improvements", d: ["rare bursts only", "no goals at all", "waiting for motivation"] },
          { q: "Breaking goals into steps makes progress:", c: "visible", d: ["invisible", "impossible", "irrelevant"] },
          { q: "According to the passage, motivation tends to:", c: "follow action", d: ["prevent action", "never change", "come only first"] },
          { q: "Sustain means:", c: "maintain", d: ["forget", "damage", "escape"] },
          { q: "The best title is:", c: "Consistency over intensity", d: ["The problem with effort", "Avoid progress", "Motivation is useless"] },
        ],
      },
      {
        p:
          "Passage 3: Traffic congestion is not only a problem of too many vehicles, but also of poor coordination. Better signals, reliable public transport, and safe walking routes can reduce delays without expanding roads endlessly.",
        qs: [
          { q: "Congestion is caused by:", c: "vehicles and poor coordination", d: ["only rain", "only signals", "only walking"] },
          { q: "One suggested solution is:", c: "reliable public transport", d: ["removing signals", "closing sidewalks", "adding endless roads only"] },
          { q: "The passage implies expanding roads:", c: "is not the only answer", d: ["solves everything", "is always cheap", "is unnecessary forever"] },
          { q: "Safe walking routes help by:", c: "reducing delays", d: ["increasing vehicles", "breaking signals", "raising prices"] },
          { q: "Coordination refers to:", c: "managing systems together", d: ["painting cars", "selling tickets", "washing roads"] },
        ],
      },
      {
        p:
          "Passage 4: In science, a failed experiment can still be valuable. It may reveal hidden assumptions, improve methods, or narrow down which explanations are possible. The key is to record results carefully and learn from them.",
        qs: [
          { q: "A failed experiment can be:", c: "valuable", d: ["always useless", "illegal", "never recorded"] },
          { q: "It may reveal:", c: "hidden assumptions", d: ["only luck", "only money", "only secrets"] },
          { q: "The key action is to:", c: "record results carefully", d: ["hide results", "repeat without notes", "ignore methods"] },
          { q: "Narrow down means:", c: "reduce possibilities", d: ["increase noise", "expand randomly", "forget everything"] },
          { q: "The passage promotes:", c: "learning from outcomes", d: ["avoiding science", "fear of failure", "guessing only"] },
        ],
      },
      {
        p:
          "Passage 5: A healthy team communicates expectations clearly. When roles are ambiguous, work may be duplicated or ignored. Simple check-ins and shared notes reduce confusion and help everyone move in the same direction.",
        qs: [
          { q: "A healthy team communicates:", c: "expectations clearly", d: ["only complaints", "nothing", "secrets"] },
          { q: "Ambiguous roles can cause work to be:", c: "duplicated or ignored", d: ["perfect", "finished instantly", "free"] },
          { q: "Check-ins and shared notes:", c: "reduce confusion", d: ["increase confusion", "stop progress", "remove roles"] },
          { q: "The opposite of ambiguous is:", c: "clear", d: ["random", "noisy", "weak"] },
          { q: "The best summary is:", c: "clarity improves teamwork", d: ["teams are unnecessary", "notes are harmful", "confusion is good"] },
        ],
      },
    ];

    const out = [];
    let n = 0;
    for (const pass of passages) {
      for (const q of pass.qs) {
        n += 1;
        out.push(
          makeMCQ({
            id: `${prefix}-rc-${n}`,
            question: `${pass.p}\n\n${q.q}`,
            correct: q.c,
            distractors: q.d,
            explanation: `Based on the passage, the correct answer is "${q.c}".`,
          })
        );
      }
    }
    return out;
  }

  function genVocabBuilder(rng, count, prefix) {
    const bank = [
      { w: "benevolent", m: "kind and helpful" },
      { w: "meticulous", m: "very careful and precise" },
      { w: "obscure", m: "not well known; unclear" },
      { w: "concise", m: "brief but complete" },
      { w: "resilient", m: "able to recover quickly" },
      { w: "inevitable", m: "certain to happen" },
      { w: "novice", m: "a beginner" },
      { w: "diligent", m: "hard-working and careful" },
      { w: "vivid", m: "very clear and detailed" },
      { w: "frugal", m: "careful with money" },
    ];
    const qs = [];
    for (let i = 0; i < count; i++) {
      const it = bank[i % bank.length];
      const correct = it.m;
      const distractors = shuffleWithRng(
        rng,
        bank
          .filter((b) => b.w !== it.w)
          .map((b) => b.m)
      ).slice(0, 3);
      qs.push(
        makeMCQ({
          id: `${prefix}-vb-${i + 1}`,
          question: `Vocabulary: What does "${it.w}" mean?`,
          correct,
          distractors,
          explanation: `"${it.w}" means "${it.m}".`,
        })
      );
    }
    return qs;
  }

  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x;
  }

  // Syllabus topics (25 total)
  // category: aptitude | reasoning | verbal
  const TOPIC_DEFS = [
    // 1) Aptitude
    { id: "aptitude", category: "aptitude", label: "Aptitude", desc: "Mixed quantitative practice (25 questions)." },
    { id: "quantitative-aptitude", category: "aptitude", label: "Quantitative aptitude", desc: "Mixed arithmetic-focused practice (25 questions)." },
    { id: "number-system", category: "aptitude", label: "Number system", desc: "HCF/LCM, remainders, digit sums." },
    { id: "profit-loss", category: "aptitude", label: "Profit & Loss", desc: "Selling price, profit/loss percent." },
    { id: "time-work", category: "aptitude", label: "Time & Work", desc: "Work rates and combined time." },
    { id: "tsd", category: "aptitude", label: "Time, Speed & Distance", desc: "Distance = speed × time." },
    { id: "percentage", category: "aptitude", label: "Percentage", desc: "Percentage calculations and shortcuts." },
    { id: "ratio-proportion", category: "aptitude", label: "Ratio & Proportion", desc: "Ratios, proportions and totals." },
    { id: "interest", category: "aptitude", label: "Simple & Compound Interest", desc: "SI/CI amount (rounded)." },
    { id: "probability", category: "aptitude", label: "Probability", desc: "Basic probability with fractions." },

    // 2) Reasoning
    { id: "logical-reasoning", category: "reasoning", label: "Logical reasoning", desc: "Core logical thinking MCQs." },
    { id: "coding-decoding", category: "reasoning", label: "Coding decoding", desc: "Letter shifting and simple codes." },
    { id: "blood-relations", category: "reasoning", label: "Blood relations", desc: "Family relationship problems." },
    { id: "direction-sense", category: "reasoning", label: "Direction sense", desc: "Movement and displacement." },
    { id: "series-completion", category: "reasoning", label: "Series completion", desc: "Number series and patterns." },
    { id: "puzzles", category: "reasoning", label: "Puzzles", desc: "Small logic puzzles." },
    { id: "syllogism", category: "reasoning", label: "Syllogism", desc: "Conclusions from statements." },
    { id: "seating-arrangement", category: "reasoning", label: "Seating arrangement", desc: "Circular seating order questions." },

    // 3) Verbal Ability
    { id: "syn-ant", category: "verbal", label: "Synonyms / Antonyms", desc: "Word meaning practice." },
    { id: "spotting-errors", category: "verbal", label: "Spotting errors", desc: "Identify correct grammar." },
    { id: "sentence-correction", category: "verbal", label: "Sentence correction", desc: "Choose the best sentence." },
    { id: "fill-blanks", category: "verbal", label: "Fill in the blanks", desc: "Pick the best-fit word." },
    { id: "reading-comp", category: "verbal", label: "Reading comprehension", desc: "Passage-based questions." },
    { id: "para-jumbles", category: "verbal", label: "Para jumbles", desc: "Arrange sentences logically." },
    { id: "vocab-builder", category: "verbal", label: "Vocabulary builder", desc: "Meanings and usage." },
  ];

  const TOPIC_BY_ID = Object.fromEntries(TOPIC_DEFS.map((t) => [t.id, t]));

  function generateQuestionsForTopic(topicId) {
    const seed = hashStringToSeed(`topic:${topicId}`);
    const rng = mulberry32(seed);
    const prefix = topicId;
    const N = 25;

    // Quantitative pool generators
    const quantPool = () =>
      shuffleWithRng(rng, [
        ...genNumberSystem(rng, 6, prefix),
        ...genProfitLoss(rng, 6, prefix),
        ...genTimeWork(rng, 5, prefix),
        ...genTSD(rng, 4, prefix),
        ...genPercentage(rng, 6, prefix),
        ...genRatioProportion(rng, 5, prefix),
        ...genInterest(rng, 5, prefix),
        ...genProbability(rng, 4, prefix),
      ]);

    // Reasoning pool
    const reasoningPool = () =>
      shuffleWithRng(rng, [
        ...genSeriesCompletion(rng, 6, prefix),
        ...genDirectionSense(rng, 5, prefix),
        ...genCodingDecoding(rng, 5, prefix),
        ...genBloodRelations(rng, 4, prefix),
        ...genSyllogism(rng, 5, prefix),
        ...genSeatingArrangement(rng, 4, prefix),
        ...genPuzzles(rng, 4, prefix),
      ]);

    let raw = [];
    switch (topicId) {
      // Aptitude / Quant
      case "aptitude":
      case "quantitative-aptitude":
        raw = quantPool().slice(0, N);
        break;
      case "number-system":
        raw = genNumberSystem(rng, N, prefix);
        break;
      case "profit-loss":
        raw = genProfitLoss(rng, N, prefix);
        break;
      case "time-work":
        raw = genTimeWork(rng, N, prefix);
        break;
      case "tsd":
        raw = genTSD(rng, N, prefix);
        break;
      case "percentage":
        raw = genPercentage(rng, N, prefix);
        break;
      case "ratio-proportion":
        raw = genRatioProportion(rng, N, prefix);
        break;
      case "interest":
        raw = genInterest(rng, N, prefix);
        break;
      case "probability":
        raw = genProbability(rng, N, prefix);
        break;

      // Reasoning
      case "logical-reasoning":
        raw = reasoningPool().slice(0, N);
        break;
      case "coding-decoding":
        raw = genCodingDecoding(rng, N, prefix);
        break;
      case "blood-relations":
        raw = genBloodRelations(rng, N, prefix);
        break;
      case "direction-sense":
        raw = genDirectionSense(rng, N, prefix);
        break;
      case "series-completion":
        raw = genSeriesCompletion(rng, N, prefix);
        break;
      case "puzzles":
        raw = genPuzzles(rng, N, prefix);
        break;
      case "syllogism":
        raw = genSyllogism(rng, N, prefix);
        break;
      case "seating-arrangement":
        raw = genSeatingArrangement(rng, N, prefix);
        break;

      // Verbal
      case "syn-ant":
        raw = genSynAnt(rng, N, prefix);
        break;
      case "spotting-errors":
        raw = genGrammarChooseCorrect(rng, N, prefix, "Spotting errors");
        break;
      case "sentence-correction":
        raw = genGrammarChooseCorrect(rng, N, prefix, "Sentence correction");
        break;
      case "fill-blanks":
        raw = genFillBlanks(rng, N, prefix);
        break;
      case "reading-comp":
        raw = genReadingComprehension(prefix);
        break;
      case "para-jumbles":
        raw = genParaJumbles(rng, N, prefix);
        break;
      case "vocab-builder":
        raw = genVocabBuilder(rng, N, prefix);
        break;
      default:
        raw = quantPool().slice(0, N);
    }

    return finalizeQuestions(rng, raw).slice(0, N);
  }

  function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function formatTopicLabel(topicId) {
    return TOPIC_BY_ID[topicId]?.label || topicId;
  }

  function formatCategoryLabel(cat) {
    if (cat === "aptitude") return "Aptitude";
    if (cat === "reasoning") return "Reasoning";
    if (cat === "verbal") return "Verbal";
    return cat;
  }

  function renderTopics({ category = "all", search = "" } = {}) {
    if (!topicsGrid) return;
    const q = (search || "").trim().toLowerCase();
    const filtered = TOPIC_DEFS.filter((t) => {
      const catOk = category === "all" ? true : t.category === category;
      const searchOk =
        q.length === 0 ||
        t.label.toLowerCase().includes(q) ||
        t.desc.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q);
      return catOk && searchOk;
    });

    topicsGrid.innerHTML = "";

    filtered.forEach((t, idx) => {
      const id = `topic_${t.id}`;
      const label = document.createElement("label");
      label.className = "topic-card";
      label.setAttribute("data-topic-card", "");
      label.setAttribute("for", id);
      label.setAttribute("tabindex", "0");
      label.setAttribute("role", "button");

      const input = document.createElement("input");
      input.className = "topic-radio";
      input.type = "radio";
      input.name = "topic";
      input.id = id;
      input.value = t.id;
      // Default select first visible topic.
      if (idx === 0) input.checked = true;

      const content = document.createElement("div");
      content.className = "topic-content";

      const title = document.createElement("div");
      title.className = "topic-title";
      title.textContent = t.label;

      const meta = document.createElement("div");
      meta.className = "topic-meta";
      const pill1 = document.createElement("span");
      pill1.className = "pill";
      pill1.textContent = "25 questions";
      const pill2 = document.createElement("span");
      pill2.className = "pill";
      pill2.textContent = formatCategoryLabel(t.category);
      meta.appendChild(pill1);
      meta.appendChild(pill2);

      const desc = document.createElement("div");
      desc.className = "topic-desc";
      desc.textContent = t.desc;

      content.appendChild(title);
      content.appendChild(meta);
      content.appendChild(desc);

      label.appendChild(input);
      label.appendChild(content);

      label.addEventListener("click", () => {
        input.checked = true;
      });
      label.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          input.checked = true;
        }
      });

      topicsGrid.appendChild(label);
    });
  }

  function showPage(which) {
    const map = {
      topics: pageTopics,
      quiz: pageQuiz,
      result: pageResult,
    };
    Object.entries(map).forEach(([k, el]) => {
      if (!el) return;
      el.classList.toggle("hidden", k !== which);
    });
  }

  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  let state = {
    topicId: null,
    questions: [],
    idx: 0,
    answers: [], // {questionId, selectedIndex, correctIndex, isCorrect, explanation}
    locked: false, // prevents multiple clicks during feedback
  };

  function resetQuizState() {
    state = {
      topicId: null,
      questions: [],
      idx: 0,
      answers: [],
      locked: false,
    };
    feedbackBox.classList.add("hidden");
    feedbackBox.textContent = "";
    backBtn.disabled = true;
    skipBtn.disabled = true;
    nextBtn.disabled = false;
  }

  function setProgress() {
    const total = state.questions.length || 1;
    const current = state.idx; // 0-based index for current question
    const pct = clamp(Math.round((current / total) * 100), 0, 100);
    progressBar.style.width = `${pct}%`;
    quizCount.textContent = `Question ${current + 1} of ${total}`;
  }

  function setFeedback(text, kind) {
    feedbackBox.classList.remove("hidden", "good", "bad");
    if (kind) feedbackBox.classList.add(kind);
    feedbackBox.textContent = text;
  }

  function renderOptions(question) {
    optionsGrid.innerHTML = "";
    feedbackBox.classList.add("hidden");
    feedbackBox.textContent = "";

    question.options.forEach((opt, optIndex) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn neutral";
      btn.dataset.optIndex = String(optIndex);
      btn.textContent = opt;

      btn.addEventListener("click", () => {
        if (state.locked) return;
        const selectedIndex = optIndex;
        lockOptionsAndRecord(selectedIndex);
      });

      optionsGrid.appendChild(btn);
    });

    const prevAnswer = state.answers.find((a) => a.questionId === question.id);
    // If user went back, mark previous selection.
    if (prevAnswer && typeof prevAnswer.selectedIndex === "number") {
      paintOptionSelection(prevAnswer, question);
      // Also show feedback but keep controls consistent.
      const feedbackKind = prevAnswer.isCorrect ? "good" : "bad";
      setFeedback(
        prevAnswer.isCorrect ? "Correct. Nice work!" : "Not quite. Review the explanation below.",
        feedbackKind
      );
      state.locked = true;
      nextBtn.disabled = false;
      skipBtn.disabled = true;
      backBtn.disabled = state.idx === 0;
    } else {
      state.locked = false;
      nextBtn.disabled = true; // until an answer is chosen or skipped
      skipBtn.disabled = false;
      backBtn.disabled = state.idx === 0;
    }
  }

  function paintOptionSelection(answer, question) {
    const optButtons = Array.from(optionsGrid.querySelectorAll(".option-btn"));
    optButtons.forEach((b) => {
      const optIndex = Number(b.dataset.optIndex);
      b.classList.remove("correct", "wrong", "neutral");
      if (optIndex === answer.correctIndex) b.classList.add("correct");
      if (optIndex === answer.selectedIndex && !answer.isCorrect) b.classList.add("wrong");
      if (optIndex === answer.selectedIndex && answer.isCorrect) b.classList.add("correct");
      if (![answer.correctIndex, answer.selectedIndex].includes(optIndex)) b.classList.add("neutral");
    });
  }

  function lockOptionsAndRecord(selectedIndex) {
    const question = state.questions[state.idx];
    const correctIndex = question.correctIndex;
    const isCorrect = selectedIndex === correctIndex;

    // Mark chosen + correct.
    const answerRecord = {
      questionId: question.id,
      selectedIndex,
      correctIndex,
      isCorrect,
      explanation: question.explanation || "",
    };
    const existingIdx = state.answers.findIndex((a) => a.questionId === question.id);
    if (existingIdx >= 0) state.answers[existingIdx] = answerRecord;
    else state.answers.push(answerRecord);

    paintOptionSelection(answerRecord, question);

    const feedbackKind = isCorrect ? "good" : "bad";
    const chosenText = question.options[selectedIndex];
    const correctText = question.options[correctIndex];
    const msg = isCorrect
      ? `Correct! ${chosenText} is the right answer.`
      : `Wrong. You chose "${chosenText}". Correct is "${correctText}".`;

    setFeedback(msg, feedbackKind);

    // Append a short explanation.
    if (answerRecord.explanation) {
      feedbackBox.textContent = `${msg} ${answerRecord.explanation}`;
    }

    state.locked = true;
    nextBtn.disabled = false;
    skipBtn.disabled = true;
    backBtn.disabled = state.idx === 0;

    // Prevent clicking again.
    Array.from(optionsGrid.querySelectorAll(".option-btn")).forEach((b) => {
      b.disabled = true;
    });
    // Re-enable selected correctness coloring remains.
  }

  function skipQuestion() {
    if (state.locked) return;
    const question = state.questions[state.idx];
    const correctIndex = question.correctIndex;
    const answerRecord = {
      questionId: question.id,
      selectedIndex: -1,
      correctIndex,
      isCorrect: false,
      explanation: question.explanation || "",
    };

    const existingIdx = state.answers.findIndex((a) => a.questionId === question.id);
    if (existingIdx >= 0) state.answers[existingIdx] = answerRecord;
    else state.answers.push(answerRecord);

    // Disable buttons, show correct.
    paintOptionSelection(answerRecord, question);
    setFeedback("Skipped. Review the explanation before moving on.", "bad");
    if (answerRecord.explanation) feedbackBox.textContent = `Skipped. ${answerRecord.explanation}`;

    state.locked = true;
    nextBtn.disabled = false;
    skipBtn.disabled = true;
    backBtn.disabled = state.idx === 0;
    Array.from(optionsGrid.querySelectorAll(".option-btn")).forEach((b) => (b.disabled = true));
  }

  function renderQuestion() {
    const question = state.questions[state.idx];
    questionText.textContent = question.question;

    // Enable buttons (renderOptions creates fresh buttons each time).
    optionsGrid.querySelectorAll(".option-btn").forEach((b) => (b.disabled = false));

    setProgress();
    // Reset next/feedback while options are being rendered.
    feedbackBox.classList.add("hidden");
    feedbackBox.textContent = "";
    nextBtn.disabled = true;

    renderOptions(question);

    // Ensure buttons default enabled.
    Array.from(optionsGrid.querySelectorAll(".option-btn")).forEach((b) => (b.disabled = false));
  }

  function computeScore() {
    const total = state.questions.length;
    const correct = state.answers.filter((a) => a.isCorrect).length;
    const pct = total ? Math.round((correct / total) * 100) : 0;
    return { total, correct, pct };
  }

  function scoreMessage(pct) {
    if (pct >= 90) return "Exceptional work. Keep the momentum!";
    if (pct >= 70) return "Great job. You have solid fundamentals.";
    if (pct >= 50) return "Good start. Review the misses and try again.";
    return "Keep practicing. You’ll improve with repetition.";
  }

  function setRing(pct) {
    // SVG circle uses pathLength=100, so we can map pct directly.
    const clamped = clamp(pct, 0, 100);
    ringProgress.style.strokeDashoffset = `${100 - clamped}`;
    resultScore.textContent = `${clamped}%`;
  }

  function renderResults() {
    const { total, correct, pct } = computeScore();
    setRing(pct);

    resultTitle.textContent = `Your Results`;
    resultLine.textContent = `Correct: ${correct} / ${total}`;
    resultMeta.textContent = scoreMessage(pct);

    reviewList.innerHTML = "";

    const incorrectAnswers = state.answers.filter((a) => !a.isCorrect);
    const incorrectCount = incorrectAnswers.length;

    if (incorrectCount === 0) {
      reviewEmpty.classList.remove("hidden");
    } else {
      reviewEmpty.classList.add("hidden");
    }

    // Only show questions you answered incorrectly (or skipped).
    incorrectAnswers.forEach((a) => {
      const q = state.questions.find((qq) => qq.id === a.questionId);
      if (!q) return;

      const card = document.createElement("div");
      card.className = "review-card";

      const qTitle = document.createElement("div");
      qTitle.className = "review-q";
      qTitle.textContent = q.question;

      const choices = document.createElement("div");
      choices.className = "review-choices";

      const row1 = document.createElement("div");
      row1.className = "choice-row";

      const badge1 = document.createElement("span");
      badge1.className = "badge bad";
      badge1.textContent = a.selectedIndex >= 0 ? "Your answer" : "Skipped";

      const text1 = document.createElement("div");
      text1.className = "choice-text";
      text1.textContent = a.selectedIndex >= 0 ? q.options[a.selectedIndex] : "-";

      row1.appendChild(badge1);
      row1.appendChild(text1);

      const row2 = document.createElement("div");
      row2.className = "choice-row";
      row2.style.marginTop = "10px";

      const badge2 = document.createElement("span");
      badge2.className = "badge good";
      badge2.textContent = "Correct answer";

      const text2 = document.createElement("div");
      text2.className = "choice-text";
      text2.textContent = q.options[a.correctIndex];

      row2.appendChild(badge2);
      row2.appendChild(text2);

      const expl = document.createElement("div");
      expl.className = "hint";
      expl.style.marginTop = "10px";
      expl.style.marginBottom = "0";
      expl.textContent = q.explanation ? `Explanation: ${q.explanation}` : "";

      choices.appendChild(row1);
      choices.appendChild(row2);
      if (q.explanation) choices.appendChild(expl);

      card.appendChild(qTitle);
      card.appendChild(choices);
      reviewList.appendChild(card);
    });

    // If user skipped all, we still hide list? It will show all cards.
  }

  function startQuiz(topicId) {
    resetQuizState();
    state.topicId = topicId;

    const all = generateQuestionsForTopic(topicId);
    const shuffled = shuffleInPlace(all.slice());
    state.questions = shuffled.slice(0, 25);

    state.idx = 0;
    state.answers = [];

    quizHeading.textContent = `${formatTopicLabel(topicId)} Quiz`;
    quizSubheading.textContent = `${state.questions.length} multiple-choice questions`;

    feedbackBox.classList.add("hidden");
    nextBtn.textContent = "Next";

    showPage("quiz");
    renderQuestion();

    // Control buttons
    nextBtn.disabled = true; // until an answer is selected/skipped
    skipBtn.disabled = false;
    backBtn.disabled = true;
  }

  function finishQuiz() {
    // Ensure progress bar shows 100% on finish.
    progressBar.style.width = `100%`;
    quizCount.textContent = `Completed`;
    nextBtn.disabled = true;
    skipBtn.disabled = true;
    backBtn.disabled = true;
    showPage("result");
    renderResults();
  }

  function goNext() {
    if (!state.locked) return;
    if (state.idx < state.questions.length - 1) {
      state.idx += 1;
      // Re-enable buttons for next question.
      nextBtn.disabled = true;
      skipBtn.disabled = false;
      backBtn.disabled = state.idx === 0;
      state.locked = false;
      renderQuestion();
    } else {
      finishQuiz();
    }
  }

  function goBack() {
    if (state.idx <= 0) return;
    // Allow back navigation even after answering; options rendering will mark previous selection.
    state.idx -= 1;
    state.locked = false;
    nextBtn.disabled = true;
    skipBtn.disabled = false;
    backBtn.disabled = state.idx === 0;
    renderQuestion();
  }

  function resetAll() {
    resetQuizState();
    // Re-render topics with defaults (first topic selected).
    renderTopics({ category: "all", search: "" });
    showPage("topics");
  }

  // --- Events ---
  startBtn.addEventListener("click", () => {
    const selected = document.querySelector('input[name="topic"]:checked');
    if (!selected) return;
    startQuiz(selected.value);
  });

  practiceAgainBtn.addEventListener("click", () => {
    // Restart with the same topic for better practice.
    if (state.topicId) startQuiz(state.topicId);
    else showPage("topics");
  });

  nextBtn.addEventListener("click", goNext);
  backBtn.addEventListener("click", goBack);
  skipBtn.addEventListener("click", skipQuestion);
  resetBtn.addEventListener("click", resetAll);

  let uiFilter = { category: "all", search: "" };
  categoryButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const cat = btn.dataset.cat || "all";
      uiFilter.category = cat;
      categoryButtons.forEach((b) => b.classList.toggle("is-active", b === btn));
      renderTopics(uiFilter);
    });
  });

  if (topicSearch) {
    topicSearch.addEventListener("input", (e) => {
      uiFilter.search = e.target.value || "";
      renderTopics(uiFilter);
    });
  }

  // Initialize.
  resetAll();
})();


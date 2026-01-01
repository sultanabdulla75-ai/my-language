// ------------------------------------------------------
// منصة لغتي - ملف app.js
// ------------------------------------------------------

// ===== متغير عام للقصة الحالية في القارئ =====
let currentBook = null;
// وقت بدء القراءة الحالي (بالمللي ثانية)
let readingStartAt = null;

let readingStartTime = null;
let hasInteractedWithStory = false;

let interactionCount = 0;
let maxScrollPercent = 0;

let activeReadingStartAt = null;


// ===== Firestore Imports =====
import {
  doc,
  setDoc,
  getDoc,
  getDocs,
  collection,
  deleteDoc,
  updateDoc,

  // 🔔 إشعارات (إضافة مطلوبة)
  query,
  where,
  orderBy,
  onSnapshot

} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ملاحظة: سنستخدم window.db الذي تم ضبطه في index.html


import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js";



// =========================================
// 📊 Teacher Statistics (Firestore)
// =========================================
async function getCompletedCount(classId) {
  const q = query(
    collection(window.db, "submissions"),
    where("classId", "==", classId),
    where("status", "==", "submitted"),
    where("countInStats", "==", true)
  );
  const snap = await getDocs(q);
  return snap.size;
}

async function getClassAverageProgress(classId) {
  const q = query(
    collection(window.db, "submissions"),
    where("classId", "==", classId),
    where("countInStats", "==", true)
  );

  const snap = await getDocs(q);
  if (snap.empty) return 0;

  let total = 0;
  let count = 0;
  snap.forEach(doc => {
    const d = doc.data();
    if (typeof d.progress === "number") {
      total += d.progress;
      count++;
    }
  });

  return count ? Math.round(total / count) : 0;
}

// =========================================
// 📊 Teacher Statistics (Firestore - FINAL)
// =========================================


// ===== Storage keys =====
const LS = {
  USERS: 'arp.users',
  CURRENT: 'arp.current',
  ROLE: 'arp.role',
  CLASSES: 'arp.classes',
  ASSIGN: 'arp.assignments',
  STATS: uid => `arp.stats.${uid}`
};

// ===== Daily Challenge & Achievements =====
const LS_CHALLENGE = uid => `arp.challenge.${uid}`;
const LS_ACHIEVEMENTS = uid => `arp.achievements.${uid}`;


// ===== Data =====
const LEVELS = [
  { id: 'L1', name: 'المستوى 1 (مبتدئ)' },
  { id: 'L2', name: 'المستوى 2 (أساسي)' },
  { id: 'L3', name: 'المستوى 3 (متوسط)' },
  { id: 'L4', name: 'المستوى 4 (متقدم)' }
];

// 🔼 تحديد المستوى التالي تلقائيًا
function getNextLevel(currentLevel) {
  const idx = LEVELS.findIndex(l => l.id === currentLevel);
  if (idx === -1 || idx === LEVELS.length - 1) return null;
  return LEVELS[idx + 1].id;
}

// 🔁 المتابعة التلقائية بعد إنهاء القراءة
async function autoContinueReading() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== "student") return;

  const nextBook = await getNextBookForStudent(); // (سأصلّحها تحت)
  if (nextBook) {
    openReader(nextBook);
    return;
  }

  const nextLevel = getNextLevel(current.level);

  if (!nextLevel) {
    showCongratsModal({
      title: "🏆 مبروك!",
      message: "أنهيت جميع المستويات 🎉",
      btnText: "العودة للرئيسية",
      onOk: () => showOnly("#tab-home")
    });
    return;
  }

  await updateStudentLevel(nextLevel);

  showCongratsModal({
    title: "🌟 مستوى جديد!",
    message: `انتقلت إلى ${LEVELS.find(l => l.id === nextLevel)?.name}`,
    btnText: "ابدأ أول قصة",
    onOk: () => {
      const firstBook = BOOKS.find(b => b.level === nextLevel);
      if (firstBook) openReader(firstBook);
      else showOnly("#tab-levels");
    }
  });
}


// ============================================
// 🏆 Achievements Definitions
// ============================================
const ACHIEVEMENTS = [
  { id: "reader1", title: "قارئ مبتدئ", icon: "📘", condition: s => s.reads >= 3 },
  { id: "reader2", title: "قارئ مجتهد", icon: "📗", condition: s => s.reads >= 10 },
  { id: "reader3", title: "قارئ متميز", icon: "📕", condition: s => s.reads >= 25 },
  {
    id: "daily",
    title: "بطل التحدي",
    icon: "🎯",
    condition: () => {
      const cur = readJSON(LS.CURRENT, null);
      if (!cur) return false;
      const ch = readJSON(LS_CHALLENGE(cur.id), {});
      return ch.done;
    }
  }
];


const BOOKS = [
  {
    id: 'b1',
    level: 'L1',
    title: 'الصداقة',
    cover: 'https://picsum.photos/seed/b1/160/210',
    text: [
      'في يومٍ جميلٍ التقى سالمٌ وصديقُه راشدٌ في الحديقة.',
      'تحدّثا عن معنى الصداقة، ووعدا أن يساعد كلُّ واحدٍ منهما الآخر.'
    ],
    quiz: [
      {
        q: "أين التقى سالم وراشد؟",
        options: ["في السوق", "في الحديقة", "في المدرسة"],
        correct: 1
      },
      {
        q: "ماذا وعد الصديقان؟",
        options: ["ألا يتكلما", "أن يساعد كل واحد الآخر", "أن يذهبا للبيت"],
        correct: 1
      }
    ]
  },
  {
    id: 'b2',
    level: 'L1',
    title: 'جمل اسميّة',
    cover: 'https://picsum.photos/seed/b2/160/210',
    text: [
      'السماءُ صافيةٌ، والنسيمُ عليلٌ.',
      'المعرفةُ نورٌ، والقارئُ يجد المتعة في الكتب.'
    ],
    quiz: [
      {
        q: "كيف وصف الكاتب السماء؟",
        options: ["غائمة", "صافية", "ماطرة"],
        correct: 1
      },
      {
        q: "ماذا يجد القارئ في الكتب؟",
        options: ["الملل", "المتعة", "الحيرة"],
        correct: 1
      }
    ]
  },
  {
    id: 'b3',
    level: 'L2',
    title: 'قبل وساطير',
    cover: 'https://picsum.photos/seed/b3/160/210',
    text: [
      'اجتمع الأطفالُ حولَ الجدِّ ليستمعوا إلى الحكايات.',
      'من يستمعْ بتأنٍّ يفهمْ العبرةَ ويشاركْ رفاقَه.'
    ],
    quiz: [
      {
        q: "لماذا اجتمع الأطفال حول الجد؟",
        options: ["للعب", "ليستمعوا للحكايات", "للذهاب إلى المدرسة"],
        correct: 1
      }
    ]
  }
];

// ===== Utils =====
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));

// ✅ إصلاح مهم: قراءة آمنة من localStorage حتى لو كانت البيانات تالفة
const readJSON = (k, def) => {
  try {
    const raw = localStorage.getItem(k);
    if (!raw) return def;
    return JSON.parse(raw);
  } catch (e) {
    console.warn('readJSON error for', k, e);
    // إذا كانت القيمة تالفة نمسحها حتى لا تكرّر الخطأ
    localStorage.removeItem(k);
    return def;
  }
};

const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = (p = 'U') => p + Math.random().toString(36).slice(2, 8);


// ============================================
// 🤖 Noor Auto-Activate on Paragraph Click
// ============================================
function enableNoorOnParagraphs() {
  const story = document.getElementById("storyContent");
  if (!story) return;

  story.querySelectorAll("p").forEach(p => {
    p.onclick = () => {
      // إزالة التحديد السابق
      story.querySelectorAll("p").forEach(x =>
        x.classList.remove("para-selected")
      );

      // تمييز الفقرة
      p.classList.add("para-selected");

      const text = p.textContent.trim();

      // تمرير النص إلى نور
      const aiInput = document.getElementById("noorAiInput");
      if (aiInput) aiInput.value = text;

      // إظهار نور
      const noorBox = document.querySelector(".noor-ai-box");
      if (noorBox) {
        noorBox.classList.remove("hidden");
        noorBox.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      console.log("🤖 Noor activated:", text);
    };
  });
}

// ============================================
// 🤖 Noor AI – Logic (SAFE & SIMPLE)
// ============================================
(function initNoorAI(){
  const askBtn = document.getElementById("askNoorAI");
  if (!askBtn) return;

  askBtn.onclick = () => {
    const input = document.getElementById("noorAiInput");
    const answerBox = document.getElementById("noorAiAnswer");

    if (!input || !answerBox) return;

    const text = input.value.trim();
    if (!text) {
      answerBox.textContent = "📘 اختر فقرة أولًا من القصة.";
      answerBox.classList.remove("hidden");
      return;
    }

    // 🧠 رد ذكي مبدئي (تعليمي)
    answerBox.innerHTML = `
      <div style="line-height:1.7">
        <b>✦ شرح الفقرة:</b><br>
        هذه الفقرة تتحدث عن:
        <span style="color:#2563eb">
          ${text.slice(0, 40)}...
        </span><br><br>
        <b>✦ فكرة رئيسية:</b><br>
        الصداقة والتعاون من القيم المهمة في الحياة.
      </div>
    `;

    answerBox.classList.remove("hidden");
  };
})();


// ============================================
// 🤖 Noor AI Modes (Explain / Simple / Meaning)
// ============================================
document.querySelectorAll("[data-ai]").forEach(btn => {
  btn.onclick = () => {
    const mode = btn.dataset.ai;
    const input = document.getElementById("noorAiInput");
    const answer = document.getElementById("noorAiAnswer");

    if (!input || !answer) return;

    const text = input.value.trim();
    if (!text) {
      answer.textContent = "📘 اختر كلمة أو فقرة أولًا.";
      answer.classList.remove("hidden");
      return;
    }

    let response = "";

    if (mode === "meaning") {
      response = `🔎 معنى الكلمة:\n\n"${text}" كلمة تدل على معنى مرتبط بالسياق في القصة.`;
    }

    if (mode === "simple") {
      response = `🧒 ببساطة:\n\n${text} تعني شيئًا سهل الفهم ومناسب للأطفال.`;
    }

    if (mode === "explain") {
      response = `📖 شرح:\n\nهذه العبارة توضح فكرة مهمة في القصة وتساعدنا على الفهم.`;
    }

    answer.textContent = response;
    answer.classList.remove("hidden");
  };
});



// ============================================
// ☁️ تحميل إحصائيات الطالب من Firestore
// ============================================
async function loadStudentStatsFromFirestore() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== "student" || !window.db) return {
    reads: 0, minutes: 0, books: {}, lastBook: "—", activities: 0
  };

  try {
    const ref = doc(window.db, "readingStats", current.email);
    const snap = await getDoc(ref);

    const stats = snap.exists()
      ? snap.data()
      : { reads: 0, minutes: 0, books: {}, lastBook: "—", activities: 0 };

    // تحديث الواجهة من السحابة
    updateRailFromCloud(stats);
    updateKidsHomeProgressFromCloud(stats);
    updateReportsFromCloud(stats);
    renderStaticNoorBadgesFromCloud?.(stats); // إن كانت عندك

    return stats;

  } catch (e) {
    console.error("⚠ فشل تحميل إحصائيات الطالب:", e);
    return { reads: 0, minutes: 0, books: {}, lastBook: "—", activities: 0 };
  }
}



// ============================================
// 📌 Daily Status (Firestore Only)
// ============================================

// 1️⃣ عدد القراءات اليوم (من cache المحمّل من Firestore)
function getTodayReadsFromFirestore() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return 0;

  const stats = readJSON(LS.STATS(current.id), null);
  if (!stats) return 0;

  return stats.reads || 0;
}


// 2️⃣ عدد الواجبات المطلوبة
async function getPendingAssignmentsFromFirestore() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || !current.classId || !window.db) return 0;

  const snap = await getDocs(
    collection(window.db, "classes", current.classId, "assignments")
  );

  let count = 0;

  snap.forEach(d => {
    const a = d.data();
    const ps = a.perStudent?.[current.email];
    if (ps && ps.status === "required") count++;
  });

  return count;
}


async function updateDailyStatusFromFirestore() {
  const elReads = document.getElementById("todayReads");
  const elAssign = document.getElementById("todayAssignments");
  const elChallenge = document.getElementById("todayChallenge");

  if (!elReads || !elAssign || !elChallenge) return;

  elReads.textContent = "…";
  elAssign.textContent = "…";
  elChallenge.textContent = "جاري التحقق";

  try {
    const reads = await getTodayReadsFromFirestore();
    const assigns = await getPendingAssignmentsFromFirestore();

    elReads.textContent = reads;
    elAssign.textContent = assigns;

    const challengeDone = reads > 0;
    elChallenge.textContent = challengeDone ? "مكتمل 🎉" : "غير مكتمل";
    elChallenge.style.color = challengeDone
      ? "var(--ok)"
      : "var(--warn)";

  } catch (e) {
    console.error("❌ Daily Status Error:", e);
    elChallenge.textContent = "—";
  }
}



// ============================================
// 🎯 Daily Challenge Logic
// ============================================

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadDailyChallenge() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== "student") return;

  const today = getTodayKey();
  const ch = readJSON(LS_CHALLENGE(current.id), { date: today, done: false });

  if (ch.date !== today) {
    ch.date = today;
    ch.done = false;
    writeJSON(LS_CHALLENGE(current.id), ch);
  }

  updateChallengeUI(ch.done);
}

function completeDailyChallenge() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  writeJSON(LS_CHALLENGE(current.id), {
    date: getTodayKey(),
    done: true
  });

  updateChallengeUI(true);
  toast("🎉 أنجزت تحدي اليوم");
}

function updateChallengeUI(done) {
  const el = document.getElementById("challengeStatus");
  if (!el) return;

  el.textContent = done ? "منجز ✅" : "غير منجز";
  el.className = "badge " + (done ? "ok" : "sky");
}


// ============================================
// 🏆 Achievements Logic
// ============================================

function updateAchievements(stats) {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  const key = LS_ACHIEVEMENTS(current.id);
  const saved = readJSON(key, {});
  let changed = false;

  ACHIEVEMENTS.forEach(a => {
    if (!saved[a.id] && a.condition(stats)) {
      saved[a.id] = true;
      toast(`🏆 إنجاز جديد: ${a.title}`);
      changed = true;
    }
  });

  if (changed) {
    writeJSON(key, saved);
    renderAchievements();
  }
}

function renderAchievements() {
  const grid = document.getElementById("achievementsGrid");
  if (!grid) return;

  const current = readJSON(LS.CURRENT, null);
  const saved = readJSON(LS_ACHIEVEMENTS(current.id), {});
  grid.innerHTML = "";

  ACHIEVEMENTS.forEach(a => {
    const unlocked = saved[a.id];
    const card = document.createElement("div");
    card.className = `card achievement ${unlocked ? "unlocked" : "locked"}`;
    card.innerHTML = `
      <div class="icon">${a.icon}</div>
      <h4>${a.title}</h4>
      <p>${unlocked ? "تم الإنجاز 🎉" : "لم يفتح بعد"}</p>
    `;
    grid.appendChild(card);
  });
}




// ===== Avatar (موحّد) =====
function setUnifiedAvatar(role){
  const avatar = document.getElementById("userAvatar");
  if (!avatar) return;

  avatar.onerror = () => {
    avatar.src = "./img/avatar-student-omani.png";
  };

  avatar.src = role === "teacher"
    ? "./img/avatar-teacher-omani.png"
    : "./img/avatar-student-omani.png";
}


// ============================================
// 🎯 Placement Test (مرة واحدة فقط)
// ============================================

// أسئلة بسيطة مناسبة للصف 3–4
const PLACEMENT_QUESTIONS = [
  {
    q: "اختر الجملة الصحيحة:",
    options: ["ذهبَ الولدُ المدرسة", "ذهبَ الولدُ إلى المدرسة"],
    correct: 1
  },
  {
    q: "ما جمع كلمة (كتاب)؟",
    options: ["كتابون", "كتب", "كتابين"],
    correct: 1
  },
  {
    q: "أي كلمة اسم؟",
    options: ["يكتب", "المدرسة", "يلعب"],
    correct: 1
  }
];

function calculatePlacementLevel(score) {
  if (score <= 1) return "L1";
  if (score === 2) return "L2";
  return "L3";
}

// عرض نافذة الاختبار
function openPlacementModal(classId, studentEmail) {
  const modal = document.createElement("div");
  modal.className = "modal";

  modal.innerHTML = `
    <div class="modal-card" style="max-width:520px">
      <h3>🎯 اختبار تحديد المستوى</h3>
      <p style="font-size:.9rem;color:#555">
        أجب عن الأسئلة التالية لتحديد مستواك المناسب.
      </p>

      <div id="placementQs"></div>

      <button id="submitPlacement" class="btn primary full">
        إنهاء الاختبار
      </button>
    </div>
  `;
  document.body.appendChild(modal);

  const box = modal.querySelector("#placementQs");

  PLACEMENT_QUESTIONS.forEach((q, i) => {
    const div = document.createElement("div");
    div.className = "quiz-block";
    div.innerHTML = `
      <p><b>${i + 1}. ${q.q}</b></p>
      ${q.options.map((op, idx) => `
        <label style="display:block;margin:.2rem 0">
          <input type="radio" name="pq${i}" value="${idx}">
          ${op}
        </label>
      `).join("")}
    `;
    box.appendChild(div);
  });

  modal.querySelector("#submitPlacement").onclick = async () => {
    let score = 0;
    PLACEMENT_QUESTIONS.forEach((q, i) => {
      const sel = modal.querySelector(`input[name="pq${i}"]:checked`);
      if (sel && Number(sel.value) === q.correct) score++;
    });

    const level = calculatePlacementLevel(score);

    // حفظ المستوى مرة واحدة فقط
    await setDoc(
      doc(window.db, "classes", classId, "profiles", studentEmail),
      {
        level,
        xp: 0,
        placementDone: true,
        createdAt: Date.now()
      },
      { merge: true }
    );

// ✅ حفظ المستوى داخل الجلسة الحالية
const cur = readJSON(LS.CURRENT, null);
if (cur) {
  cur.level = level;
  writeJSON(LS.CURRENT, cur);
}

    toast(`🎉 تم تحديد مستواك: ${LEVELS.find(l => l.id === level)?.name}`);
    modal.remove();

    // تحديث الواجهة فورًا
    renderLevels();
renderBooks(level);
showOnly("#tab-library"); // اختياري: ينقله للمكتبة فورًا
  };
}




// ============================================
// 🔔 إنشاء إشعار
// ============================================
async function createNotification({
  studentId,
  title,
  message,
  icon = "🔔",
  type = "",
  refId = ""
}) {
  if (!window.db || !studentId) return;

  try {
    await setDoc(
      doc(collection(window.db, "notifications")),
      {
        studentId,
        title,
        message,
        icon,
        type,
        refId,
        isRead: false,
        createdAt: Date.now()
      }
    );
  } catch (e) {
    console.error("⚠ فشل إنشاء الإشعار:", e);
  }
}


// ============================================
// 🔔 Toast احترافي (بديل alert)
// ============================================
function toast(msg, timeout = 2500) {
  let t = document.getElementById("appToast");
  if (!t) {
    t = document.createElement("div");
    t.id = "appToast";
    t.style.cssText = `
      position:fixed;
      bottom:16px;
      left:50%;
      transform:translateX(-50%);
      background:#111827;
      color:#fff;
      padding:10px 16px;
      border-radius:14px;
      box-shadow:0 10px 30px rgba(0,0,0,.3);
      font-size:.9rem;
      z-index:9999;
      opacity:0;
      transition:.3s ease;
    `;
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = "1";
  setTimeout(() => t.style.opacity = "0", timeout);
}

// ------------------------------------------------------
// Firestore Helpers (كتب + واجبات + طلاب)
// ------------------------------------------------------

// 📌 تحميل الطلاب من Firestore للصف الخاص بالمعلم
export async function getTeacherStudents(classId) {
  const students = [];
  const stuSnap = await getDocs(collection(window.db, "classes", classId, "students"));

  stuSnap.forEach(docSnap => {
    const d = docSnap.data();
    students.push({
      id: d.email,
      name: d.name || d.email,
      email: d.email,
      className: d.className || ''
    });
  });

  return students;
}

// ============================================
// ☁️ إحصاءات لوحة المعلم (من Firestore فقط)
// ============================================
// ☁️ إحصاءات لوحة المعلم (Firestore فقط)
async function loadTeacherStatsFromFirestore() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== "teacher" || !current.classId || !window.db) {
    console.warn("⚠️ Teacher stats: missing context");
    return null;
  }

  const classId = current.classId;

  // 1️⃣ عدد الطلاب
  const studentsSnap = await getDocs(
    collection(window.db, "classes", classId, "students")
  );
  const studentsCount = studentsSnap.size;

  // 2️⃣ عدد الواجبات
  const assignmentsSnap = await getDocs(
    collection(window.db, "classes", classId, "assignments")
  );
  const assignmentsCount = assignmentsSnap.size;

  // 3️⃣ حساب الإنجاز والمتوسط
  let done = 0;
  let totalProgress = 0;
  let count = 0;

  assignmentsSnap.forEach(docSnap => {
    const a = docSnap.data();
    const perStudent = a.perStudent || {};

Object.values(perStudent).forEach(ps => {
  if (ps.status === "submitted" || ps.progress === 100) {
    done++;
  }

  if (typeof ps.progress === "number") {
    totalProgress += ps.progress;
    count++;
  }
});

  });

  const avg = count ? Math.round(totalProgress / count) : 0;

  console.log("📊 Teacher Stats", {
    students: studentsCount,
    assignments: assignmentsCount,
    done,
    avg
  });

  return {
    students: studentsCount,
    assignments: assignmentsCount,
    done,
    avg
  };
}

// 🔓 إتاحة الدالة للـ Console (Debug only)
window.loadTeacherStatsFromFirestore = loadTeacherStatsFromFirestore;

// 🔹 مزامنة القصص (محلي ↔ سحابة)
export async function syncBooks(classId) {
  if (!classId) {
    console.error("❌ syncBooks: classId مفقود — تم إيقاف المزامنة.");
    return;
  }

  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  if (!window.db) {
    console.error("❌ syncBooks: window.db غير مهيأ.");
    return;
  }

  let snap;
  try {
    snap = await getDocs(
      collection(window.db, "classes", classId, "books")
    );
  } catch (err) {
    console.error("🔥 خطأ أثناء جلب القصص:", err);
    return;
  }

  const cloudBooks = [];
  snap.forEach(d => cloudBooks.push(d.data()));

  // الطالب: تحميل فقط
  if (current.role === "student") {
    BOOKS.length = 0;
    cloudBooks.forEach(b => BOOKS.push(b));
    console.log("📥 الطالب حمّل القصص:", BOOKS.length);
    return;
  }

  // المعلم: مزامنة (إن احتجت لها)
  cloudBooks.forEach(b => {
    if (!BOOKS.some(x => x.id === b.id)) {
      BOOKS.push(b);
    }
  });

  for (const b of BOOKS) {
    const exists = cloudBooks.some(x => x.id === b.id);
    if (!exists) {
      await setDoc(doc(window.db, "classes", classId, "books", b.id), b);
      console.log("⬆️ رفع قصة جديدة:", b.title);
    }
  }

  console.log("🔄 تمت المزامنة بنجاح");
}

// ☁️ مزامنة مستوى الطالب فورًا
async function syncStudentLevelToFirestore(level) {
  const current = readJSON(LS.CURRENT, null);
  if (!window.db || !current?.classId || !current?.email) return;

  try {
    const ref = doc(
      window.db,
      "classes",
      current.classId,
      "profiles",
      current.email
    );
    await setDoc(ref, { level, updatedAt: Date.now() }, { merge: true });
  } catch (e) {
    console.error("❌ فشل مزامنة المستوى:", e);
  }
}


// ☁️ تحديث مستوى الطالب (سحابي + جلسة)
async function updateStudentLevel(nextLevel) {
  const current = readJSON(LS.CURRENT, null);
  if (!current || !window.db) return;

  await setDoc(
    doc(window.db, "classes", current.classId, "profiles", current.email),
    { level: nextLevel, updatedAt: Date.now() },
    { merge: true }
  );

  // تحديث الجلسة فقط (ليس اعتمادًا دائمًا)
  current.level = nextLevel;
  writeJSON(LS.CURRENT, current);
}


// 🔹 حفظ حل الطالب في Firestore (answers + perStudent في assignment)
async function saveAssignmentAnswerToFirestore(classId, assignId, studentId, answerData) {
  if (!window.db) return;
try {
  const ansRef = doc(
    window.db,
    "classes", classId,
    "assignments", assignId,
    "answers", studentId
  );

  await setDoc(ansRef, answerData, { merge: true });

  // تحديث الحقل في وثيقة الواجب نفسها (perStudent)
  const assignRef = doc(window.db, "classes", classId, "assignments", assignId);
  const snap = await getDoc(assignRef);

  if (!snap.exists()) {
    console.error("❌ الواجب غير موجود!");
    return;
  }

  const data = snap.data();
  data.perStudent = data.perStudent || {};
  data.perStudent[studentId] = {
    ...(data.perStudent[studentId] || {}),
    ...answerData
  };

  await setDoc(assignRef, data, { merge: true });

  console.log("✔ تم حفظ إجابة الطالب في Firestore");

  } catch (e) {
    console.error("❌ خطأ في حفظ الواجب في Firestore:", e);
    toast("⚠ خطأ في حفظ الإجابة");
  }
}

// 🔹 تحميل القصص من Firestore
async function loadBooksFromFirestore(classId) {
  if (!window.db) {
    console.warn("⚠ لا يوجد window.db، سيتم استخدام القصص المحلية.");
    return BOOKS;
  }

  const snap = await getDocs(collection(window.db, "classes", classId, "books"));
  const arr = [];
  snap.forEach(d => arr.push(d.data()));

  if (arr.length === 0) {
    console.warn("⚠ لا توجد قصص في السحابة. سيتم استخدام القصص المحلية.");
    return BOOKS;
  }

  return arr;
}

// 🔹 استبدال محتوى BOOKS بقصص السحابة عند الحاجة
async function syncBooksWithFirestore(classId) {
  const books = await loadBooksFromFirestore(classId);
  if (books && books.length > 0) {
    BOOKS.length = 0;
    books.forEach(b => BOOKS.push(b));
  }
}

// 🔹 تحميل إجابات الطالب من Firestore ودمجها في الواجبات المحلية
export async function loadStudentAnswersFromFirestore(classId, studentId) {
  if (!window.db) return;

  const snap = await getDocs(
    collection(window.db, "classes", classId, "assignments")
  );

  const localAssignments = getAssignments();

  for (const docA of snap.docs) {
    const assignId = docA.id;

    const ansRef = doc(
      window.db,
      "classes", classId,
      "assignments", assignId,
      "answers", studentId
    );

    const ansSnap = await getDoc(ansRef);

    if (ansSnap.exists()) {
      const data = ansSnap.data();
      let idx = localAssignments.findIndex(x => x.id === assignId);
      if (idx !== -1) {
        localAssignments[idx].perStudent = localAssignments[idx].perStudent || {};
        localAssignments[idx].perStudent[studentId] = {
          ...localAssignments[idx].perStudent[studentId],
          ...data
        };
      }
    }
  }

  setAssignments(localAssignments);
}

// ===============================
//  🔥 مزامنة الواجبات من Firestore إلى الذاكرة المحلية
// ===============================
export async function syncAssignmentsFromFirestore(classId) {
  if (!window.db) return;

  const snap = await getDocs(
    collection(window.db, "classes", classId, "assignments")
  );

  const list = [];

  snap.forEach(docA => {
    const data = docA.data();
    list.push({
      id: docA.id,
      title: data.title || "",
      desc: data.desc || "",
      level: data.level || "",
      due: data.due || "",
      teacherId: data.teacherId || "",
      classId: classId,
      studentIds: data.studentIds || [],
      perStudent: data.perStudent || {}
    });
  });

  setAssignments(list);
  console.log("✔ تمت مزامنة الواجبات من Firestore");
}

// 🔹 إيجاد classId للطالب من Firestore (للاحتياط إذا لم يُحفظ في الجلسة)
async function findClassIdForStudent(studentEmail) {
  if (!window.db || !studentEmail) return null;

  try {
    const classesSnap = await getDocs(collection(window.db, "classes"));
    for (const c of classesSnap.docs) {
      const stuRef = doc(window.db, "classes", c.id, "students", studentEmail);
      const stuSnap = await getDoc(stuRef);
      if (stuSnap.exists()) {
        return c.id;
      }
    }
  } catch (e) {
    console.error("❌ خطأ في findClassIdForStudent:", e);
  }

  return null;
}

// 🔹 إيجاد classId للمعلم من Firestore
async function findClassIdForTeacher(teacherId) {
  if (!window.db || !teacherId) return null;

  const snap = await getDocs(collection(window.db, "classes"));

  for (const d of snap.docs) {
    const data = d.data();
    if (data.teacherId === teacherId) {
      return d.id;
    }
  }
  return null;
}


// ============================================
// 🧸 Kids Home – Progress
// ============================================

async function updateKidsHomeProgressFromCloud(stats) {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  writeJSON(LS.STATS(current.id), stats);
  updateKidsHomeProgress();
}

// ============================================
// 📊 Rail (Sidebar)
// ============================================

function updateRailFromCloud(stats) {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  writeJSON(LS.STATS(current.id), stats);
  updateRail();
}

// ============================================
// 📈 Reports
// ============================================

function updateReportsFromCloud(stats) {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  writeJSON(LS.STATS(current.id), stats);
  updateReports();
}

// ============================================
// 🏅 Noor Badges
// ============================================

function renderStaticNoorBadgesFromCloud(stats) {
  const el = document.getElementById("railBadges");
  if (!el) return;

  el.dataset.count = Math.floor((stats.reads || 0) / 5);
  renderStaticNoorBadges();
}


// ------------------------------------------------------
// التنقل والتبويبات + لوحة الجانب الأيمن
// ------------------------------------------------------

function showOnly(selector) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#readerView')?.classList.add('hidden');

  const el = document.querySelector(selector);
  if (el) el.classList.remove('hidden');

if (selector === '#tab-teacher') {
  onTeacherTabShown();
}


  $$('#navLinks .pill').forEach(p => {
    if (p.dataset.target === selector) p.classList.add('active');
    else p.classList.remove('active');
  });

   }


// ============================================
// 📊 عند فتح تبويب لوحة المعلم
// ============================================
function onTeacherTabShown() {
  renderTeacherDashboard();
}



function buildNav(role) {
  const nav = document.querySelector('#navLinks');
  if (!nav) return;
  nav.innerHTML = '';

  const items = role === 'teacher'
    ? [
        ['#tab-teacher', 'لوحة المعلم'],
        ['#tab-teacher-students', 'الطلاب'],
        ['#tab-teacher-assignments', 'الواجبات'],
        ['#tab-library', 'المكتبة'],
        ['#tab-reports', 'التقارير']
      ]
    : [
        ['#tab-home', 'الرئيسية'],
        ['#tab-levels', 'المستويات'],
        ['#tab-library', 'المكتبة'],
        ['#tab-assign', 'واجباتي'],
        ['#tab-reports', 'تقاريري']
      ];

  items.forEach(([target, label, i]) => {
    const b = document.createElement('button');
    b.className = 'pill' + (i === 0 ? ' active' : '');
    b.dataset.target = target;
    b.textContent = label;
    b.onclick = () => showOnly(target);
    nav.appendChild(b);
  });

  showOnly(items[0][0]);
}

function updateRail() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  // المعلم: نعرض أصفارًا (إحصاءات الطلاب في أماكن أخرى)
  if (current.role === 'teacher') {
    renderTeacherDashboard();

    $('#railBooks').textContent = 0;
    $('#railTime').textContent = '0 د';
    $('#railBadges').textContent = 0;
    const avgBox = $('#railAvg');
    if (avgBox) avgBox.textContent = '0 د';
    const lastBox = $('#railLastBook');
    if (lastBox) lastBox.textContent = '—';
    const actBox = $('#railActs');
    if (actBox) actBox.textContent = 0;
    return;
  }

  // الطالب (محليًا الآن، ويمكن لاحقًا نقلها إلى Firestore بالكامل)
  const key = LS.STATS(current.id);
  const s = readJSON(key, { reads: 0, minutes: 0, lastBook: '—', activities: 0 });

  $('#railBooks').textContent = s.reads;
  $('#railTime').textContent = s.minutes + ' د';
$('#railBadges').dataset.count = Math.floor(s.reads / 5);

  const avg = s.reads > 0 ? (s.minutes / s.reads).toFixed(1) : 0;
  const avgBox = $('#railAvg');
  if (avgBox) avgBox.textContent = avg + ' د';

  const lastBox = $('#railLastBook');
  if (lastBox) lastBox.textContent = s.lastBook;

  const actBox = $('#railActs');
  if (actBox) actBox.textContent = s.activities;
}

function renderStaticNoorBadges(){
  const el = document.getElementById("railBadges");
  if (!el) return;

  const count = parseInt(el.dataset.count || 0);
  el.innerHTML = '';

  let badge = null;

  if (count >= 3) {
    badge = {
      icon: "🥇",
      label: "إنجاز ذهبي"
    };
  } else if (count >= 2) {
    badge = {
      icon: "🥈",
      label: "إنجاز فضي"
    };
  } else if (count >= 1) {
    badge = {
      icon: "🥉",
      label: "بداية موفقة"
    };
  }

  if (!badge) return;

  el.innerHTML = `
    <div class="noor-badge" title="${badge.label}">
      <span style="font-size:34px">${badge.icon}</span>
    </div>
  `;

  // ✨ ومضة تشجيع (أول مرة فقط)
  if (badge.label === "بداية موفقة") {
    showStartToast();
  }
}


function showStartToast(){
  if (localStorage.getItem("startToastShown")) return;

  localStorage.setItem("startToastShown", "1");

  const toast = document.createElement("div");
  toast.id = "startToast";
  toast.className = "start-toast";
  toast.textContent = "🌟 بداية موفقة";

  const card = document.querySelector(".score-card");
  if (!card) return;

  card.appendChild(toast);

  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 500);
  }, 2200);
}

function showCongratsModal({ title, message, btnText = "متابعة", onOk }) {
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.innerHTML = `
    <div class="modal-card" style="max-width:520px;text-align:center">
      <div style="font-size:42px;margin-bottom:.3rem">🎉</div>
      <h3 style="margin:.2rem 0">${title}</h3>
      <p class="muted" style="line-height:1.7;margin:.6rem 0">${message}</p>
      <div style="display:flex;justify-content:center;gap:.5rem;margin-top:1rem">
        <button id="cmOk" class="btn primary">${btnText}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  modal.querySelector("#cmOk").onclick = () => {
    modal.remove();
    onOk?.();
  };
}



function addActivity() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;
  const key = LS.STATS(current.id);
  const s = readJSON(key, { reads: 0, minutes: 0, lastBook: '—', activities: 0 });
  s.activities += 1;
  writeJSON(key, s);
  updateRail();
}

// ------------------------------------------------------
// حساب متوسط إنجاز الفصل ومخطط الدائرة
// ------------------------------------------------------

// ------------------------------------------------------
// حساب متوسط إنجاز الفصل ومخطط الدائرة
// ------------------------------------------------------

// 🍩 رسم مخطط متوسط الإنجاز (دائري)
function renderAvgProgressChart(value) {
  const canvas = document.getElementById('chartAvgProgress');
  if (!canvas) return;

  // إزالة المخطط السابق إن وجد
  if (window.avgChart) {
    window.avgChart.destroy();
  }

  window.avgChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: ['المنجز', 'المتبقي'],
      datasets: [{
        data: [value, 100 - value],
        backgroundColor: [
          '#22c55e', // أخضر مشرق
          '#e5e7eb'  // رمادي هادئ
        ],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '72%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `${ctx.label}: ${ctx.raw}%`
          }
        }
      }
    }
  });
}





function getAssignments() { return readJSON(LS.ASSIGN, []); }
function setAssignments(x) { writeJSON(LS.ASSIGN, x); }
function getClasses() { return readJSON(LS.CLASSES, []); }
function setClasses(x) { writeJSON(LS.CLASSES, x); }
function getUsers() { return readJSON(LS.USERS, []); }
function setUsers(x) { writeJSON(LS.USERS, x); }

// =====================================================
// ❌ تم تعطيل حساب متوسط الإنجاز (محلي)
// =====================================================
// السبب:
// - يعتمد على LocalStorage (LS.STATS)
// - يعتمد على getTeacherClass المحلي
// - لوحة المعلم الآن تعتمد 100٪ على Firestore
// - سيُعاد بناؤه لاحقًا بنسخة Firestore صافية
// =====================================================

/*
function computeAverageProgress() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== 'teacher') return 0;

  const c = getTeacherClass(current.id);
  if (!c || !c.students || !c.students.length) return 0;

  let totalRead = 0;
  let totalQuiz = 0;
  let totalAssign = 0;
  let count = 0;

  c.students.forEach(sid => {
    const key = LS.STATS(sid);
    const stats = readJSON(key, { reads: 0, minutes: 0, lastBook: '—', activities: 0 });

    const readPercent = Math.min(100, Math.round((stats.reads / BOOKS.length) * 100));
    const quizPercent = Math.min(100, Math.round((stats.activities / BOOKS.length) * 100));

    let assignSum = 0, assignCount = 0;
    getAssignments().forEach(a => {
      const ps = a.perStudent?.[sid];
      if (ps && ps.progress != null) {
        assignSum += ps.progress;
        assignCount++;
      }
    });

    const assignPercent = assignCount ? Math.round(assignSum / assignCount) : 0;

    totalRead += readPercent;
    totalQuiz += quizPercent;
    totalAssign += assignPercent;
    count++;
  });

  if (count === 0) return 0;
  return Math.round((totalRead + totalQuiz + totalAssign) / (count * 3));
}
*/

// =====================================================
// ❌ تم تعطيل مخطط متوسط الإنجاز
// =====================================================
// يعتمد على computeAverageProgress (المعطّلة أعلاه)
// =====================================================

/*
let avgChart = null;

function renderAvgProgressChart() {
  const avg = computeAverageProgress();
  const ctx = document.getElementById('chartAvgProgress');
  if (!ctx) return;

  if (avgChart) avgChart.destroy();

  avgChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['الإنجاز', 'متبقّي'],
      datasets: [{
        data: [avg, 100 - avg],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      cutout: '60%',
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: c => `${c.label}: ${c.raw}%`
          }
        }
      }
    }
  });
}
*/
// ------------------------------------------------------
// Auth (تسجيل وإنشاء حساب + تسجيل خروج) — 
// ------------------------------------------------------

// ------------------------------------------------------
// ❌ تعطيل التسجيل المحلي (المعلم والطالب)
// ------------------------------------------------------
function registerUser(e) {
  e.preventDefault();

  toast("❌ تم تعطيل التسجيل المحلي. يرجى استخدام تسجيل الدخول عبر Google.");
  return;
}


// ------------------------------------------------------
// ❌ تعطيل تسجيل الدخول المحلي
// ------------------------------------------------------
function loginUser(e) {
  e.preventDefault();

  toast("❌ تم تعطيل تسجيل الدخول المحلي. استخدم تسجيل الدخول عبر Google.");
  return;
}


// ------------------------------------------------------
// ✅ تسجيل الدخول عبر Google (المسار الرسمي)
// ------------------------------------------------------
async function loginWithGoogle() {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const email = user.email;
    let role = "student";
    let classId = null;

    // ============================
    // 1️⃣ هل هو معلم؟
    // ============================
    const classesSnap = await getDocs(collection(window.db, "classes"));

    for (const c of classesSnap.docs) {
      const data = c.data();

      // شرط المعلم (بريد أو UID)
      if (
        data.teacherEmail === email ||
        data.teacherId === user.uid
      ) {
        role = "teacher";
        classId = c.id;
        break;
      }
    }

    // ============================
    // 2️⃣ إن لم يكن معلمًا → طالب
    // ============================
    if (role === "student") {
      for (const c of classesSnap.docs) {
        const stuRef = doc(
          window.db,
          "classes", c.id,
          "students", email
        );
        const stuSnap = await getDoc(stuRef);

        if (stuSnap.exists()) {
          classId = c.id;
          break;
        }
      }
    }

    if (!classId) {
      alert("⚠ هذا الحساب غير مرتبط بأي فصل");
      return;
    }

    // ============================
    // 3️⃣ حفظ الجلسة
    // ============================
    writeJSON(LS.CURRENT, {
      id: role === "teacher" ? user.uid : email,
      name: user.displayName || "مستخدم",
      email,
      role,
      classId
    });

    toast("✔ تم تسجيل الدخول بنجاح");
    startApp();

  } catch (e) {
    console.error("Google Login Error:", e);
    toast("⚠ فشل تسجيل الدخول عبر Google");
  }
}





function logoutUser() {
  localStorage.removeItem(LS.CURRENT);
  $('#authView').classList.remove('hidden');
  $('#appShell').classList.add('hidden');
  $('#readerView').classList.add('hidden');

  $('#loginMsg').textContent = '';
  $('#regMsg').textContent = '';
  $('#loginForm').reset();
  $('#regForm').reset();
  $('#navLinks').innerHTML = '';

   // ⭐⭐ رجوع لوضع الدخول
  document.body.classList.add('is-auth');
}

function confirmLogout() {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:400px;text-align:center">
      <h3>🚪 هل تريد تسجيل الخروج؟</h3>
      <p style="margin:10px 0;color:#555">يمكنك العودة لاحقًا بتسجيل الدخول من جديد.</p>
      <div style="display:flex;justify-content:center;gap:.5rem;margin-top:1rem">
        <button id="confirmLogoutBtn" class="btn danger small">نعم، أريد الخروج</button>
        <button id="cancelLogoutBtn" class="btn ghost small">إلغاء</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  document.getElementById('cancelLogoutBtn').onclick = () => modal.remove();
  document.getElementById('confirmLogoutBtn').onclick = () => {
    modal.remove();
    logoutUser();
  };
}

// ------------------------------------------------------
// Student: المستويات + المكتبة + الواجبات
// ------------------------------------------------------

function renderLevels() {
  const w = $('#levelsGrid'); if (!w) return;
  w.innerHTML = '';
  LEVELS.forEach(L => {
    const d = document.createElement('div');
    d.className = 'level-card';
    d.innerHTML = `<h3>${L.name}</h3><div class="badge warn">+ قصص</div>`;
    d.onclick = () => {
      $('#searchBooks').value = '';
      renderBooks(L.id);
      showOnly('#tab-library');
    };
    w.appendChild(d);
  });
}

async function renderBooks(level = 'ALL') {
  const g = $('#booksGrid');
  if (!g) return;

  g.innerHTML = '<div style="padding:10px">⏳ جاري تحميل القصص...</div>';

  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  const classId = current.classId || null;
  if (!classId) {
    g.innerHTML = "<p>🚫 لا يوجد فصل مرتبط بك</p>";
    return;
  }

  const books = await loadBooksFromFirestore(classId);
  const q = $('#searchBooks')?.value.trim() || '';

  const filtered = books.filter(b =>
    (level === 'ALL' || b.level === level) &&
    (!q || b.title.includes(q))
  );

  g.innerHTML = '';

  if (!filtered.length) {
    g.innerHTML = "<p>لا توجد قصص مطابقة.</p>";
    return;
  }

  filtered.forEach(b => {
    const c = document.createElement('div');
    c.className = 'book-card';

    // 1️⃣ محتوى البطاقة
    c.innerHTML = `
      <img src="${b.cover}" style="width:100%;border-radius:12px;margin-bottom:.5rem">
      <h4>${b.title}</h4>
      <div class="badge ok">مستوى ${b.level}</div>

      ${
        current.role === "teacher"
          ? `
          <div class="book-actions">
            <button class="btn mini ghost" data-edit>✏️ تعديل</button>
            <button class="btn mini danger" data-del>🗑 حذف</button>
          </div>
          `
          : ""
      }
    `;

    // 2️⃣ فتح القصة (الطالب والمعلم)
    c.onclick = () => window.openReader(b);

    // 3️⃣ ✏️ تعديل القصة (للمعلم فقط)
    c.querySelector('[data-edit]')?.addEventListener('click', (e) => {
      e.stopPropagation(); // 🔒 مهم
      openEditBookModal(b);
    });

    // 4️⃣ 🗑 حذف القصة (للمعلم فقط)
    c.querySelector('[data-del]')?.addEventListener('click', async (e) => {
      e.stopPropagation(); // 🔒 مهم

      if (!confirm(`هل تريد حذف القصة: ${b.title}؟`)) return;

      try {
        await deleteDoc(
          doc(window.db, "classes", current.classId, "books", b.id)
        );

        toast("🗑 تم حذف القصة بنجاح");
        renderBooks(level);

      } catch (err) {
        console.error(err);
        toast("⚠ فشل حذف القصة");
      }
    });

    // 5️⃣ إضافة البطاقة
    g.appendChild(c);
  });
}



function getStudentAssignments(uid) {
  return getAssignments().filter(a => a.studentIds.includes(uid));
}

function renderStudentAssignments(filter = 'required') {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  const host = $('#assignList');
  if (!host) return;
  host.innerHTML = '';

  const arr = getStudentAssignments(current.id);

  let list = arr.map(a => {
    const ps = a.perStudent?.[current.id] || { status: 'required', progress: 0, notes: '-', answer: '', file: '' };

    let statusLabel, statusClass, filterTag;

    if (ps.status === 'done') {
      statusLabel = 'تم الحل ✅';
      statusClass = 'ok';
      filterTag = 'done';
    } else if (ps.status === 'overdue') {
      statusLabel = 'متأخر ⏰';
      statusClass = 'err';
      filterTag = 'overdue';
    } else if (ps.status === 'submitted') {
      statusLabel = 'الإجابة قيد المراجعة ⏳';
      statusClass = 'warn';
      filterTag = 'required';
    } else {
      statusLabel = 'مطلوب 📘';
      statusClass = 'warn';
      filterTag = 'required';
    }

    return {
      ...a,
      ps,
      statusLabel,
      statusClass,
      progress: ps.progress || 0,
      filter: filterTag,
      answer: ps.answer || '',
      file: ps.file || '',
      notes: ps.notes || ''
    };
  }).filter(x => x.filter === filter);

  if (!list.length) {
    host.innerHTML = `<div class="assign-card">لا توجد واجبات في هذه الفئة.</div>`;
    return;
  }

  list.forEach(a => {
    const el = document.createElement('div');
    el.className = 'assign-card';

    let buttons = '';
    if (a.ps.status === 'done') {
      buttons = `<button class="btn small primary" data-view="${a.id}">عرض الحل ✅</button>`;
    } else if (a.ps.status === 'submitted') {
      buttons = `<div class="badge warn">📌 الإجابة قيد المراجعة</div>`;
    } else {
      buttons = `
        <button class="btn small" data-open="${a.id}">فتح</button>
        <button class="btn ghost small" data-submit="${a.id}">إرسال الحل</button>
      `;
    }

el.innerHTML = `
  <h4>${a.title}</h4>

  <!-- 🏷️ المستوى + التاريخ -->
  <div class="meta">
    <span class="badge sky">
      ${LEVELS.find(l => l.id === a.level)?.name || '—'}
    </span>
    <span class="badge ghost">
      📅 ${a.due || 'بدون تاريخ'}
    </span>
  </div>

  <!-- 📝 الوصف -->
  <p class="muted" style="margin:.4rem 0">
    ${a.desc || ''}
  </p>

  <!-- ✅ حالة الواجب -->
  <div style="margin:.3rem 0">
    <span class="status ${
      a.ps.status === 'done'
        ? 'done'
        : a.ps.status === 'submitted'
        ? 'review'
        : 'required'
    }">
      ${
        a.ps.status === 'done'
          ? 'منجز ✅'
          : a.ps.status === 'submitted'
          ? 'قيد المراجعة ⏳'
          : 'مطلوب 📘'
      }
    </span>
  </div>

  <!-- 📊 شريط التقدم -->
  <div class="progress" aria-label="progress">
    <i style="width:${a.progress || 0}%"></i>
  </div>

  <!-- 🔘 الأزرار -->
  <div class="row" style="margin-top:.7rem;display:flex;gap:.4rem;flex-wrap:wrap">
    ${buttons}
  </div>
`;


    // فتح القصة حسب مستوى الواجب
    el.querySelector('[data-open]')?.addEventListener('click', () => {
      const levelId = a.level.startsWith('L') ? a.level : LEVELS.find(l => a.level.includes(l.name))?.id || 'L1';
      const book = BOOKS.find(b => b.level === levelId);
      if (book) openReader(book);
      else toast('🚫 لا توجد قصة متاحة لهذا المستوى حالياً');
    });

    // نافذة إرسال الحل
    el.querySelector('[data-submit]')?.addEventListener('click', () => {
      if (a.ps.status === 'submitted' || a.ps.status === 'done') {
        toast('📌 لا يمكنك تعديل الإجابة بعد إرسالها.');
        return;
      }

      const modal = document.createElement('div');
      modal.className = 'modal';
     modal.innerHTML = `
  <div class="modal-card">
    <button class="modal-close" id="closeAns">✖</button>
    <h3 id="taskTitle"></h3>

    ${
      a.notes && a.notes.trim() !== ''
        ? `
        <div class="teacher-note">
          <strong>📝 ملحوظات المعلم:</strong>
          <p>${a.notes}</p>
        </div>
        `
        : ''
    }

    <div class="form-row">
      <label>إجابتك</label>
      <textarea id="ansText" rows="4"
        style="width:100%;border:1px solid #ddd;border-radius:8px;padding:.6rem;">
        ${a.answer || ''}
      </textarea>
    </div>

    <div class="form-row">
      <label>أرفق ملفًا (اختياري)</label>
      <input type="file" id="ansFile" />
    </div>

    <button id="sendAnsBtn" class="btn primary small full">إرسال الحل</button>
  </div>
`;

      document.body.appendChild(modal);

      document.getElementById("taskTitle").textContent = "إرسال حل الواجب: " + a.title;

      $('#closeAns').onclick = () => modal.remove();

      $('#sendAnsBtn').onclick = async () => {
        const ok = confirm('هل أنت متأكد من إرسال الحل؟ لن تتمكن من تعديله حتى يراجعه المعلم.');
        if (!ok) return;

        const text = $('#ansText').value.trim();
        const fileInput = $('#ansFile');
        const file = fileInput.files[0]?.name || '';

        const all = getAssignments();
        const idx = all.findIndex(x => x.id === a.id);

        if (idx > -1) {
          all[idx].perStudent = all[idx].perStudent || {};
          all[idx].perStudent[current.id] = {
            ...a.ps,
            answer: text,
            file,
            status: 'submitted',
            progress: 50
          };

          setAssignments(all);

          await saveAssignmentAnswerToFirestore(a.classId, a.id, current.email, {
            answer: text,
            file: file,
            status: "submitted",
            progress: 50
          });

          modal.remove();
          toast('✅ تم إرسال الحل، والإجابة الآن قيد المراجعة');
          renderStudentAssignments(filter);
          renderTeacherView();
        }
      };
    });

    // نافذة عرض الحل
    el.querySelector('[data-view]')?.addEventListener('click', () => {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = `
        <div class="modal-card" style="max-width:600px">
          <button class="modal-close" id="closeView">✖</button>
          <h3>عرض الحل والملاحظات</h3>
          <p><b>عنوان الواجب:</b> ${a.title}</p>
          <p><b>إجابتك:</b></p>
          <div style="background:#f8fafc;padding:.7rem;border-radius:10px">
            ${a.answer || '— لا توجد إجابة نصية —'}
          </div>
          ${a.file ? `<p><b>الملف المرفق:</b> ${a.file}</p>` : ''}
          ${a.correctAnswer ? `
            <p><b>الإجابة الصحيحة:</b></p>
            <div style="background:#eef8ee;padding:.7rem;border-radius:10px">${a.correctAnswer}</div>` : ''}
          ${a.notes && a.notes !== '-' ? `
            <p><b>ملاحظة المعلم:</b></p>
            <div style="background:#fff7e6;padding:.7rem;border-radius:10px">${a.notes}</div>` : ''}
          <div style="text-align:center;margin-top:1rem">
            <button class="btn primary" id="closeViewBtn">إغلاق</button>
          </div>
        </div>`;
      document.body.appendChild(modal);
      $('#closeView').onclick = () => modal.remove();
      $('#closeViewBtn').onclick = () => modal.remove();
    });

    host.appendChild(el);
  });
}

// ------------------------------------------------------
// Teacher: إدارة الطلاب والواجبات
// ------------------------------------------------------

// ✅ تعديل مهم: نربط الفصل دائمًا بـ classId القادم من Google/Firestore
function getTeacherClass(teacherId) {
  const current = readJSON(LS.CURRENT, null);
  const classes = getClasses();
  let c = null;

  if (current && current.classId) {
    // نبحث في المحلي عن هذا الـ id، وإن لم يوجد ننشئه بنفس id
    c = classes.find(x => x.id === current.classId);
    if (!c) {
      c = { id: current.classId, teacherId, name: 'فصلي', students: [] };
      classes.push(c);
      setClasses(classes);
    }
  } else {
    c = classes.find(x => x.teacherId === teacherId);
    if (!c) {
      c = { id: uid('C'), teacherId, name: 'فصلي', students: [] };
      classes.push(c);
      setClasses(classes);
    }
  }
  return c;
}

// ✅ إعادة كتابة إدارة الطلاب لتعمل بالكامل من Firestore
async function renderTeacherStudents() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== 'teacher') return;

  const rows = $('#studentsRows');
  if (!rows) return;

  rows.innerHTML = '⏳ جاري تحميل الطلاب...';

let classId = current.classId;

// 🔥 في حال لم يكن classId محفوظًا بعد
if (!classId && window.db) {
  try {
    const classesSnap = await getDocs(collection(window.db, "classes"));

    classesSnap.forEach(docSnap => {
      const data = docSnap.data();

      // نربط الصف بالمعلم (UID أو البريد)
      if (
        data.teacherId === current.id ||
        data.teacherEmail === current.email
      ) {
        classId = docSnap.id;
      }
    });

    // حفظه في الجلسة حتى لا نبحث مرة أخرى
    if (classId) {
      writeJSON(LS.CURRENT, { ...current, classId });
      current.classId = classId;
    }

  } catch (e) {
    console.error("❌ فشل جلب classId للمعلم:", e);
  }
}


  if (!classId) {
    rows.innerHTML = `
      <div class="row">
        <div>لا يوجد صف مرتبط بهذا المعلم.</div>
        <div>—</div>
        <div>—</div>
        <div>—</div>
      </div>
    `;
    return;
  }

  if (!window.db) {
    rows.innerHTML = `<div class="row"><div>⚠ لا يوجد اتصال بقاعدة البيانات.</div></div>`;
    return;
  }

  try {
    const stuSnap = await getDocs(collection(window.db, "classes", classId, "students"));
    rows.innerHTML = '';

    if (stuSnap.empty) {
      rows.innerHTML = `
        <div class="row">
          <div>لا يوجد طلاب بعد.</div>
          <div>—</div>
          <div>—</div>
          <div>—</div>
        </div>
      `;
      return;
    }

    stuSnap.forEach(d => {
      const st = d.data();
      const r = document.createElement('div');
      r.className = 'row';

      const name = st.name || st.email;
      const email = st.email;
      const className = st.className || '—';

      r.innerHTML = `
        <div>${name}</div>
        <div>${email}</div>
<div>
  <span class="class-badge">${className || '—'}</span>
</div>
        <div class="actions">
          <button class="btn mini" data-edit="${email}">تعديل</button>
          <button class="btn mini ghost" data-del="${email}">حذف</button>
        </div>
      `;

      // 🗑 حذف الطالب من Firestore
      r.querySelector('[data-del]').onclick = async () => {
        if (!confirm(`هل تريد حذف الطالب ${name}؟`)) return;
        try {
          await deleteDoc(doc(window.db, "classes", classId, "students", email));
          toast('❌ تم حذف الطالب بنجاح');
          renderTeacherStudents();

        } catch (e) {
          console.error(e);
          toast('⚠ حدث خطأ أثناء الحذف');
        }
      };

      // ✏️ تعديل بيانات الطالب (الاسم والصف فقط، البريد ثابت)
      r.querySelector('[data-edit]').onclick = () => {
        const modal = document.createElement('div');
        modal.className = 'modal';

        modal.innerHTML = `
          <div class="modal-card" style="max-width:500px">
            <button class="modal-close" id="closeEdit">✖</button>
            <h3>تعديل بيانات الطالب</h3>

            <div class="form-row">
              <label>الاسم الكامل</label>
              <input type="text" id="editName" value="${name}">
            </div>

            <div class="form-row">
              <label>البريد الإلكتروني (لا يمكن تعديله)</label>
              <input type="email" id="editEmail" value="${email}" disabled>
            </div>

            <div class="form-row">
              <label>الصف</label>
              <input type="text" id="editClass" value="${className === '—' ? '' : className}" placeholder="مثلاً: الصف السادس">
            </div>

            <button class="btn primary full" id="saveEdit">حفظ التعديلات ✅</button>
          </div>
        `;

        document.body.appendChild(modal);

        $('#closeEdit').onclick = () => modal.remove();

        $('#saveEdit').onclick = async () => {
          const newName = $('#editName').value.trim();
          const newClass = $('#editClass').value.trim();

          if (!newName) {
            return toast('يرجى إدخال الاسم');
          }

          try {
            await setDoc(
              doc(window.db, "classes", classId, "students", email),
              {
                name: newName,
                email,
                className: newClass || ''
              },
              { merge: true }
            );

            toast('✅ تم حفظ التعديلات بنجاح');
            modal.remove();
            renderTeacherStudents();
          } catch (e) {
            console.error(e);
            toast('⚠ حدث خطأ أثناء حفظ التعديلات');
          }
        };
      };

      rows.appendChild(r);
    });

// ✅✅✅ أضف هذا السطر هنا بالضبط
    console.log("✔ تم تحميل الطلاب:", stuSnap.size);


  } catch (e) {
    console.error(e);
    rows.innerHTML = `<div class="row"><div>⚠ خطأ في تحميل الطلاب</div></div>`;
  }
}

function openAddStudentModal() {
  $('#sName').value = '';
  $('#sEmail').value = '';
  $('#sPass').value = '123456';
  $('#modalStudent').classList.remove('hidden');
}

// ✅ حفظ الطالب في Firestore مباشرة
async function saveStudent() {
  const name = $('#sName').value.trim();
  const email = $('#sEmail').value.trim().toLowerCase();
  const className = $('#sClass').value.trim();
  const pass = $('#sPass').value.trim() || "123456";

  if (!name || !email || !className) {
    toast("❗ يرجى تعبئة الاسم والبريد والصف");
    return;
  }

  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== 'teacher') {
    toast("⚠ لا يوجد معلم مسجل حاليًا");
    return;
  }

  const classId = current.classId;
  if (!classId) {
    toast("⚠ لا يوجد فصل مرتبط بالمعلم!");
    return;
  }

  if (!window.db) {
    toast("⚠ قاعدة البيانات غير متاحة");
    return;
  }

  try {
    await setDoc(
      doc(window.db, "classes", classId, "students", email),
      { name, email, className, uid: email, pass },
      { merge: true }
    );
  } catch (e) {
    console.error("⚠ لم يتم الحفظ في Firestore:", e);
    toast("⚠ حدث خطأ أثناء حفظ الطالب في السحابة");
    return;
  }

  $('#modalStudent').classList.add('hidden');
  toast("✔ تم إضافة الطالب بنجاح");

  // تحديث الواجهة فورًا
  renderTeacherStudents();
  renderTeacherView();
  renderTeacherDashboard();

}

async function openCreateAssignment() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  const classId = current.classId;
  if (!classId) {
    toast("⚠ لا يوجد فصل مرتبط بالمعلم!");
    return;
  }

  // تعبئة مستويات القراءة
  const sel = $('#aLevel');
  sel.innerHTML = '';
  LEVELS.forEach(l => {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.name;
    sel.appendChild(o);
  });

  // تحميل الطلاب من Firestore
  const box = $('#studentsChecklist');
  box.innerHTML = `<div style="padding:10px;color:#777">⏳ جاري تحميل الطلاب...</div>`;

  try {
    const stuSnap = await getDocs(
      collection(window.db, "classes", classId, "students")
    );

    box.innerHTML = '';

    if (stuSnap.empty) {
      box.innerHTML = `<div style="padding:10px;color:#777">لا يوجد طلاب في هذا الفصل.</div>`;
      return;
    }

    // إضافة الطلاب إلى القائمة
    stuSnap.forEach(d => {
      const st = d.data();
      const idc = uid("CHK");
      const label = document.createElement('label');
      label.innerHTML = `
        <input type="checkbox" id="${idc}" value="${st.email}">
        ${st.name} (${st.email})
      `;
      box.appendChild(label);
    });

  } catch (e) {
    console.error("❌ خطأ في تحميل الطلاب:", e);
    box.innerHTML = `<div style="padding:10px;color:red">خطأ في تحميل الطلاب</div>`;
  }

  // إعادة تعيين الحقول
  $('#aTitle').value = '';
  $('#aDue').value = '';
  $('#aDesc').value = '';

  // عرض النافذة
  $('#modalAssign').classList.remove('hidden');
}

async function saveAssignment() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  const title = $('#aTitle').value.trim() || 'واجب جديد';
  const level = $('#aLevel').value;
  const due = $('#aDue').value;
  const desc = $('#aDesc').value.trim();

  const students = [...document.querySelectorAll('#studentsChecklist input[type=checkbox]:checked')]
    .map(i => i.value);

  if (!students.length) {
    toast('اختر طالبًا واحدًا على الأقل');
    return;
  }

  const classId = current.classId;
  if (!classId) {
    toast("⚠ لا يوجد فصل مرتبط بالمعلم!");
    return;
  }

  const a = {
    id: uid('A'),
    title,
    level,
    due,
    desc,
    teacherId: current.id,
    classId,
    studentIds: students,
    perStudent: students.reduce((acc, id) => {
      acc[id] = { status: 'required', progress: 0, notes: '' };
      return acc;
    }, {})
  };

  // 1) حفظ محليًا
  const all = getAssignments();
  all.push(a);
  setAssignments(all);

 // 2) حفظ في Firestore
try {
  await setDoc(
    doc(window.db, "classes", classId, "assignments", a.id),
    {
      title: a.title,
      level: a.level,
      due: a.due,
      desc: a.desc,
      teacherId: a.teacherId,
      studentIds: a.studentIds,
      perStudent: a.perStudent
    }
  );

  console.log("✔ تم حفظ الواجب في Firestore");

  // ✅ ✅ ✅ التحديث هنا بالضبط (بعد الحفظ مباشرة)
  // 🔔 إرسال إشعار لكل طالب
  for (const email of students) {
    await createNotification({
      studentId: email,
      title: "📘 واجب جديد",
      message: `تم إضافة واجب جديد: ${title}`,
      icon: "📝",
      type: "assignment",
      refId: a.id
    });
  }

} catch (e) {
  console.error("❌ خطأ في حفظ الواجب في Firestore:", e);
  toast("⚠ تم إنشاء الواجب محليًا فقط (تأكد من الاتصال بالإنترنت)");
}


  $('#modalAssign').classList.add('hidden');
  renderTeacherView();
  renderTeacherDashboard();

  toast('تم إنشاء الواجب وإرساله للطلاب المحددين');
}

async function renderTeacherView() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== 'teacher') return;

  const classId = current.classId;
  if (!classId) return;

  const rows = $('#teacherRows');
  if (!rows) return;

  rows.innerHTML = "⏳ جاري التحميل...";

  const assSnap = await getDocs(collection(window.db, "classes", classId, "assignments"));

  const stuSnap = await getDocs(collection(window.db, "classes", classId, "students"));
  const students = {};
  stuSnap.forEach(d => students[d.id] = d.data());

  rows.innerHTML = '';

  assSnap.forEach(async aDoc => {
    const a = { id: aDoc.id, ...aDoc.data(), classId };

    for (let sid of a.studentIds) {

      // ⭐ تحميل إجابة الطالب من Firestore
      const ansRef = doc(window.db,
        "classes", classId,
        "assignments", a.id,
        "answers", sid
      );

      const ansSnap = await getDoc(ansRef);

      let ps = a.perStudent?.[sid] || {
        status: "required",
        progress: 0,
        notes: "",
        answer: "",
        file: ""
      };

      if (ansSnap.exists()) {
        const data = ansSnap.data();
        ps = { ...ps, ...data };   // ← دمج بيانات Firestore
      }

      const stu = students[sid];

      const r = document.createElement('div');
      r.className = "row";

      r.innerHTML = `
        <div>${stu?.name || sid}</div>
        <div>${a.title}</div>
        <div>
          <span class="status ${
  ps.status === 'done'
    ? 'done'
    : ps.status === 'submitted'
    ? 'review'
    : 'required'
}">
  ${
    ps.status === 'done'
      ? 'منجز ✅'
      : ps.status === 'submitted'
      ? 'قيد المراجعة ⏳'
      : 'مطلوب 📘'
  }
</span>

        </div>
        <div><div class="progress"><i style="width:${ps.progress}%"></i></div></div>
        <div>${ps.notes || "—"}</div>
        <div class="actions">
          <button class="btn mini ghost" data-review="${a.id}:${sid}">👁 مراجعة</button>
        </div>
      `;

      rows.appendChild(r);

      r.querySelector('[data-review]').onclick =
        () => openReviewModal(a, sid, ps, stu);
    }
  });
}

// ============================================
// 📊 لوحة المعلم (Firestore فقط)
async function renderTeacherDashboard() {
  const elStu  = document.getElementById('tc-stu');
  const elAsg  = document.getElementById('tc-asg');
  const elDone = document.getElementById('statCompleted');
  const elAvg  = document.getElementById('statAvgProgress');

  if (!elStu || !elAsg || !elDone || !elAvg) return;

  // حالة تحميل
  elStu.textContent  = '…';
  elAsg.textContent  = '…';
  elDone.textContent = '…';
  elAvg.textContent  = '…';

  const stats = await loadTeacherStatsFromFirestore();
  
  if (!stats) {
    elStu.textContent  = '0';
    elAsg.textContent  = '0';
    elDone.textContent = '0';
    elAvg.textContent  = '0%';
    return;
  }
  // ✅ العرض الصحيح
  elStu.textContent  = stats.students;
  elAsg.textContent  = stats.assignments;
  elDone.textContent = stats.done;
  elAvg.textContent  = stats.avg + '%';

    // 🍩 رسم المخطط الدائري
  renderAvgProgressChart(stats.avg);
}

async function openReviewModal(a, sid, ps, stu) {
  // 📌 1) تحميل إجابة الطالب من Firestore
  const ansRef = doc(
    window.db,
    "classes", a.classId,
    "assignments", a.id,
    "answers", sid
  );

  const ansSnap = await getDoc(ansRef);
  let ansData = ansSnap.exists() ? ansSnap.data() : null;

  const answerText = ansData?.answer || ps.answer || "— لم يُرسل إجابة —";
  const answerFile = ansData?.file || ps.file || "";

  const modal = document.createElement('div');
  modal.className = 'modal';

  modal.innerHTML = `
    <div class="modal-card" style="max-width:600px">
      <button class="modal-close" id="closeReview">✖</button>

      <h3>مراجعة حل الطالب</h3>

      <div class="form-row"><b>الطالب:</b> ${stu?.name || sid}</div>
      <div class="form-row"><b>عنوان الواجب:</b> ${a.title}</div>

      <div class="form-row"><b>إجابة الطالب:</b>
        <p style="background:#f8fafc;padding:.7rem;border-radius:10px">
          ${answerText}
        </p>
      </div>

      ${answerFile ? `
        <div class="form-row">
          <b>الملف المرفق:</b>
          <a href="${answerFile}" target="_blank" class="btn sky small">فتح الملف</a>
        </div>
      ` : ''}

      <div class="form-row">
        <label>ملاحظة للطالب (اختياري)</label>
        <textarea id="teacherNote" rows="3">${ps.notes || ''}</textarea>
      </div>

      <div class="row" style="display:flex;justify-content:flex-end;gap:.5rem">
        <button id="rejectAns" class="btn warn small">رفض ❌</button>
        <button id="approveAns" class="btn primary small">قبول ✅</button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  $('#closeReview').onclick = () => modal.remove();

// ⭐ 3) قبول الحل
$('#approveAns').onclick = async () => {
  const note = $('#teacherNote').value.trim();

  await setDoc(
    ansRef,
    {
      ...ansData,
      status: "done",
      progress: 100,
      notes: note
    },
    { merge: true }
  );

  // 🔔 إشعار للطالب (تم قبول الحل)
  await createNotification({
    studentId: sid,
    title: "✅ تم تصحيح واجبك",
    message: `تم قبول واجب: ${a.title}`,
    icon: "🎉",
    type: "review",
    refId: a.id
  });

  modal.remove();
  toast("✨ تم قبول حل الطالب");
  renderTeacherView();
};


 // ⭐ 4) رفض الحل
$('#rejectAns').onclick = async () => {
  const note = $('#teacherNote').value.trim() || "يرجى تحسين الإجابة";

  await setDoc(
    ansRef,
    {
      ...ansData,
      status: "required",
      progress: 0,
      notes: note
    },
    { merge: true }
  );

  // 🔔 إشعار للطالب (تم رفض الحل)
  await createNotification({
    studentId: sid,
    title: "❌ تم رفض الحل",
    message: `يرجى مراجعة واجب: ${a.title}`,
    icon: "📝",
    type: "review",
    refId: a.id
  });

  modal.remove();
  toast("❌ تم رفض الحل");
  renderTeacherView();
};

}

// ------------------------------------------------------
// Reports
// ------------------------------------------------------

function updateReports() {
  const current = readJSON(LS.CURRENT, null);

  if (!current || current.role !== 'student') {
    $('#repPercent').textContent = '0%';
    $('#repReads').textContent = 0;
    $('#repTime').textContent = '0 دقيقة';
    const ctx = $('#chartReads');
    if (ctx && window._cr) window._cr.destroy();
    return;
  }

  const key = LS.STATS(current.id);
  const s = readJSON(key, { reads: 0, minutes: 0 });

  const percent = Math.min(100, Math.floor((s.reads / BOOKS.length) * 100));
  $('#repPercent').textContent = percent + '%';
  $('#repReads').textContent = s.reads;
  $('#repTime').textContent = s.minutes + ' دقيقة';

  const ctx = $('#chartReads'); if (!ctx) return;
  if (window._cr) window._cr.destroy();
  window._cr = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: BOOKS.map(b => b.title),
      datasets: [{ label: 'القراءات', data: BOOKS.map((_, i) => i < s.reads ? 1 : 0) }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0, maxTicksLimit: 4 } } }
    }
  });
}

// ------------------------------------------------------
// Reader + تسجيل الصوت + تحديث الإحصاءات
// ------------------------------------------------------

let mediaRecorder, chunks = [], timerInt, startTime, audioBlob = null;

function openReader(book) {
  currentBook = book;

  // 🔁 إعادة تهيئة التفاعل (مهم جدًا)
  interactionCount = 0;
  maxScrollPercent = 0;
  hasInteractedWithStory = false;
activeReadingStartAt = null;
  // تسجيل وقت بدء القراءة
  readingStartAt = Date.now();


  // ===============================
  // ✅ ربط عنوان ومستوى القصة الصحيح
  // ===============================
  const titleEl = document.getElementById("storyTitle");
  if (titleEl) titleEl.textContent = book.title || "—";

  const levelEl = document.getElementById("storyLevel");
  if (levelEl && book.level) {
    const levelName = LEVELS.find(l => l.id === book.level)?.name || book.level;
    levelEl.textContent = levelName;
  }

  const coverEl = document.getElementById("storyCover");
  if (coverEl && book.cover) {
    coverEl.src = book.cover;
  }


  // إظهار القارئ
  $('#appShell').classList.add('hidden');
  $('#readerView').classList.remove('hidden');

  // ===============================
  // ✅ عرض نص القصة
  // ===============================
  const host = document.getElementById("storyContent");
  if (host) {
    host.innerHTML = "";

    book.text.forEach(p => {
      const para = document.createElement("p");
// تقسيم الفقرة إلى كلمات قابلة للنقر
para.innerHTML = p.split(' ').map(word =>
  `<span class="word">${word}</span>`
).join(' ');

// تفعيل التظليل عند الضغط (مع ربط نور)
para.querySelectorAll('.word').forEach(span => {
  span.onclick = (e) => {
    e.stopPropagation(); // ⭐ يمنع تشغيل حدث الفقرة

    span.classList.toggle('word-selected');
    interactionCount++;

    // ⏱️ بدء العد الحقيقي بعد تفاعل حقيقي
    if (interactionCount === 3) {
      activeReadingStartAt = Date.now();
    }

    hasInteractedWithStory = interactionCount >= 3;

    // 🤖 تمرير الكلمة فقط إلى نور
    const aiInput = document.getElementById("noorAiInput");
    if (aiInput) {
      aiInput.value = span.textContent.trim();
    }

    // إظهار صندوق نور إن كان مخفيًا
    const noorBox = document.querySelector(".noor-ai-box");
    if (noorBox) {
      noorBox.classList.remove("hidden");
    }
  };
});


host.appendChild(para);

    });

      enableNoorOnParagraphs();
  }

// ===============================
// 📜 مراقبة التمرير الحقيقي
// ===============================
host.onscroll = null; // منع التكرار
host.addEventListener("scroll", () => {
  const percent =
    (host.scrollTop + host.clientHeight) / host.scrollHeight;

  maxScrollPercent = Math.max(maxScrollPercent, percent);
});

  
// ===============================
// 🧠 حساب عدد الكلمات والزمن الأدنى
// ===============================
const wordCount = book.text.join(" ").split(/\s+/).length;
window.MIN_SECONDS =
  wordCount < 80
    ? 20
    : Math.max(60, Math.round(wordCount * 0.3));
  
  // ===============================
  // تهيئة عناصر التسجيل
  // ===============================
  $('#recordTime').textContent = '⏱️ 00:00';
  $('#playRec').classList.add('hidden');
  $('#stopRec').classList.add('hidden');
  $('#startRec').classList.remove('hidden');
}

window.openReader = openReader;


async function getNextBookForStudent() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || !current.level || !window.db) return null;

  const stats = await loadStudentStatsFromFirestore();
  const readBooks = Object.keys(stats.books || {});

  const levelBooks = BOOKS.filter(b => b.level === current.level);
  if (!levelBooks.length) return null;

  return levelBooks.find(b => !readBooks.includes(b.id)) || null;
}





function backToApp() {

  // 📌 حفظ آخر قصة قرأها الطالب
  const current = readJSON(LS.CURRENT, null);
  if (currentBook && current?.role === "student") {
    current.lastReadBookId = currentBook.id;
    writeJSON(LS.CURRENT, current);
  }

  // =====================================
// 🧠 احتساب القراءة (قبل إخفاء القارئ)
// =====================================
let counted = false;

if (activeReadingStartAt && currentBook) {

  const host = document.getElementById("storyContent");

  const diffMs = Date.now() - activeReadingStartAt;
  const secondsSpent = Math.round(diffMs / 1000);

  const scrollOK =
    maxScrollPercent >= 0.7 ||
    (host && host.scrollHeight <= host.clientHeight + 20);

  const activityDone =
    current &&
    readJSON(LS.STATS(current.id), {}).activities > 0;

  if (
    hasInteractedWithStory &&
    secondsSpent >= window.MIN_SECONDS &&
    (scrollOK || activityDone)
  ) {
    const minutesSpent = Math.max(1, Math.round(secondsSpent / 60));
    updateReadStats(currentBook.id, minutesSpent);
    counted = true; // ✅ القراءة احتُسبت
  } else {
    console.log("⏭️ قراءة لم تُحتسب", {
      hasInteractedWithStory,
      secondsSpent,
      minRequired: window.MIN_SECONDS,
      scrollOK,
      activityDone
    });
  }
}


  // =====================================
  // 🧹 إخفاء القارئ والعودة للتطبيق
  // =====================================
  $('#readerView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');

   // 🔁 إعادة تهيئة
  activeReadingStartAt = null;
  readingStartAt = null;
  hasInteractedWithStory = false;
  maxScrollPercent = 0;
  interactionCount = 0;  

  if (counted) {
  
  // ✅ بدلاً من الرجوع للرئيسية: أكمل تلقائيًا
  autoContinueReading();
  return;
}

// إذا لم تُحتسب القراءة → رجوع عادي
showOnly('#tab-home');
updateKidsHomeProgress();

 
}



async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
  } catch (e) {
    alert('المتصفح منع الميكروفون. فعّل الأذونات.');
    return;
  }
  chunks = []; audioBlob = null;
  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    audioBlob = new Blob(chunks, { type: 'audio/ogg;codecs=opus' });
    $('#playRec').classList.remove('hidden');
  };
  mediaRecorder.start();
  $('#startRec').classList.add('hidden');
  $('#stopRec').classList.remove('hidden');
  startTime = Date.now();
  timerInt = setInterval(() => {
    const s = Math.floor((Date.now() - startTime) / 1000);
    const mm = String(Math.floor(s / 60)).padStart(2, '0');
    const ss = String(s % 60).padStart(2, '0');
    $('#recordTime').textContent = `⏱️ ${mm}:${ss}`;
  }, 1000);
}

function stopRecording() {
  if (mediaRecorder) { mediaRecorder.stop(); }
  clearInterval(timerInt);
  $('#stopRec').classList.add('hidden');
  $('#startRec').classList.remove('hidden');
}

function playRecording() {
  if (!audioBlob) return;
  new Audio(URL.createObjectURL(audioBlob)).play();
}

async function updateReadStats(bookId, minutesSpent = 0) {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== "student" || !window.db) return;

  const ref = doc(window.db, "readingStats", current.email);
  const snap = await getDoc(ref);

  const prev = snap.exists() ? snap.data() : {
    reads: 0,
    minutes: 0,
    books: {},
    lastBook: "—",
    activities: 0
  };

  // 🧠 تحديث سحابي (المصدر الأساسي)
  const updated = {
    reads: prev.reads + 1,
    minutes: prev.minutes + (minutesSpent || 0),
    books: {
      ...(prev.books || {}),
      [bookId]: true
    },
    lastBook: BOOKS.find(b => b.id === bookId)?.title || prev.lastBook,
    activities: prev.activities || 0,
    updatedAt: Date.now()
  };

  await setDoc(ref, updated, { merge: true });

  // ============================
  // 🔄 تحديث الواجهة (بدون LocalStorage)
  // ============================
  updateRailFromCloud(updated);
  updateKidsHomeProgressFromCloud(updated);
  updateReportsFromCloud(updated);

  // ⭐ تحديث الأوسمة
  renderStaticNoorBadges(updated);

  // 🎯 التحدي اليومي (ما زال يعمل)
  if (minutesSpent >= 1) {
    completeDailyChallenge();
  }

  // 🏆 الإنجازات (نعطيها البيانات السحابية)
  updateAchievements(updated);
}





// حفظ قصة جديدة — Firestore + تحديث المكتبة
async function saveBook() {
  const modal = document.getElementById('modalBook');
if (modal.dataset.mode === "edit") return;

  const title = $('#bTitle').value.trim();
  const level = $('#bLevel').value;
  let cover = $('#bCover').value.trim();
  const textRaw = $('#bText').value.trim();

  if (!title || !level || !textRaw) {
    toast("❗ يرجى تعبئة العنوان والمستوى والنص");
    return;
  }

  const text = textRaw.split('\n').map(t => t.trim()).filter(t => t);
  const upload = $('#bFile')?.files?.[0];
  if (upload) cover = URL.createObjectURL(upload);

  if (!cover) {
    cover = `https://picsum.photos/seed/${encodeURIComponent(title)}/400/550`;
  }

  if (!cover.startsWith("http") && !cover.startsWith("blob:")) {
    toast("⚠ رابط الصورة غير صالح");
    return;
  }

  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== 'teacher') {
    toast("⚠ لا يوجد معلم مسجل حاليًا");
    return;
  }

  const classId = current.classId || (getTeacherClass(current.id)?.id);
  if (!classId) {
    toast("⚠ لا يوجد فصل مرتبط بالمعلم!");
    return;
  }

  const id = uid("B");

  const bookData = {
    id,
    title,
    level,
    cover,
    text,
    quiz: []
  };

  if (window.db) {
    await setDoc(
      doc(window.db, "classes", classId, "books", id),
      bookData
    );
  }

  BOOKS.push(bookData);
  $('#modalBook').classList.add('hidden');
delete modal.dataset.mode;
delete modal.dataset.bookId;
  
  renderBooks("ALL");
  toast("✓ تمت إضافة القصة (سحابة + محلي) 🎉");
}


// ===============================
// ✏️ تعديل قصة موجودة
// ===============================
function openEditBookModal(book) {
  book = structuredClone(book);

  const modal = document.getElementById('modalBook');
  modal.dataset.mode = "edit";   // ⭐ هنا التحديد
  modal.dataset.bookId = book.id;

  $('#bTitle').value = book.title;
  $('#bLevel').value = book.level;
  $('#bCover').value = book.cover || '';
  $('#bText').value = book.text.join('\n');

  modal.classList.remove('hidden');

  const saveBtn = document.getElementById('saveBook');
  saveBtn.onclick = async () => {
    book.title = $('#bTitle').value.trim();
    book.level = $('#bLevel').value;
    book.cover = $('#bCover').value.trim();
    book.text  = $('#bText').value.trim().split('\n');

    await setDoc(
      doc(
        window.db,
        "classes",
        readJSON(LS.CURRENT).classId,
        "books",
        book.id
      ),
      book,
      { merge: true }
    );

    modal.classList.add('hidden');

   delete modal.dataset.mode;
delete modal.dataset.bookId;
    
    toast("✏️ تم تعديل القصة بنجاح");   // ✅ الرسالة الصحيحة
    renderBooks('ALL');
  };
}


// حفظ سؤال اختبار (quiz) داخل نفس وثيقة القصة في Firestore
async function saveQuiz() {
  const bookId = $('#qBookSelect').value;
  const question = $('#qText').value.trim();
  const optionsRaw = $('#qOptions').value.trim();
  const correct = Number($('#qCorrect').value);

  if (!bookId || !question || !optionsRaw || isNaN(correct)) {
    toast("❗ يرجى تعبئة جميع الحقول");
    return;
  }

  const options = optionsRaw.split('\n').map(t => t.trim()).filter(t => t);
  if (options.length < 2) {
    toast("⚠ يجب إدخال خيارين على الأقل");
    return;
  }

  const bookIndex = BOOKS.findIndex(b => b.id === bookId);
  let book = BOOKS[bookIndex];

  if (!book) {
    toast("❌ لم يتم العثور على القصة");
    return;
  }

  if (!book.quiz) book.quiz = [];
  book.quiz.push({ q: question, options, correct });

  // تحديث المصفوفة في الذاكرة
  BOOKS[bookIndex] = book;

  // تحديث القصة في Firestore — حقل quiz داخل وثيقة الكتاب
  const current = readJSON(LS.CURRENT, null);
  if (current && current.classId && window.db) {
    await setDoc(
      doc(window.db, "classes", current.classId, "books", book.id),
      { quiz: book.quiz },
      { merge: true }
    );
  }

  $('#modalQuizEditor').classList.add('hidden');
  toast("✓ تمت إضافة السؤال بنجاح (تم حفظه في القصة نفسها)");
}

function confirmSubmitModal(callback) {
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.innerHTML = `
    <div class="modal-card" style="max-width:400px;text-align:center">
      <h3>📤 تأكيد إرسال الحل</h3>
      <p style="margin:10px 0;color:#555">بعد الإرسال لن تتمكن من تعديل إجابتك.</p>
      <div style="display:flex;justify-content:center;gap:.5rem;margin-top:1rem">
        <button id="confirmSendBtn" class="btn primary small">إرسال</button>
        <button id="cancelSendBtn" class="btn ghost small">إلغاء</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  $('#cancelSendBtn').onclick = () => modal.remove();
  $('#confirmSendBtn').onclick = () => {
    modal.remove();
    callback();
  };
}

// ===============================================
//  🛠 إصلاح تلقائي للواجبات لتعمل في كل المتصفحات
// ===============================================

function autoFixAssignments() {
  let assigns = JSON.parse(localStorage.getItem("arp.assignments") || "[]");
  const current = JSON.parse(localStorage.getItem("arp.current") || "{}");

  if (!current || !current.email) return;

  const studentEmail = current.email;

  let changed = false;

  assigns = assigns.map(a => {
    if (!a.studentIds) return a;

    if (a.studentIds.includes(studentEmail)) return a;

    const newPer = {};
    for (const oldId in a.perStudent || {}) {
      newPer[studentEmail] = a.perStudent[oldId];
      changed = true;
    }

    return {
      ...a,
      studentIds: [studentEmail],
      perStudent: newPer
    };
  });

  if (changed) {
    localStorage.setItem("arp.assignments", JSON.stringify(assigns));
    console.log("✔ تم إصلاح الواجبات تلقائيًا باستخدام البريد");
  }
}



function listenToNotifications() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || !current.email || !window.db) return;

  const NOTIFY_TTL = 60 * 60 * 1000; // ساعة

  const q = query(
    collection(window.db, "notifications"),
    where("studentId", "==", current.email),
    orderBy("createdAt", "desc")
  );

  onSnapshot(q, (snap) => {
    const list  = document.getElementById("notifyList");
    const count = document.getElementById("notifyCount");

    if (!list || !count) return;

    list.innerHTML = "";
    let unread = 0;

    if (snap.empty) {
      list.innerHTML = `<div class="notify-empty">لا توجد إشعارات</div>`;
      count.classList.add("hidden");
      return;
    }

    snap.forEach(docSnap => {
      const n = docSnap.data();
      const id = docSnap.id;

      // ⏳ إخفاء الإشعار المقروء القديم
      if (
        n.isRead &&
        n.readAt &&
        Date.now() - n.readAt > NOTIFY_TTL
      ) {
        return;
      }

      // 🔴 حساب غير المقروء
      if (!n.isRead) unread++;

      const item = document.createElement("div");
      item.className = `notify-item ${n.isRead ? "read" : "unread"}`;

      item.innerHTML = `
        <div class="notify-icon">${n.icon || "🔔"}</div>
        <div class="notify-body">
          <strong>${n.title}</strong>
          <div class="muted">${n.message}</div>
        </div>
      `;

      item.onclick = async () => {
        if (!n.isRead) {
          await setDoc(
            doc(window.db, "notifications", id),
            { isRead: true, readAt: Date.now() },
            { merge: true }
          );
        }
      };

      list.appendChild(item);
    });

    // 🔴 العداد الأحمر
    count.textContent = unread;
    count.classList.toggle("hidden", unread === 0);
  });
}

// ============================================
// 🎯 تثبيت / إغلاق بطاقة الإحصاءات بالنقر (Safe)
// ============================================

(function initScoreCardToggle(){
  document.addEventListener('click', (e) => {
    const card = document.querySelector('.score-card.collapsible');
    if (!card) return;

    // إذا الضغط داخل البطاقة
    if (card.contains(e.target)) {
      card.classList.toggle('open');
      e.stopPropagation(); // 🛑 مهم جدًا
    } 
    // إذا الضغط خارجها
    else {
      card.classList.remove('open');
    }
  });
})();


// ------------------------------------------------------
// Boot
// ------------------------------------------------------

async function startApp() {
  // 1) قراءة المستخدم الحالي
 let current = JSON.parse(localStorage.getItem("arp.current") || "null");

console.log("DEBUG CURRENT =", current);

if (!current || !current.email) {
  localStorage.removeItem("arp.current");
  $('#authView').classList.remove('hidden');
  $('#appShell').classList.add('hidden');

  // ⭐⭐ هذا هو المطلوب
  document.body.classList.add('is-auth');
  return;
}


// ✅ هنا بالضبط
if (current.role === 'student') {
  await loadStudentStatsFromFirestore();
  // 📌 تحديث بطاقة حالتك اليوم
    await updateDailyStatusFromFirestore();
}

    // 3) إصلاح الواجبات القديمة (يعمل فقط عند وجود مستخدم)
// autoFixAssignments();

  // 4) التحكم في أزرار المعلم
  if (current.role === 'teacher') {
    $$('.only-teacher').forEach(btn => btn.style.display = 'inline-block');
  } else {
    $$('.only-teacher').forEach(btn => btn.style.display = 'none');
  }

  // ⭐ وسم الصفحة بدور المستخدم (لاستخدام CSS)
document.body.classList.toggle('is-teacher', current.role === 'teacher');

  // 5) تعبئة بيانات المستخدم في الواجهة
  $('#helloName').textContent = 'مرحبًا ' + current.name + '!';
  $('#userName').textContent = current.name;
  $('#userRoleLabel').textContent = current.role === 'teacher' ? 'معلم' : 'طالب';
setUnifiedAvatar(current.role);

  // 6) إخفاء شاشة الدخول وإظهار التطبيق
  $('#authView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');

// 🧸 تفعيل Kids Home (للطلاب فقط)
if (current.role === 'student') {
  document.getElementById("kidsHome")?.classList.remove("hidden");
}

  // ❌ إخفاء الواجهة القديمة
document.querySelector(".legacy-home")?.classList.add("hidden");

  $('#readerView').classList.add('hidden');

  // ⭐⭐ إلغاء وضع الدخول
document.body.classList.remove('is-auth');

  // 7) تحميل بيانات الواجبات من Firestore (للطلاب فقط)
  if (current.role === 'student') {
    let classId = current.classId || null;

    if (!classId) {
      classId = await findClassIdForStudent(current.email || current.id);
    }

    if (classId) {
      writeJSON(LS.CURRENT, { ...current, classId });

      await syncAssignmentsFromFirestore(classId);
      await loadStudentAnswersFromFirestore(classId, current.id);
      await syncBooksWithFirestore(classId);

// ============================================
// 🎯 تشغيل اختبار تحديد المستوى (مرة واحدة فقط)
// ============================================
if (window.db) {
  const profRef = doc(
    window.db,
    "classes", classId,
    "profiles", current.email
  );
  const profSnap = await getDoc(profRef);

  // ✅✅✅ (1) استخراج المستوى الحالي
  let level = "L1";

  if (profSnap.exists()) {
    level = profSnap.data()?.level || "L1";
  }

  // ✅✅✅ (2) حفظ المستوى داخل الجلسة
  current.level = level;
  writeJSON(LS.CURRENT, current);

  // ✅ (3) فتح اختبار تحديد المستوى إن لم يُنجز
  if (!profSnap.exists() || !profSnap.data()?.placementDone) {
    setTimeout(() => {
      openPlacementModal(classId, current.email);
    }, 600);
  }
}

  } else {
    console.warn("⚠️ لم يتم العثور على فصل مرتبط بهذا الطالب.");
  }
    }


// 7 مكرر) مزامنة الواجبات للمعلم أيضًا من Firestore
if (current.role === 'teacher') {
  let classId = current.classId || null;

  // 🔥 جلب classId الحقيقي من Firestore
  if (!classId) {
    classId = await findClassIdForTeacher(current.id);
  }

  if (!classId) {
    console.warn("⚠ لا يوجد فصل مرتبط بهذا المعلم في Firestore");
    return;
  }

  // ⭐ حفظ classId في الجلسة
  writeJSON(LS.CURRENT, { ...current, classId });
current.classId = classId;

  await syncAssignmentsFromFirestore(classId);
  await syncBooksWithFirestore(classId);
}

  // 8) بناء أجزاء الصفحة
  buildNav(current.role);
  renderLevels();
  renderBooks('ALL');
  renderStudentAssignments('required');
  await renderTeacherStudents();
  await renderTeacherView();

  updateReports();
  updateRail();

// ============================================
  // 🎯 التحدي اليومي (للطلاب فقط)
  // ============================================
  if (current.role === "student") {
    loadDailyChallenge();     // تحميل / إعادة تعيين تحدي اليوم
    renderAchievements();     // عرض جدار الإنجازات
  }

// بعد buildNav و updateRail
listenToNotifications();
}


// ⭐⭐⭐ مهم: تعريف startApp على window ⭐⭐⭐
window.startApp = startApp;

// =============================
// أحداث عامة
// =============================
document.addEventListener('click', (e) => {
  const go = e.target.closest('.go');
  if (go) showOnly(go.dataset.go);

  const closeId = e.target.dataset?.close;
  if (closeId) document.getElementById(closeId).classList.add('hidden');
});

document.addEventListener('DOMContentLoaded', () => {

document.getElementById("googleLogin")
  ?.addEventListener("click", loginWithGoogle);

  $('#searchBooks')?.addEventListener('input', () => renderBooks('ALL'));

  // تبديل تبويبات الواجبات للطالب
  $$('#tab-assign .pill').forEach(p => p.onclick = () => {
    $$('#tab-assign .pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    renderStudentAssignments(p.dataset.filter);
  });


  // أزرار إدارة المنصة
  document.addEventListener('click', (e) => {

    if (e.target.id === 'addStudentBtn') openAddStudentModal();
    if (e.target.id === 'saveStudent') saveStudent();

    if (e.target.id === 'newAssignBtn') openCreateAssignment();
    if (e.target.id === 'saveAssign') saveAssignment();

    if (e.target.id === 'saveBook') saveBook();

    if (e.target.id === "addBookBtn") {

     const modal = document.getElementById('modalBook');

  // ✅ التحديث المستحسن (1)
  modal.dataset.mode = "add";
  delete modal.dataset.bookId;
 
      $('#bTitle').value = '';
      $('#bCover').value = '';
      $('#bText').value = '';
      $('#modalBook').classList.remove('hidden');
    }

    if (e.target.id === "addQuizBtn") {
      const sel = $('#qBookSelect');
      sel.innerHTML = '';
      BOOKS.forEach(b => {
        const op = document.createElement('option');
        op.value = b.id;
        op.textContent = b.title;
        sel.appendChild(op);
      });
      $('#qText').value = '';
      $('#qOptions').value = '';
      $('#qCorrect').value = '';
      $('#modalQuizEditor').classList.remove('hidden');
    }

    if (e.target.id === "saveQuiz") {
      saveQuiz();
    }
  });


 // ❌ إغلاق صندوق نور (تحسين UX)
document.getElementById("closeNoor")?.addEventListener("click", () => {
  const box = document.querySelector(".noor-ai-box");
  const input = document.getElementById("noorAiInput");
  const answer = document.getElementById("noorAiAnswer");

  box?.classList.add("hidden");

  if (input) input.value = "";
  if (answer) {
    answer.innerHTML = "";
    answer.classList.add("hidden");
  }
});


  // قارئ القصص
  $('#backToApp').addEventListener('click', backToApp);
  $('#startRec').addEventListener('click', startRecording);
  $('#stopRec').addEventListener('click', stopRecording);
  $('#playRec').addEventListener('click', playRecording);

  $('#closeQuiz')?.addEventListener('click', () => {
    $('#modalQuiz').classList.add('hidden');
  });


// ===============================
// 🧸 Kids Home – Start Reading
document.getElementById("btnStartReading")
  ?.addEventListener("click", async () => {
    const nextBook = await getNextBookForStudent();
    if (nextBook) openReader(nextBook);
    else await autoContinueReading(); // أو autoContinueReading() فقط
  });


// رحلتي
document.getElementById("btnMyJourney")?.addEventListener("click", () => {
  showOnly("#tab-levels");
});

// إنجازاتي
document.getElementById("btnMyAwards")?.addEventListener("click", () => {
  showOnly("#tab-achievements");
}); 

  // زر إنهاء اختبار القصة
  $('#submitQuiz')?.addEventListener('click', () => {

    if (!currentBook || !currentBook.quiz) {
      toast("لا توجد أنشطة لهذه القصة");
      return;
    }

    let score = 0;

    currentBook.quiz.forEach((q, i) => {
      const selected = document.querySelector(`input[name="q${i}"]:checked`);
      if (selected && Number(selected.value) === q.correct) {
        score++;
      }
    });

    addActivity();

    $('#modalQuiz').classList.add('hidden');
    toast("✓ تم إنهاء النشاط. نتيجتك: " + score + "/" + currentBook.quiz.length);
  });

  // زر فتح الأنشطة للقصة الحالية
  document.getElementById("openActivitiesBtn")?.addEventListener("click", () => {
    if (!currentBook || !currentBook.quiz || !currentBook.quiz.length) {
      toast("لا توجد أنشطة لهذه القصة");
      return;
    }

    const box = $('#quizContent');
    box.innerHTML = '';

    currentBook.quiz.forEach((q, i) => {
      const div = document.createElement('div');
      div.className = 'quiz-block';
      const optsHtml = q.options.map((opt, idx) => `
        <label style="display:block;margin:.2rem 0">
          <input type="radio" name="q${i}" value="${idx}">
          ${opt}
        </label>
      `).join('');
      div.innerHTML = `
        <p><b>${i + 1}.</b> ${q.q}</p>
        ${optsHtml}
      `;
      box.appendChild(div);
    });

    $('#modalQuiz').classList.remove('hidden');
  });

// 🔔 فتح / إغلاق لوحة الإشعارات
document.getElementById("notifyBtn")?.addEventListener("click", (e) => {
  e.stopPropagation();
  document.getElementById("notifyPanel")?.classList.toggle("hidden");
});

// 🔒 منع إغلاق اللوحة عند الضغط داخلها
document.getElementById("notifyPanel")?.addEventListener("click", (e) => {
  e.stopPropagation();
});

// ❌ إغلاقها فقط عند الضغط خارجها
document.addEventListener("click", () => {
  document.getElementById("notifyPanel")?.classList.add("hidden");
});

 // ============================================
// زر الخروج
$('#logoutBtn')?.addEventListener('click', confirmLogout);

// تشغيل التطبيق مباشرة لو فيه مستخدم محفوظ
startApp();
});


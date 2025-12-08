// ------------------------------------------------------
// منصة لغتي - ملف app.js
// ------------------------------------------------------

// ===== متغير عام للقصة الحالية في القارئ =====
let currentBook = null;

// ===== Firestore Imports =====
import {
  doc, setDoc, getDoc, getDocs, collection
} from "https://www.gstatic.com/firebasejs/12.6.0/firebase-firestore.js";

// ملاحظة: سنستخدم window.db الذي تم ضبطه في index.html

// ===== Storage keys =====
const LS = {
  USERS: 'arp.users',
  CURRENT: 'arp.current',
  ROLE: 'arp.role',
  CLASSES: 'arp.classes',
  ASSIGN: 'arp.assignments',
  STATS: uid => `arp.stats.${uid}`
};

// ===== Data =====
const LEVELS = [
  { id: 'L1', name: 'المستوى 1 (مبتدئ)' },
  { id: 'L2', name: 'المستوى 2 (أساسي)' },
  { id: 'L3', name: 'المستوى 3 (متوسط)' },
  { id: 'L4', name: 'المستوى 4 (متقدم)' }
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
const readJSON = (k, def) => JSON.parse(localStorage.getItem(k) || JSON.stringify(def));
const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = (p = 'U') => p + Math.random().toString(36).slice(2, 8);

function toast(msg) { alert(msg); }

// ------------------------------------------------------
// Firestore Helpers (كتب + واجبات)
// ------------------------------------------------------

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

  // المعلم: مزامنة
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

// 🔹 حفظ سؤال اختبار في Firestore
async function saveQuizToFirestore(classId, bookId, quiz) {
  if (!window.db) return;
  const qId = uid("Q");
  await setDoc(
    doc(window.db, "classes", classId, "quizzes", bookId, qId),
    quiz
  );
}

// 🔹 حفظ حل الطالب في Firestore
async function saveAssignmentAnswerToFirestore(classId, assignId, studentId, data) {
  if (!window.db) return;
  await setDoc(
    doc(
      doc(window.db, "classes", classId),
      "assignments", assignId,
      "answers", studentId
    ),
    {
      ...data,
      updatedAt: Date.now()
    },
    { merge: true }
  );
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

// 🔹 تحميل إجابات الطالب من Firestore
export async function loadStudentAnswersFromFirestore(classId, studentId) {
  if (!window.db) return;

  const snap = await getDocs(
    collection(window.db, "classes", classId, "assignments")
  );

  const localAssignments = getAssignments();

  for (const docA of snap.docs) {
    const assignId = docA.id;

    const ansRef = doc(
      doc(window.db, "classes", classId),
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
//  🔥 مزامنة الواجبات من Firestore
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



// ------------------------------------------------------
// التنقل والتبويبات + لوحة الجانب الأيمن
// ------------------------------------------------------

function showOnly(selector) {
  $$('.view').forEach(v => v.classList.add('hidden'));
  $('#readerView')?.classList.add('hidden');

  const el = document.querySelector(selector);
  if (el) el.classList.remove('hidden');

  $$('#navLinks .pill').forEach(p => {
    if (p.dataset.target === selector) p.classList.add('active');
    else p.classList.remove('active');
  });

  if (selector === '#tab-teacher') {
    renderAvgProgressChart();
  }
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

  items.forEach(([target, label], i) => {
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

  if (current.role === 'teacher') {
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

  const key = LS.STATS(current.id);
  const s = readJSON(key, { reads: 0, minutes: 0, lastBook: '—', activities: 0 });

  $('#railBooks').textContent = s.reads;
  $('#railTime').textContent = s.minutes + ' د';
  $('#railBadges').textContent = Math.floor(s.reads / 5);

  const avg = s.reads > 0 ? (s.minutes / s.reads).toFixed(1) : 0;
  const avgBox = $('#railAvg');
  if (avgBox) avgBox.textContent = avg + ' د';

  const lastBox = $('#railLastBook');
  if (lastBox) lastBox.textContent = s.lastBook;

  const actBox = $('#railActs');
  if (actBox) actBox.textContent = s.activities;
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

function getAssignments() { return readJSON(LS.ASSIGN, []); }
function setAssignments(x) { writeJSON(LS.ASSIGN, x); }
function getClasses() { return readJSON(LS.CLASSES, []); }
function setClasses(x) { writeJSON(LS.CLASSES, x); }
function getUsers() { return readJSON(LS.USERS, []); }
function setUsers(x) { writeJSON(LS.USERS, x); }

function computeAverageProgress() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== 'teacher') return 0;

  const c = getTeacherClass(current.id);
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
            label: ctx => `${ctx.label}: ${ctx.raw}%`
          }
        }
      }
    }
  });
}

// ------------------------------------------------------
// Auth (تسجيل وإنشاء حساب + تسجيل خروج)
// ------------------------------------------------------

function registerUser(e) {
  e.preventDefault();
  const name = $('#regName').value.trim();
  const email = $('#regEmail').value.trim().toLowerCase();
  const pass = $('#regPass').value;
  const role = $('#regRole').value;
  const users = readJSON(LS.USERS, []);
  if (users.some(u => u.email === email)) { $('#regMsg').textContent = 'البريد مستخدم بالفعل.'; return; }
  const id = uid('U');
  users.push({ id, name, email, pass, role, created: Date.now() });
  writeJSON(LS.USERS, users);
  if (role === 'teacher') {
    const classes = readJSON(LS.CLASSES, []);
    classes.push({ id: uid('C'), teacherId: id, name: 'فصلي', students: [] });
    writeJSON(LS.CLASSES, classes);
  }
  $('#regMsg').style.color = '#16a34a';
  $('#regMsg').textContent = 'تم إنشاء الحساب! يمكنك تسجيل الدخول الآن.';
  $$('[data-auth]').forEach(p => p.classList.remove('active'));
  $$('[data-auth]')[0].classList.add('active');
  $('#regForm').classList.add('hidden');
  $('#loginForm').classList.remove('hidden');
}

function loginUser(e) {
  e.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPass').value;
  const users = readJSON(LS.USERS, []);
  const user = users.find(u => u.email === email && u.pass === pass);
  if (!user) { $('#loginMsg').textContent = 'بيانات الدخول غير صحيحة.'; return; }
  writeJSON(LS.CURRENT, { id: user.id, name: user.name, email: user.email, role: user.role });
  // ⭐⭐ إضافة الطالب إلى فصل المعلم تلقائيًا ⭐⭐
const classes = readJSON(LS.CLASSES, []);
let classObj = classes[0]; // نفترض معلم واحد = فصل واحد
if (classObj && !classObj.students.includes(user.id)) {
    classObj.students.push(user.id);
    writeJSON(LS.CLASSES, classes);
}
  startApp();
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

  let classId = null;
  if (current.role === 'teacher') {
    classId = getTeacherClass(current.id).id;
  } else {
    const classes = getClasses();
    const found = classes.find(c => c.students.includes(current.id));
    classId = found ? found.id : current.classId || null;
  }

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
    c.innerHTML = `
      <img src="${b.cover}" style="width:100%;border-radius:12px;margin-bottom:.5rem">
      <h4>${b.title}</h4>
      <div class="badge ok">مستوى ${b.level}</div>
    `;
    c.onclick = () => openReader(b);
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
      <div class="meta">
        <span>${LEVELS.find(l => l.id === a.level)?.name || '—'}</span>
        <span>${a.due || '-'}</span>
      </div>
      <p class="muted" style="margin:.3rem 0">${a.desc || ''}</p>
      <div class="meta"><span class="badge ${a.statusClass}">${a.statusLabel}</span></div>
      <div class="progress" aria-label="progress"><i style="width:${a.progress || 0}%"></i></div>
      <div class="row" style="margin-top:.6rem;display:flex;gap:.4rem;flex-wrap:wrap">
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
          <div class="form-row">
            <label>إجابتك</label>
            <textarea id="ansText" rows="4" placeholder="اكتب إجابتك هنا..."
              style="width:100%;border:1px solid #ddd;border-radius:8px;padding:.6rem;">${a.answer || ''}</textarea>
          </div>
          <div class="form-row">
            <label>أرفق ملفًا (اختياري)</label>
            <input type="file" id="ansFile" accept=".pdf,.doc,.mp3,.wav,.m4a,.jpg,.png"/>
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

          await saveAssignmentAnswerToFirestore(
            a.classId,
            a.id,
            current.id,
            {
              answer: text,
              file,
              status: "submitted",
              progress: 50
            }
          );

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

function getTeacherClass(teacherId) {
  const classes = getClasses();
  let c = classes.find(c => c.teacherId === teacherId);
  if (!c) {
    c = { id: uid('C'), teacherId, name: 'فصلي', students: [] };
    classes.push(c);
    setClasses(classes);
  }
  return c;
}

function renderTeacherStudents() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  const c = getTeacherClass(current.id);
  const users = getUsers();

  const rows = $('#studentsRows');
  if (!rows) return;

  rows.innerHTML = '';

  // 🟦 يحول IDs المخزنة إلى مستخدمين فعليين
  const students = c.students
    .map(id => users.find(u => u.id === id))
    .filter(Boolean);

  // 🟥 لا يوجد طلاب
  if (!students.length) {
    rows.innerHTML = `
      <div class="row">
        <div>لا يوجد طلاب بعد.</div>
        <div>—</div>
        <div>${c.name}</div>
        <div>—</div>
      </div>
    `;
    return;
  }

  // 🟩 عرض الطلاب
  students.forEach(student => {
    const r = document.createElement('div');
    r.className = 'row';

    r.innerHTML = `
      <div>${student.name}</div>
      <div>${student.email}</div>
      <div>${student.className || c.name || '—'}</div>

      <div class="actions">
        <button class="btn mini" data-edit="${student.id}">تعديل</button>
        <button class="btn mini ghost" data-del="${student.id}">حذف</button>
      </div>
    `;

    // 🗑 زر حذف الطالب
    r.querySelector('[data-del]').onclick = () => {
      if (confirm(`هل تريد حذف الطالب ${student.name}؟`)) {
        c.students = c.students.filter(x => x !== student.id);

        setClasses([
          ...getClasses().filter(x => x.id !== c.id),
          c
        ]);

        setUsers(users.filter(u => u.id !== student.id));

        renderTeacherStudents();
        renderTeacherView();
        toast('❌ تم حذف الطالب بنجاح');
      }
    };

    // ✏️ زر تعديل الطالب
    r.querySelector('[data-edit]').onclick = () => {
      const modal = document.createElement('div');
      modal.className = 'modal';

      modal.innerHTML = `
        <div class="modal-card" style="max-width:500px">
          <button class="modal-close" id="closeEdit">✖</button>
          <h3>تعديل بيانات الطالب</h3>

          <div class="form-row">
            <label>الاسم الكامل</label>
            <input type="text" id="editName" value="${student.name}">
          </div>

          <div class="form-row">
            <label>البريد الإلكتروني</label>
            <input type="email" id="editEmail" value="${student.email}">
          </div>

          <div class="form-row">
            <label>الصف</label>
            <input type="text" id="editClass" value="${student.className || c.name || ''}" placeholder="مثلاً: الصف السادس">
          </div>

          <div class="form-row">
            <label>كلمة المرور</label>
            <input type="text" id="editPass" value="${student.pass || '123456'}">
          </div>

          <button class="btn primary full" id="saveEdit">حفظ التعديلات ✅</button>
        </div>
      `;

      document.body.appendChild(modal);

      $('#closeEdit').onclick = () => modal.remove();

      $('#saveEdit').onclick = () => {
        const newName = $('#editName').value.trim();
        const newEmail = $('#editEmail').value.trim().toLowerCase();
        const newClass = $('#editClass').value.trim();
        const newPass = $('#editPass').value.trim();

        if (!newName || !newEmail) {
          return toast('يرجى إدخال البيانات كاملة');
        }

        const idx = users.findIndex(u => u.id === student.id);

        if (idx > -1) {
          users[idx] = {
            ...users[idx],
            name: newName,
            email: newEmail,
            pass: newPass,
            className: newClass
          };

          setUsers(users);
          modal.remove();

          toast('✅ تم حفظ التعديلات بنجاح');
          renderTeacherStudents();
        }
      };
    };

    rows.appendChild(r);
  });
}

function openAddStudentModal() {
  $('#sName').value = '';
  $('#sEmail').value = '';
  $('#sPass').value = '123456';
  $('#modalStudent').classList.remove('hidden');
}

async function saveStudent() {
  const name = $('#sName').value.trim();
  const email = $('#sEmail').value.trim().toLowerCase();
  const className = $('#sClass').value.trim();
  const pass = $('#sPass').value.trim() || "123456";

  if (!name || !email || !className) {
    toast("❗ يرجى تعبئة الاسم والبريد والصف");
    return;
  }

  // 1) الحصول على الفصل الخاص بالمعلم
  const current = readJSON(LS.CURRENT, null);
  const classObj = getTeacherClass(current.id);
  const classId = classObj.id;

  // 2) إضافة الطالب إلى users (محليًا)
  let users = getUsers();
  if (!users.some(u => u.email === email)) {
    users.push({
      id: email,
      name,
      email,
      pass,
      role: "student",
      className
    });
    setUsers(users);
  }

  // 3) إضافة الطالب إلى الفصل محليًا
  let classes = getClasses();
  let c = classes.find(x => x.id === classId);

  if (!c.students.includes(email)) {
    c.students.push(email);
    setClasses(classes);
  }

  // 4) حفظ في Firestore (إنترنت فقط)
  try {
    await setDoc(
      doc(db, "classes", classId, "students", email),
      { name, email, className, uid: email }
    );
  } catch (e) {
    console.warn("⚠ لم يتم الحفظ في Firestore (لا يوجد إنترنت)");
  }

  $('#modalStudent').classList.add('hidden');
  toast("✔ تم إضافة الطالب بنجاح");

  // 5) تحديث الواجهة فورًا
  renderTeacherStudents();
  renderTeacherView();
}


function openCreateAssignment() {
  const current = readJSON(LS.CURRENT, null); if (!current) return;
  const c = getTeacherClass(current.id);
  const sel = $('#aLevel'); sel.innerHTML = '';
  LEVELS.forEach(l => {
    const o = document.createElement('option');
    o.value = l.id;
    o.textContent = l.name;
    sel.appendChild(o);
  });
  const box = $('#studentsChecklist'); box.innerHTML = '';
  const users = getUsers();
  c.students.map(id => users.find(u => u.id === id)).filter(Boolean).forEach(st => {
    const idc = uid('CHK');
    const label = document.createElement('label');
    label.innerHTML = `<input type="checkbox" id="${idc}" value="${st.id}"> ${st.name}`;
    box.appendChild(label);
  });
  $('#aTitle').value = '';
  $('#aDue').value = '';
  $('#aDesc').value = '';
  $('#modalAssign').classList.remove('hidden');
}

function saveAssignment() {
  const current = readJSON(LS.CURRENT, null); if (!current) return;
  const title = $('#aTitle').value.trim() || 'واجب جديد';
  const level = $('#aLevel').value;
  const due = $('#aDue').value;
  const desc = $('#aDesc').value.trim();
  const students = [...document.querySelectorAll('#studentsChecklist input[type=checkbox]:checked')].map(i => i.value);
  if (!students.length) { toast('اختر طالبًا واحدًا على الأقل'); return; }
  const a = {
    id: uid('A'), title, level, due, desc,
    teacherId: current.id, classId: getTeacherClass(current.id).id,
    studentIds: students,
    perStudent: students.reduce((acc, id) => (acc[id] = { status: 'required', progress: 0, notes: '' }, acc), {})
  };
  const all = getAssignments(); all.push(a); setAssignments(all);
  $('#modalAssign').classList.add('hidden');
  renderTeacherView();
  toast('تم إنشاء الواجب وإرساله للطلاب المحددين');
}

function renderTeacherView() {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;
  const c = getTeacherClass(current.id);
  const ass = getAssignments().filter(a => a.teacherId === current.id);
  const users = getUsers();

  $('#tc-stu').textContent = c.students.length;
  $('#tc-asg').textContent = ass.length;
  const doneCount = ass.reduce(
    (sum, a) => sum + Object.values(a.perStudent || {}).filter(ps => ps.status === 'done').length,
    0
  );
  $('#tc-done').textContent = doneCount;

  const rows = $('#teacherRows');
  if (rows) rows.innerHTML = '';

  const addedRows = new Set();

  ass.forEach(a => {
    a.studentIds.forEach(sid => {
      const key = `${a.id}-${sid}`;
      if (addedRows.has(key)) return;
      addedRows.add(key);
      const stu = users.find(u => u.id === sid);
      const ps = a.perStudent?.[sid] || { status: 'required', progress: 0, notes: '', answer: '' };

      const r = document.createElement('div');
      r.className = 'row';
      r.innerHTML = `
        <div>${stu?.name || '—'}</div>
        <div>${a.title}</div>
        <div><span class="badge ${
          ps.status === 'done'
            ? 'ok'
            : ps.status === 'overdue'
            ? 'err'
            : 'warn'
        }">${ps.status === 'done' ? 'تم الحل' : ps.status === 'overdue' ? 'متأخر' : 'مطلوب'}</span></div>
        <div><div class="progress"><i style="width:${ps.progress || 0}%"></i></div></div>
        <div>${ps.notes || '—'}</div>
        <div class="actions"><button class="btn mini ghost" data-review="${a.id}:${sid}">👁 مراجعة</button></div>
      `;
      rows.appendChild(r);

      r.querySelector('[data-review]').onclick = () => {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
          <div class="modal-card" style="max-width:600px">
            <button class="modal-close" id="closeReview">✖</button>
            <h3>مراجعة حل الطالب</h3>
            <div class="form-row"><b>الطالب:</b> ${stu?.name || '—'}</div>
            <div class="form-row"><b>عنوان الواجب:</b> ${a.title}</div>
            <div class="form-row"><b>إجابة الطالب:</b>
              <p style="background:#f8fafc;border-radius:10px;padding:.7rem">${
                ps.answer || '— لم يُرسل إجابة —'
              }</p>
            </div>
            ${
              ps.file
                ? `<div class="form-row"><b>الملف المرفق:</b>
                     <a href="${ps.file}" target="_blank" class="btn sky small">فتح الملف</a></div>`
                : ''
            }
            <div class="form-row"><label>ملاحظة للطالب (اختياري)</label>
              <textarea id="teacherNote" rows="3" placeholder="أضف ملاحظة...">${ps.notes || ''}</textarea>
            </div>
            <div class="row" style="display:flex;gap:.5rem;justify-content:flex-end">
              <button id="rejectAns" class="btn warn small">رفض ❌</button>
              <button id="approveAns" class="btn primary small">قبول ✅</button>
            </div>
          </div>
        `;
        document.body.appendChild(modal);

        $('#closeReview').onclick = () => modal.remove();

        $('#approveAns').onclick = () => {
          const note = $('#teacherNote').value.trim();
          a.perStudent[sid] = { ...ps, notes: note, status: 'done', progress: 100 };
          setAssignments(ass);
          modal.remove();
          toast('✅ تم قبول الحل');
          renderTeacherView();
        };

        $('#rejectAns').onclick = () => {
          const note = $('#teacherNote').value.trim() || 'يُرجى مراجعة الإجابة';
          a.perStudent[sid] = { ...ps, notes: note, status: 'required', progress: 0 };
          setAssignments(ass);
          modal.remove();
          toast('❌ تم رفض الحل');
          renderTeacherView();
        };
      };
    });
  });

  const ctx = $('#chartTeacher');
  if (ctx) {
    const labels = ass.map(a => a.title);
    const values = ass.map(a => {
      const st = Object.values(a.perStudent || {});
      if (!st.length) return 0;
      return Math.round(st.reduce((s, x) => s + (x.progress || 0), 0) / st.length);
    });
    if (window._cht) window._cht.destroy();
    window._cht = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'متوسط التقدّم %', data: values }] },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
      },
    });
  }

  const host = $('#teacherAssignList');
  if (host) host.innerHTML = '';
  ass.forEach(a => {
    const el = document.createElement('div');
    el.className = 'assign-card';
    const avg = (() => {
      const st = Object.values(a.perStudent || {});
      if (!st.length) return 0;
      return Math.round(st.reduce((s, x) => s + (x.progress || 0), 0) / st.length);
    })();
    el.innerHTML = `<h4>${a.title}</h4>
      <div class="meta"><span>${a.level}</span><span>${a.due || '-'}</span></div>
      <div class="progress"><i style="width:${avg}%"></i></div>`;
    host?.appendChild(el);
  });

  if ($('#studentsRows')) renderTeacherStudents();
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
  $('#appShell').classList.add('hidden');
  $('#readerView').classList.remove('hidden');
  $('#storyTitle').textContent = book.title;
  $('#storyLevel').textContent = 'المستوى ' + book.level.replace('L', '');
  $('#storyCover').src = book.cover;
  const host = $('#storyContent'); host.innerHTML = '';
  book.text.forEach(p => {
    const para = document.createElement('p');
    para.innerHTML = p.split(' ').map(w => `<span>${w}</span>`).join(' ');
    host.appendChild(para);
  });
  host.querySelectorAll('span').forEach(sp => sp.onclick = () => sp.classList.toggle('highlighted'));
  $('#recordTime').textContent = '⏱️ 00:00';
  $('#playRec').classList.add('hidden');
  $('#stopRec').classList.add('hidden');
  $('#startRec').classList.remove('hidden');

  updateReadStats(book.id);
}

function backToApp() {
  $('#readerView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
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

// تحديث بيانات القراء
function updateReadStats(bookId) {
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  const key = LS.STATS(current.id);
  const s = readJSON(key, { reads: 0, minutes: 0, lastBook: '—', activities: 0 });

  s.reads += 1;
  s.lastBook = BOOKS.find(b => b.id === bookId)?.title || '—';

  writeJSON(key, s);
  updateRail();
}

// حفظ قصة جديدة
async function saveBook() {
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
  const classObj = getTeacherClass(current.id);
  const classId = classObj.id;

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
  renderBooks("ALL");
  toast("✓ تمت إضافة القصة (سحابة + محلي) 🎉");
}

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

  const book = BOOKS.find(b => b.id === bookId);
  if (!book) {
    toast("❌ لم يتم العثور على القصة");
    return;
  }

  if (!book.quiz) book.quiz = [];
  book.quiz.push({ q: question, options, correct });

  const current = readJSON(LS.CURRENT, null);
  if (current && current.classId && window.db) {
    await saveQuizToFirestore(current.classId, book.id, {
      q: question,
      options,
      correct
    });
  }

  $('#modalQuizEditor').classList.add('hidden');
  toast("✓ تمت إضافة السؤال بنجاح");
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
//  يقوم بتحويل معرّفات الطلاب القديمة إلى البريد
// ===============================================

function autoFixAssignments() {
  let assigns = JSON.parse(localStorage.getItem("arp.assignments") || "[]");
  const current = JSON.parse(localStorage.getItem("arp.current") || "{}");

  if (!current || !current.email) return;  // لا يوجد مستخدم مسجل

  const studentEmail = current.email;

  let changed = false;

  assigns = assigns.map(a => {
    // 1) إذا الواجب ليس موجّهًا للطالب، لا نلمسه
    if (!a.studentIds) return a;

    // 2) إذا الواجب يحتوي على معرّف قديم غير البريد
    if (a.studentIds.includes(studentEmail)) return a;

    // 3) تحويل إلى البريد الصحيح
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

// ------------------------------------------------------
// Boot
// ------------------------------------------------------

function startApp() {
  const current = readJSON(LS.CURRENT, null);

  // ⬅️ هنا توضع autoFixAssignments() ولا مشكلة
  autoFixAssignments();

  if (current && current.role === 'teacher') {
    $$('.only-teacher').forEach(btn => btn.style.display = 'inline-block');
  } else {
    $$('.only-teacher').forEach(btn => btn.style.display = 'none');
  }

  if (!current) {
    $('#authView').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    $('#readerView').classList.add('hidden');
    return;
  }

  $('#helloName').textContent = 'مرحبًا ' + current.name + '!';
  $('#userName').textContent = current.name;
  $('#userRoleLabel').textContent = current.role === 'teacher' ? 'معلم' : 'طالب';
  $('#authView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#readerView').classList.add('hidden');

  // 🔥 تحميل الواجبات + إجابات الطالب من Firestore
  if (current.role === "student") {
    const classId = current.classId;

    await syncAssignmentsFromFirestore(classId);
    await loadStudentAnswersFromFirestore(classId, current.id);
  }

  buildNav(current.role);
  renderLevels();
  renderBooks('ALL');
  renderStudentAssignments('required');
  renderTeacherView();
  updateReports();
  updateRail();
}

// أحداث عامة
document.addEventListener('click', (e) => {
  const go = e.target.closest('.go');
  if (go) { showOnly(go.dataset.go); }
  const closeId = e.target.dataset?.close;
  if (closeId) { document.getElementById(closeId).classList.add('hidden'); }
});

document.addEventListener('DOMContentLoaded', () => {
  // تبويب auth
  $$('[data-auth]').forEach(btn => btn.onclick = () => {
    $$('[data-auth]').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (btn.dataset.auth === 'login') {
      $('#loginForm').classList.remove('hidden');
      $('#regForm').classList.add('hidden');
    } else {
      $('#regForm').classList.remove('hidden');
      $('#loginForm').classList.add('hidden');
    }
  });

  $('#loginForm').addEventListener('submit', loginUser);
  $('#regForm').addEventListener('submit', registerUser);

  $('#searchBooks')?.addEventListener('input', () => renderBooks('ALL'));

  $$('#tab-assign .pill').forEach(p => p.onclick = () => {
    $$('#tab-assign .pill').forEach(x => x.classList.remove('active'));
    p.classList.add('active');
    renderStudentAssignments(p.dataset.filter);
  });

  document.addEventListener('click', (e) => {
    if (e.target.id === 'addStudentBtn') { openAddStudentModal(); }
    if (e.target.id === 'saveStudent') { saveStudent(); }
    if (e.target.id === 'newAssignBtn') { openCreateAssignment(); }
    if (e.target.id === 'saveAssign') { saveAssignment(); }
    if (e.target.id === 'saveBook') { saveBook(); }

    if (e.target.id === "addBookBtn") {
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

  // قارئ
  $('#backToApp').addEventListener('click', backToApp);
  $('#startRec').addEventListener('click', startRecording);
  $('#stopRec').addEventListener('click', stopRecording);
  $('#playRec').addEventListener('click', playRecording);

  $('#closeQuiz')?.addEventListener('click', () => {
    $('#modalQuiz').classList.add('hidden');
  });

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
    renderAvgProgressChart();

    $('#modalQuiz').classList.add('hidden');
    toast("✓ تم إنهاء النشاط. نتيجتك: " + score + "/" + currentBook.quiz.length);
  });

  // ربط زر الخروج بنافذة التأكيد
  $('#logoutBtn')?.addEventListener('click', confirmLogout);

  // تشغيل التطبيق
  startApp();
});

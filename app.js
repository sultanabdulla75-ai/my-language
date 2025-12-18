// ------------------------------------------------------
// منصة لغتي - ملف app.js
// ------------------------------------------------------

// ===== متغير عام للقصة الحالية في القارئ =====
let currentBook = null;
// وقت بدء القراءة الحالي (بالمللي ثانية)
let readingStartAt = null;
let readingStartTime = null;
let hasInteractedWithStory = false;

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

// ===== Storage keys =====
const LS = {
  USERS: 'arp.users',
  CURRENT: 'arp.current',
  ROLE: 'arp.role',
  CLASSES: 'arp.classes',
  ASSIGN: 'arp.assignments',
  // =====STATS: uid => arp.stats.${uid} =====
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
      { q: "أين التقى سالم وراشد؟", options: ["في السوق", "في الحديقة", "في المدرسة"], correct: 1 },
      { q: "ماذا وعد الصديقان؟", options: ["ألا يتكلما", "أن يساعد كل واحد الآخر", "أن يذهبا للبيت"], correct: 1 }
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
      { q: "كيف وصف الكاتب السماء؟", options: ["غائمة", "صافية", "ماطرة"], correct: 1 },
      { q: "ماذا يجد القارئ في الكتب؟", options: ["الملل", "المتعة", "الحيرة"], correct: 1 }
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
      { q: "لماذا اجتمع الأطفال حول الجد؟", options: ["للعب", "ليستمعوا للحكايات", "للذهاب إلى المدرسة"], correct: 1 }
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
    localStorage.removeItem(k);
    return def;
  }
};

const writeJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));
const uid = (p = 'U') => p + Math.random().toString(36).slice(2, 8);

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
// 🔔 إنشاء إشعار
// ============================================
async function createNotification({ studentId, title, message, icon = "🔔", type = "", refId = "" }) {
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

function toast(msg) {
  alert(msg);
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
      await setDoc(
        doc(window.db, "classes", classId, "books", b.id),
        b
      );
      console.log("⬆️ رفع قصة جديدة:", b.title);
    }
  }

  console.log("🔄 تمت المزامنة بنجاح");
}

// 🔹 حفظ حل الطالب في Firestore
async function saveAssignmentAnswerToFirestore(classId, assignId, studentId, answerData) {
  if (!window.db) return;

  try {
    const ansRef = doc(
      window.db,
      "classes",
      classId,
      "assignments",
      assignId,
      "answers",
      studentId
    );

    await setDoc(ansRef, answerData, { merge: true });

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

  const snap = await getDocs(
    collection(window.db, "classes", classId, "books")
  );

  const arr = [];
  snap.forEach(d => arr.push(d.data()));

  if (arr.length === 0) {
    console.warn("⚠ لا توجد قصص في السحابة. سيتم استخدام القصص المحلية.");
    return BOOKS;
  }

  return arr;
}

// 🔹 استبدال محتوى BOOKS بقصص السحابة
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
      window.db,
      "classes",
      classId,
      "assignments",
      assignId,
      "answers",
      studentId
    );

    const ansSnap = await getDoc(ansRef);

    if (ansSnap.exists()) {
      const data = ansSnap.data();
      let idx = localAssignments.findIndex(x => x.id === assignId);

      if (idx !== -1) {
        localAssignments[idx].perStudent =
          localAssignments[idx].perStudent || {};

        localAssignments[idx].perStudent[studentId] = {
          ...localAssignments[idx].perStudent[studentId],
          ...data
        };
      }
    }
  }

  setAssignments(localAssignments);
}

// 🔥 مزامنة الواجبات من Firestore
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
    renderTeacherDashboard();
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

  if (current.role === 'teacher') {
    renderTeacherDashboard();
    $('#railBooks').textContent = 0;
    $('#railTime').textContent = '0 د';
    $('#railBadges').textContent = 0;
    $('#railAvg').textContent = '0 د';
    $('#railLastBook').textContent = '—';
    $('#railActs').textContent = 0;
  }
}

function updateRailFromStats(s) {
  $('#railBooks').textContent = s.reads || 0;
  $('#railTime').textContent = (s.minutes || 0) + " د";
  $('#railLastBook').textContent = s.lastBook || "—";
  $('#railActs').textContent = s.activities || 0;

  const avg = s.reads > 0 ? (s.minutes / s.reads).toFixed(1) : 0;
  $('#railAvg').textContent = avg + " د";
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
  if (users.some(u => u.email === email)) {
    $('#regMsg').textContent = 'البريد مستخدم بالفعل.';
    return;
  }

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
  $('#regForm').classList.add('hidden');
  $('#loginForm').classList.remove('hidden');
}

function loginUser(e) {
  e.preventDefault();

  const email = $('#loginEmail').value.trim().toLowerCase();
  const pass = $('#loginPass').value;

  const users = readJSON(LS.USERS, []);
  const user = users.find(u => u.email === email && u.pass === pass);

  if (!user) {
    $('#loginMsg').textContent = 'بيانات الدخول غير صحيحة.';
    return;
  }

  writeJSON(LS.CURRENT, {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  });

  startApp();
}

function logoutUser() {
  localStorage.removeItem(LS.CURRENT);
  $('#authView').classList.remove('hidden');
  $('#appShell').classList.add('hidden');
  $('#readerView').classList.add('hidden');
  $('#navLinks').innerHTML = '';
}

function confirmLogout() {
  if (!confirm("هل تريد تسجيل الخروج؟")) return;
  logoutUser();
}

// ------------------------------------------------------
// Student: المستويات + المكتبة + الواجبات
// ------------------------------------------------------

function renderLevels() {
  const w = $('#levelsGrid');
  if (!w) return;
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

  g.innerHTML = '⏳ جاري تحميل القصص...';

  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  let classId = current.classId || null;
  if (!classId) {
    g.innerHTML = "🚫 لا يوجد فصل مرتبط بك";
    return;
  }

  const books = await loadBooksFromFirestore(classId);
  const q = $('#searchBooks')?.value.trim() || '';

  const filtered = books.filter(b =>
    (level === 'ALL' || b.level === level) &&
    (!q || b.title.includes(q))
  );

  g.innerHTML = '';
  filtered.forEach(b => {
    const c = document.createElement('div');
    c.className = 'book-card';
    c.innerHTML = `
      <img src="${b.cover}">
      <h4>${b.title}</h4>
      <div class="badge ok">${b.level}</div>
    `;
    c.onclick = () => openReader(b);
    g.appendChild(c);
  });
}

// ------------------------------------------------------
// Teacher: إدارة الطلاب والواجبات
// ------------------------------------------------------

function getTeacherClass(teacherId) {
  const current = readJSON(LS.CURRENT, null);
  const classes = getClasses();
  let c = null;

  if (current && current.classId) {
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

async function renderTeacherStudents() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== 'teacher') return;

  const rows = $('#studentsRows');
  if (!rows) return;

  rows.innerHTML = '⏳ جاري تحميل الطلاب...';

  const classId = current.classId;
  if (!classId || !window.db) return;

  const snap = await getDocs(
    collection(window.db, "classes", classId, "students")
  );

  rows.innerHTML = '';
  if (snap.empty) {
    rows.innerHTML = '<div class="row">لا يوجد طلاب بعد.</div>';
    return;
  }

  snap.forEach(d => {
    const st = d.data();
    const r = document.createElement('div');
    r.className = 'row';
    r.innerHTML = `
      <div>${st.name || st.email}</div>
      <div>${st.email}</div>
      <div>${st.className || '—'}</div>
    `;
    rows.appendChild(r);
  });
}

async function renderTeacherView() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== 'teacher') return;

  const classId = current.classId;
  if (!classId || !window.db) return;

  const rows = $('#teacherRows');
  if (!rows) return;

  rows.innerHTML = '⏳ جاري التحميل...';

  const assSnap = await getDocs(
    collection(window.db, "classes", classId, "assignments")
  );

  rows.innerHTML = '';
  assSnap.forEach(docSnap => {
    const a = docSnap.data();
    const r = document.createElement('div');
    r.className = 'row';
    r.innerHTML = `
      <div>${a.title}</div>
      <div>${a.level}</div>
      <div>${a.due || '—'}</div>
    `;
    rows.appendChild(r);
  });
}

// ------------------------------------------------------
// Reader
// ------------------------------------------------------

function openReader(book) {
  currentBook = book;
  readingStartAt = Date.now();
  hasInteractedWithStory = false;

  $('#appShell').classList.add('hidden');
  $('#readerView').classList.remove('hidden');

  const host = document.getElementById("storyContent");
  if (!host) return;

  host.innerHTML = '';
  book.text.forEach(p => {
    const para = document.createElement("p");
    para.innerHTML = p.split(' ')
      .map(w => `<span class="word">${w}</span>`)
      .join(' ');

    para.querySelectorAll('.word').forEach(span => {
      span.onclick = () => {
        span.classList.toggle('word-selected');
        hasInteractedWithStory = true;
      };
    });

    host.appendChild(para);
  });
}

function backToApp() {
  $('#readerView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');

  if (readingStartAt && currentBook) {
    const seconds = Math.round((Date.now() - readingStartAt) / 1000);
    if (hasInteractedWithStory && seconds >= 30) {
      updateReadStats(currentBook.id, Math.max(1, Math.round(seconds / 60)));
    }
  }

  readingStartAt = null;
  hasInteractedWithStory = false;
}

window.openReader = openReader;

// ------------------------------------------------------
// تسجيل الصوت
// ------------------------------------------------------

let mediaRecorder, chunks = [], timerInt, startTime, audioBlob = null;

async function startRecording() {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  mediaRecorder = new MediaRecorder(stream);
  chunks = [];

  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    audioBlob = new Blob(chunks, { type: 'audio/ogg' });
    $('#playRec').classList.remove('hidden');
  };

  mediaRecorder.start();
  startTime = Date.now();
}

function stopRecording() {
  if (mediaRecorder) mediaRecorder.stop();
  clearInterval(timerInt);
}

function playRecording() {
  if (!audioBlob) return;
  new Audio(URL.createObjectURL(audioBlob)).play();
}

// ------------------------------------------------------
// Notifications
// ------------------------------------------------------

function listenToNotifications() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || !window.db) return;

  const qy = query(
    collection(window.db, "notifications"),
    where("studentId", "==", current.email)
  );

  onSnapshot(qy, snap => {
    const list = $('#notifyList');
    const count = $('#notifyCount');
    if (!list || !count) return;

    list.innerHTML = '';
    let unread = 0;

    snap.forEach(docSnap => {
      const n = docSnap.data();
      if (!n.isRead) unread++;

      const item = document.createElement('div');
      item.className = 'notify-item' + (!n.isRead ? ' unread' : '');
      item.innerHTML = `<b>${n.title}</b><div>${n.message}</div>`;
      list.appendChild(item);
    });

    count.textContent = unread;
    count.classList.toggle('hidden', unread === 0);
  });
}

async function markNotificationsAsRead() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || !window.db) return;

  const qy = query(
    collection(window.db, "notifications"),
    where("studentId", "==", current.email),
    where("isRead", "==", false)
  );

  const snap = await getDocs(qy);
  snap.forEach(d =>
    updateDoc(doc(window.db, "notifications", d.id), {
      isRead: true,
      readAt: Date.now()
    })
  );
}
// ------------------------------------------------------
// Boot
// ------------------------------------------------------

async function startApp() {
  let current = readJSON(LS.CURRENT, null);
  if (!current || !current.email) {
    $('#authView').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    return;
  }

  $('#helloName').textContent = 'مرحبًا ' + current.name;
  setUnifiedAvatar(current.role);

  $('#authView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#readerView').classList.add('hidden');

  buildNav(current.role);
  renderLevels();
  renderBooks('ALL');
  renderStudentAssignments('required');

  if (current.role === 'teacher') {
    await renderTeacherStudents();
    await renderTeacherView();
  }

  listenToNotifications();
}

window.startApp = startApp;

// أحداث عامة
document.addEventListener('DOMContentLoaded', () => {
  $('#loginForm')?.addEventListener('submit', loginUser);
  $('#regForm')?.addEventListener('submit', registerUser);

  $('#logoutBtn')?.addEventListener('click', confirmLogout);
  $('#backToApp')?.addEventListener('click', backToApp);

  startApp();
});

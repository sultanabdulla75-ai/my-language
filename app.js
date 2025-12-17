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

function toast(msg) {
  alert(msg);
}

// ------------------------------------------------------
// Firestore Helpers (كتب + واجبات + طلاب)
// ------------------------------------------------------

// 📌 تحميل الطلاب من Firestore للصف الخاص بالمعلم
export async function getTeacherStudents(classId) {
  const students = [];
  const stuSnap = await getDocs(
    collection(window.db, "classes", classId, "students")
  );

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

  if (current.role === "student") {
    BOOKS.length = 0;
    cloudBooks.forEach(b => BOOKS.push(b));
    console.log("📥 الطالب حمّل القصص:", BOOKS.length);
    return;
  }

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

// 🔹 إيجاد classId للطالب من Firestore
async function findClassIdForStudent(studentEmail) {
  if (!window.db || !studentEmail) return null;

  try {
    const classesSnap = await getDocs(
      collection(window.db, "classes")
    );

    for (const c of classesSnap.docs) {
      const stuRef = doc(
        window.db,
        "classes",
        c.id,
        "students",
        studentEmail
      );
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

  g.innerHTML = '<div style="padding:10px">⏳ جاري تحميل القصص...</div>';
  const current = readJSON(LS.CURRENT, null);
  if (!current) return;

  let classId = current.classId || null;
  if (!classId) {
    g.innerHTML = "<p>🚫 لا يوجد فصل مرتبط بك</p>";
    return;
  }

  const books = BOOKS;
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
    c.onclick = () => window.openReader(b);
    g.appendChild(c);
  });
}

// ------------------------------------------------------
// Teacher: إدارة الطلاب
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
  if (!classId || !window.db) {
    rows.innerHTML = '<div class="row"><div>لا يوجد صف مرتبط.</div></div>';
    return;
  }

  try {
    const stuSnap = await getDocs(
      collection(window.db, "classes", classId, "students")
    );

    rows.innerHTML = '';
    if (stuSnap.empty) {
      rows.innerHTML = '<div class="row"><div>لا يوجد طلاب بعد.</div></div>';
      return;
    }

    stuSnap.forEach(d => {
      const st = d.data();
      const r = document.createElement('div');
      r.className = 'row';
      r.innerHTML = `
        <div>${st.name || st.email}</div>
        <div>${st.email}</div>
        <div>${st.className || '—'}</div>
        <div class="actions">
          <button class="btn mini ghost" data-del="${st.email}">حذف</button>
        </div>
      `;
      rows.appendChild(r);
    });
  } catch (e) {
    rows.innerHTML = '<div class="row"><div>⚠ خطأ في تحميل الطلاب</div></div>';
  }
}

// ------------------------------------------------------
// Boot
// ------------------------------------------------------
async function startApp() {
  let current = JSON.parse(localStorage.getItem("arp.current") || "null");
  console.log("DEBUG CURRENT =", current);

  if (!current || !current.email) {
    localStorage.removeItem("arp.current");
    $('#authView').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    return;
  }

  if (current.role === 'teacher') {
    $$('.only-teacher').forEach(btn => btn.style.display = 'inline-block');
  } else {
    $$('.only-teacher').forEach(btn => btn.style.display = 'none');
  }

  $('#helloName').textContent = 'مرحبًا ' + current.name + '!';
  $('#userName').textContent = current.name;
  $('#userRoleLabel').textContent = current.role === 'teacher' ? 'معلم' : 'طالب';

  setUnifiedAvatar(current.role);

  $('#authView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#readerView').classList.add('hidden');

  buildNav(current.role);
  renderLevels();
  renderBooks('ALL');

  if (current.role === 'teacher') {
    await renderTeacherStudents();
  }
}

// ⭐ مهم: إتاحة startApp عالميًا
window.startApp = startApp;

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
  if (host) {
    host.innerHTML = "";
    book.text.forEach(p => {
      const para = document.createElement("p");
      para.innerHTML = p.split(' ')
        .map(word => `<span class="word">${word}</span>`)
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
}

window.openReader = openReader;

function backToApp() {
  $('#readerView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  readingStartAt = null;
  hasInteractedWithStory = false;
}

// ------------------------------------------------------
// Notifications
// ------------------------------------------------------
function listenToNotifications() {
  const current = JSON.parse(localStorage.getItem("arp.current") || "null");
  if (!current || !current.email || !window.db) return;

  const q = query(
    collection(window.db, "notifications"),
    where("studentId", "==", current.email)
  );

  onSnapshot(q, snap => {
    const list = document.getElementById("notifyList");
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
      if (!n.isRead) unread++;

      const item = document.createElement("div");
      item.className = "notify-item" + (!n.isRead ? " unread" : "");
      item.innerHTML = `
        <div><strong>${n.icon || "🔔"} ${n.title}</strong></div>
        <div>${n.message}</div>
      `;
      list.appendChild(item);
    });

    count.textContent = unread;
    count.classList.toggle("hidden", unread === 0);
  });
}

// ------------------------------------------------------
// DOM Ready
// ------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {

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

  $('#loginForm')?.addEventListener('submit', loginUser);
  $('#regForm')?.addEventListener('submit', registerUser);
  $('#searchBooks')?.addEventListener('input', () => renderBooks('ALL'));

  $('#backToApp')?.addEventListener('click', backToApp);

  document.getElementById("notifyBtn")?.addEventListener("click", e => {
    e.stopPropagation();
    document.getElementById("notifyPanel")?.classList.toggle("hidden");
  });

  document.addEventListener("click", () => {
    document.getElementById("notifyPanel")?.classList.add("hidden");
  });

  startApp();
});

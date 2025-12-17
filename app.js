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
  // =====STATS: uid => `arp.stats.${uid}` =====
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
    // إذا كانت القيمة تالفة نمسحها حتى لا تكرّر الخطأ
    localStorage.removeItem(k);
    return def;
  }
};

const writeJSON = (k, v) =>
  localStorage.setItem(k, JSON.stringify(v));

const uid = (p = 'U') =>
  p + Math.random().toString(36).slice(2, 8);

// ===== Avatar (موحّد) =====
function setUnifiedAvatar(role) {
  const avatar = document.getElementById("userAvatar");
  if (!avatar) return;

  avatar.onerror = () => {
    avatar.src = "./img/avatar-student-omani.png";
  };

  avatar.src =
    role === "teacher"
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
      await setDoc(
        doc(window.db, "classes", classId, "books", b.id),
        b
      );

      console.log("⬆️ رفع قصة جديدة:", b.title);
    }
  }

  console.log("🔄 تمت المزامنة بنجاح");
}

// 🔹 حفظ حل الطالب في Firestore (answers + perStudent في assignment)
async function saveAssignmentAnswerToFirestore(
  classId,
  assignId,
  studentId,
  answerData
) {
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

    // تحديث الحقل في وثيقة الواجب نفسها (perStudent)
    const assignRef = doc(
      window.db,
      "classes",
      classId,
      "assignments",
      assignId
    );

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

// 🔹 استبدال محتوى BOOKS بقصص السحابة عند الحاجة
async function syncBooksWithFirestore(classId) {
  const books = await loadBooksFromFirestore(classId);

  if (books && books.length > 0) {
    BOOKS.length = 0;
    books.forEach(b => BOOKS.push(b));
  }
}

// 🔹 تحميل إجابات الطالب من Firestore ودمجها في الواجبات المحلية
export async function loadStudentAnswersFromFirestore(
  classId,
  studentId
) {
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

      let idx = localAssignments.findIndex(
        x => x.id === assignId
      );

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


// ===============================
// مزامنة الواجبات من Firestore إلى الذاكرة المحلية
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

// 🔹 إيجاد classId للطالب من Firestore
async function findClassIdForStudent(studentEmail) {
  if (!window.db || !studentEmail) return null;

  try {
    const classesSnap = await getDocs(collection(window.db, "classes"));

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

  const items =
    role === 'teacher'
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
  $('#railBooks') && ($('#railBooks').textContent = s.reads || 0);
  $('#railTime') && ($('#railTime').textContent = (s.minutes || 0) + " د");
  $('#railLastBook') && ($('#railLastBook').textContent = s.lastBook || "—");
  $('#railActs') && ($('#railActs').textContent = s.activities || 0);

  const avgBox = document.getElementById("railAvg");
  if (avgBox) {
    const avg = s.reads > 0 ? (s.minutes / s.reads).toFixed(1) : 0;
    avgBox.textContent = avg + " د";
  }
}

function renderStaticNoorBadges() {
  const el = document.getElementById("railBadges");
  if (!el) return;

  const raw = el.textContent.trim();
  const count = parseInt(raw, 10) || 0;

  el.innerHTML = `
    <div class="noor-badge gold" title="إنجاز عالٍ">
      <span class="icon">🏅</span>
      <small>${Math.floor(count / 4)}</small>
    </div>
    <div class="noor-badge silver" title="إنجاز متوسط">
      <span class="icon">🏅</span>
      <small>${Math.floor(count / 2)}</small>
    </div>
    <div class="noor-badge bronze" title="بداية مميزة">
      <span class="icon">🏅</span>
      <small>${count}</small>
    </div>
  `;
}

async function addActivity() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || !window.db) return;

  const ref = doc(window.db, "readingStats", current.email);
  const snap = await getDoc(ref);
  const s = snap.exists() ? snap.data() : { activities: 0 };

  await setDoc(
    ref,
    {
      activities: (s.activities || 0) + 1,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}


// --------------------
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
      c = {
        id: current.classId,
        teacherId,
        name: 'فصلي',
        students: []
      };
      classes.push(c);
      setClasses(classes);
    }
  } else {
    c = classes.find(x => x.teacherId === teacherId);
    if (!c) {
      c = {
        id: uid('C'),
        teacherId,
        name: 'فصلي',
        students: []
      };
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

  const classId = current.classId;
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
    rows.innerHTML = `
      <div class="row">
        <div>⚠ لا يوجد اتصال بقاعدة البيانات.</div>
      </div>
    `;
    return;
  }

  try {
    const stuSnap = await getDocs(
      collection(window.db, "classes", classId, "students")
    );

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
        <div>${className}</div>
        <div class="actions">
          <button class="btn mini" data-edit="${email}">تعديل</button>
          <button class="btn mini ghost" data-del="${email}">حذف</button>
        </div>
      `;

      // 🗑 حذف الطالب من Firestore
      r.querySelector('[data-del]').onclick = async () => {
        if (!confirm(`هل تريد حذف الطالب ${name}؟`)) return;

        try {
          await deleteDoc(
            doc(window.db, "classes", classId, "students", email)
          );
          toast('❌ تم حذف الطالب بنجاح');
          renderTeacherStudents();
        } catch (e) {
          console.error(e);
          toast('⚠ حدث خطأ أثناء الحذف');
        }
      };

      // ✏️ تعديل بيانات الطالب
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
              <input
                type="text"
                id="editClass"
                value="${className === '—' ? '' : className}"
                placeholder="مثلاً: الصف السادس"
              >
            </div>

            <button class="btn primary full" id="saveEdit">
              حفظ التعديلات ✅
            </button>
          </div>
        `;

        document.body.appendChild(modal);

        $('#closeEdit').onclick = () => modal.remove();

        $('#saveEdit').onclick = async () => {
          const newName = $('#editName').value.trim();
          const newClass = $('#editClass').value.trim();

          if (!newName) return toast('يرجى إدخال الاسم');

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
  } catch (e) {
    console.error(e);
    rows.innerHTML = `
      <div class="row">
        <div>⚠ خطأ في تحميل الطلاب</div>
      </div>
    `;
  }
}


//----------------------------------------------
// Reports
// ------------------------------------------------------
function updateReportsFromStats(s) {
  const percent = Math.min(
    100,
    Math.floor((s.reads / BOOKS.length) * 100)
  );

  $('#repPercent').textContent = percent + '%';
  $('#repReads').textContent = s.reads || 0;
  $('#repTime').textContent = (s.minutes || 0) + ' دقيقة';
}

function updateReportsChart(s) {
  const ctx = $('#chartReads');
  if (!ctx) return;

  if (window._cr) window._cr.destroy();

  window._cr = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: BOOKS.map(b => b.title),
      datasets: [
        {
          label: 'القراءات',
          data: BOOKS.map((_, i) =>
            i < (s.reads || 0) ? 1 : 0
          )
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            maxTicksLimit: 4
          }
        }
      }
    }
  });
}

// ------------------------------------------------------
// Reader + تسجيل الصوت + تحديث الإحصاءات
// ------------------------------------------------------
let mediaRecorder,
  chunks = [],
  timerInt,
  startTime,
  audioBlob = null;

function openReader(book) {
  currentBook = book;

  // تسجيل وقت بدء القراءة
  readingStartAt = Date.now();
  hasInteractedWithStory = false;

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
      para.innerHTML = p
        .split(' ')
        .map(word => `<span class="word">${word}</span>`)
        .join(' ');

      // تفعيل التظليل عند الضغط
      para.querySelectorAll('.word').forEach(span => {
        span.onclick = () => {
          span.classList.toggle('word-selected');
          hasInteractedWithStory = true;
        };
      });

      host.appendChild(para);
    });
  }

  // ===============================
  // تهيئة عناصر التسجيل
  // ===============================
  $('#recordTime').textContent = '⏱️ 00:00';
  $('#playRec').classList.add('hidden');
  $('#stopRec').classList.add('hidden');
  $('#startRec').classList.remove('hidden');
}

window.openReader = openReader;

function backToApp() {
  $('#readerView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');

  if (readingStartAt && currentBook) {
    const diffMs = Date.now() - readingStartAt;
    const secondsSpent = Math.round(diffMs / 1000);
    const MIN_SECONDS = 30;

    if (hasInteractedWithStory && secondsSpent >= MIN_SECONDS) {
      const minutesSpent = Math.max(
        1,
        Math.round(secondsSpent / 60)
      );
      updateReadStats(currentBook.id, minutesSpent);
    } else {
      console.log("⏭️ قراءة لم تُحتسب");
    }
  }

  readingStartAt = null;
  hasInteractedWithStory = false;
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true
    });
    mediaRecorder = new MediaRecorder(stream);
  } catch (e) {
    alert('المتصفح منع الميكروفون. فعّل الأذونات.');
    return;
  }

  chunks = [];
  audioBlob = null;

  mediaRecorder.ondataavailable = e => chunks.push(e.data);
  mediaRecorder.onstop = () => {
    audioBlob = new Blob(chunks, {
      type: 'audio/ogg;codecs=opus'
    });
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
  if (mediaRecorder) {
    mediaRecorder.stop();
  }

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
  if (!current || current.role !== 'student' || !window.db) return;

  const ref = doc(window.db, "readingStats", current.email);
  const snap = await getDoc(ref);

  const prev = snap.exists()
    ? snap.data()
    : {
        reads: 0,
        minutes: 0,
        lastBook: '—',
        activities: 0
      };

  const bookTitle =
    BOOKS.find(b => b.id === bookId)?.title || prev.lastBook;

  // 🔴 🔴 🔴 أضِف الشرط هنا بالضبط
  if (
    prev.lastBook === bookTitle &&
    prev.updatedAt &&
    Date.now() - prev.updatedAt < 5 * 60 * 1000
  ) {
    console.log("⏭️ تجاهل قراءة مكررة خلال 5 دقائق");
    return;
  }

  await setDoc(
    ref,
    {
      reads: prev.reads + 1,
      minutes: prev.minutes + minutesSpent,
      lastBook: bookTitle,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

// حفظ قصة جديدة — Firestore + تحديث المكتبة
async function saveBook() {
  const title = $('#bTitle').value.trim();
  const level = $('#bLevel').value;
  let cover = $('#bCover').value.trim();
  const textRaw = $('#bText').value.trim();

  if (!title || !level || !textRaw) {
    toast("❗ يرجى تعبئة العنوان والمستوى والنص");
    return;
  }

  const text = textRaw
    .split('\n')
    .map(t => t.trim())
    .filter(t => t);

  const upload = $('#bFile')?.files?.[0];
  if (upload) cover = URL.createObjectURL(upload);

  if (!cover) {
    cover = `https://picsum.photos/seed/${encodeURIComponent(
      title
    )}/400/550`;
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

  const classId =
    current.classId || getTeacherClass(current.id)?.id;

  if (!classId) {
    toast("⚠ لا يوجد فصل مرتبط بالمعلم!");
    return;
  }

  const id = uid("B");
  const bookData = { id, title, level, cover, text, quiz: [] };

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

  const options = optionsRaw
    .split('\n')
    .map(t => t.trim())
    .filter(t => t);

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
      <p style="margin:10px 0;color:#555">
        بعد الإرسال لن تتمكن من تعديل إجابتك.
      </p>
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
// 🛠 إصلاح تلقائي للواجبات لتعمل في كل المتصفحات
// ===============================================
function autoFixAssignments() {
  let assigns = JSON.parse(
    localStorage.getItem("arp.assignments") || "[]"
  );

  const current = JSON.parse(
    localStorage.getItem("arp.current") || "{}"
  );

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
    localStorage.setItem(
      "arp.assignments",
      JSON.stringify(assigns)
    );
    console.log("✔ تم إصلاح الواجبات تلقائيًا باستخدام البريد");
  }
}

function listenToNotifications() {
  const current = JSON.parse(
    localStorage.getItem("arp.current") || "null"
  );

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
      list.innerHTML =
        `<div class="notify-empty">لا توجد إشعارات</div>`;
      count.classList.add("hidden");
      return;
    }

    const NOTIFY_TTL = 12 * 60 * 60 * 1000; // 12 ساعة

    snap.forEach(docSnap => {
      const n = docSnap.data();

      // ⏳ تجاهل الإشعار المقروء القديم
      if (
        n.isRead &&
        n.readAt &&
        Date.now() - n.readAt > NOTIFY_TTL
      ) {
        return;
      }

      // 🔢 عدّ غير المقروء
      if (!n.isRead) unread++;

      const item = document.createElement("div");
      item.className =
        "notify-item" + (!n.isRead ? " unread" : "");

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

async function markNotificationsAsRead() {
  const current = JSON.parse(
    localStorage.getItem("arp.current") || "null"
  );

  if (!current || !current.email || !window.db) return;

  const q = query(
    collection(window.db, "notifications"),
    where("studentId", "==", current.email),
    where("isRead", "==", false)
  );

  const snap = await getDocs(q);

  snap.forEach(docSnap => {
    updateDoc(
      doc(window.db, "notifications", docSnap.id),
      {
        isRead: true,
        readAt: Date.now() // ⭐ مهم للخطوة القادمة
      }
    );
  });
}

function listenToReadingStats() {
  const current = readJSON(LS.CURRENT, null);
  if (!current || current.role !== "student" || !window.db) return;

  const ref = doc(
    window.db,
    "readingStats",
    current.email
  );

  onSnapshot(ref, snap => {
    if (!snap.exists()) return;

    const s = snap.data();

    // السكة اليمنى
    updateRailFromStats(s);
    renderStaticNoorBadges();

    // التقارير
    updateReportsFromStats(s);
    updateReportsChart(s);
  });
}

// ------------------------------------------------------
// Boot
// ------------------------------------------------------
async function startApp() {
  // 1) قراءة المستخدم الحالي
  let current = JSON.parse(
    localStorage.getItem("arp.current") || "null"
  );

  console.log("DEBUG CURRENT =", current);

  if (!current || !current.email) {
    localStorage.removeItem("arp.current");
    $('#authView').classList.remove('hidden');
    $('#appShell').classList.add('hidden');
    return;
  }

  // 3) إصلاح الواجبات القديمة
  // autoFixAssignments();

  // 4) التحكم في أزرار المعلم
  if (current.role === 'teacher') {
    $$('.only-teacher').forEach(
      btn => (btn.style.display = 'inline-block')
    );
  } else {
    $$('.only-teacher').forEach(
      btn => (btn.style.display = 'none')
    );
  }

  // 5) تعبئة بيانات المستخدم
  $('#helloName').textContent =
    'مرحبًا ' + current.name + '!';
  $('#userName').textContent = current.name;
  $('#userRoleLabel').textContent =
    current.role === 'teacher' ? 'معلم' : 'طالب';

  setUnifiedAvatar(current.role);

  // 6) إظهار التطبيق
  $('#authView').classList.add('hidden');
  $('#appShell').classList.remove('hidden');
  $('#readerView').classList.add('hidden');

  buildNav(current.role);
  renderLevels();
  renderBooks('ALL');
  renderStudentAssignments('required');

  // 7) تحميل بيانات الواجبات (طالب)
  if (current.role === 'student') {
    let classId = current.classId || null;

    if (!classId) {
      classId = await findClassIdForStudent(
        current.email || current.id
      );
    }

    if (classId) {
      writeJSON(LS.CURRENT, { ...current, classId });
      syncAssignmentsFromFirestore(classId);
      loadStudentAnswersFromFirestore(classId, current.id);
      syncBooksWithFirestore(classId);
    } else {
      console.warn(
        "⚠️ لم يتم العثور على فصل مرتبط بهذا الطالب."
      );
    }

    listenToReadingStats();
  }

  // 7 مكرر) مزامنة الواجبات (معلم)
  if (current.role === 'teacher') {
    let classId = current.classId || null;

    if (!classId) {
      const c = getTeacherClass(current.id);
      if (c) classId = c.id;
    }

    if (classId) {
      await syncAssignmentsFromFirestore(classId);
      await syncBooksWithFirestore(classId);
    }
  }

  // 8) بناء أجزاء الصفحة
  await renderTeacherStudents();
  await renderTeacherView();

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
  if (closeId)
    document.getElementById(closeId).classList.add('hidden');
});

document.addEventListener('DOMContentLoaded', () => {
  // تبويب auth
  $$('[data-auth]').forEach(btn =>
    btn.onclick = () => {
      $$('[data-auth]').forEach(b =>
        b.classList.remove('active')
      );
      btn.classList.add('active');

      if (btn.dataset.auth === 'login') {
        $('#loginForm').classList.remove('hidden');
        $('#regForm').classList.add('hidden');
      } else {
        $('#regForm').classList.remove('hidden');
        $('#loginForm').classList.add('hidden');
      }
    }
  );

  $('#loginForm').addEventListener('submit', loginUser);
  $('#regForm').addEventListener('submit', registerUser);

  $('#searchBooks')?.addEventListener(
    'input',
    () => renderBooks('ALL')
  );

  // تبديل تبويبات الواجبات للطالب
  $$('#tab-assign .pill').forEach(p =>
    p.onclick = () => {
      $$('#tab-assign .pill').forEach(x =>
        x.classList.remove('active')
      );
      p.classList.add('active');
      renderStudentAssignments(p.dataset.filter);
    }
  );

  // أزرار إدارة المنصة
  document.addEventListener('click', (e) => {
    if (e.target.id === 'addStudentBtn')
      openAddStudentModal();

    if (e.target.id === 'saveStudent')
      saveStudent();

    if (e.target.id === 'newAssignBtn')
      openCreateAssignment();

    if (e.target.id === 'saveAssign')
      saveAssignment();

    if (e.target.id === 'saveBook')
      saveBook();

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

  // قارئ القصص
  $('#backToApp').addEventListener('click', backToApp);
  $('#startRec').addEventListener('click', startRecording);
  $('#stopRec').addEventListener('click', stopRecording);
  $('#playRec').addEventListener('click', playRecording);

  $('#closeQuiz')?.addEventListener('click', () => {
    $('#modalQuiz').classList.add('hidden');
  });

  // زر فتح الأنشطة للقصة الحالية
  document
    .getElementById("openActivitiesBtn")
    ?.addEventListener("click", () => {
      if (
        !currentBook ||
        !currentBook.quiz ||
        !currentBook.quiz.length
      ) {
        toast("لا توجد أنشطة لهذه القصة");
        return;
      }

      const box = $('#quizContent');
      box.innerHTML = '';

      currentBook.quiz.forEach((q, i) => {
        const div = document.createElement('div');
        div.className = 'quiz-block';

        const optsHtml = q.options
          .map(
            (opt, idx) => `
              <label style="display:block;margin:.2rem 0">
                <input type="radio" name="q${i}" value="${idx}">
                ${opt}
              </label>
            `
          )
          .join('');

        div.innerHTML = `
          <p><b>${i + 1}.</b> ${q.q}</p>
          ${optsHtml}
        `;

        box.appendChild(div);
      });

      // إظهار نافذة الاختبار
      $('#modalQuiz').classList.remove('hidden');

      // ✅ ربط زر الإنهاء بعد ظهور المودال
      setTimeout(() => {
        const btn = document.getElementById("submitQuiz");
        if (!btn) return;

        btn.onclick = () => {
          if (!currentBook || !currentBook.quiz) {
            toast("لا توجد أنشطة لهذه القصة");
            return;
          }

          let score = 0;
          currentBook.quiz.forEach((q, i) => {
            const selected =
              document.querySelector(
                `input[name="q${i}"]:checked`
              );
            if (
              selected &&
              Number(selected.value) === q.correct
            ) {
              score++;
            }
          });

          // تسجيل النشاط
          addActivity();

          // إغلاق النافذة
          document
            .getElementById("modalQuiz")
            .classList.add('hidden');

          toast(
            `✓ تم إنهاء النشاط. نتيجتك: ${score}/${currentBook.quiz.length}`
          );
        };
      }, 0);
    });

  // 🔔 فتح / إغلاق لوحة الإشعارات
  document
    .getElementById("notifyBtn")
    ?.addEventListener("click", async (e) => {
      e.stopPropagation();

      const panel =
        document.getElementById("notifyPanel");
      panel?.classList.toggle("hidden");

      // ✅ إذا فُتحت اللوحة → اعتبر الإشعارات مقروءة
      if (!panel?.classList.contains("hidden")) {
        markNotificationsAsRead();
      }
    });

  // إغلاقها عند الضغط خارجها
  document.addEventListener("click", () => {
    document
      .getElementById("notifyPanel")
      ?.classList.add("hidden");
  });

  // ============================================
  // زر الخروج
  $('#logoutBtn')?.addEventListener(
    'click',
    confirmLogout
  );

  // تشغيل التطبيق مباشرة لو فيه مستخدم محفوظ
  startApp();
});



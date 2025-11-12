<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>نظام الطلب الموحد | Liumexcode</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600&display=swap');
    body {
      font-family: 'Cairo', sans-serif;
      background: linear-gradient(135deg, #0d0d2b, #1b1b4d);
      color: #fff;
      margin: 0;
      padding: 0;
      text-align: center;
    }
    header {
      background: rgba(0,0,0,0.4);
      padding: 1rem;
      font-size: 1.4rem;
      color: #00bfff;
      font-weight: 600;
    }
    form {
      background: rgba(255,255,255,0.08);
      margin: 2rem auto;
      padding: 2rem;
      border-radius: 15px;
      width: 90%;
      max-width: 450px;
      text-align: right;
      direction: rtl;
      backdrop-filter: blur(10px);
    }
    h2 {
      color: #00bfff;
      margin-top: 0;
      text-align: center;
    }
    label {
      display: block;
      margin-top: 1rem;
      font-weight: 600;
    }
    input, select, textarea {
      width: 100%;
      padding: 0.7rem;
      border: none;
      border-radius: 8px;
      margin-top: 0.4rem;
      background: rgba(255,255,255,0.15);
      color: #fff;
      font-size: 1rem;
      outline: none;
    }
    input::placeholder, textarea::placeholder {
      color: #ccc;
    }
    button {
      background: #00bfff;
      border: none;
      color: #fff;
      padding: 0.9rem 1.2rem;
      border-radius: 10px;
      cursor: pointer;
      margin-top: 1.2rem;
      transition: 0.3s;
      font-size: 1rem;
      width: 100%;
    }
    button:hover {
      background: #0095cc;
    }
    .success {
      color: #00ff99;
      font-weight: bold;
      margin-top: 1rem;
      text-align: center;
    }
  </style>
</head>
<body>
  <header>💻 نظام الطلب الموحد — Liumexcode</header>

  <form id="requestForm">
    <h2>طلب خدمة</h2>

    <label>👤 الاسم الكامل</label>
    <input type="text" id="name" placeholder="أدخل اسمك الكامل" required>

    <label>📱 رقم الهاتف</label>
    <input type="text" id="phone" placeholder="أدخل رقم الهاتف" required>

    <label>🔧 نوع الخدمة</label>
    <select id="service" onchange="updateFields()" required>
      <option value="">-- اختر الخدمة --</option>
      <option value="samsung">فتح أجهزة سامسونج</option>
      <option value="honor">إزالة FRP لهواتف هونر</option>
      <option value="icloud">فتح iCloud</option>
      <option value="support">الدعم الفني</option>
    </select>

    <div id="extraFields"></div>

    <button type="button" onclick="submitUnifiedForm()">إرسال الطلب</button>

    <p id="successMsg" class="success"></p>
  </form>

  <script>
    function updateFields() {
      const service = document.getElementById("service").value;
      const extra = document.getElementById("extraFields");
      extra.innerHTML = "";

      if (service === "samsung") {
        extra.innerHTML = `
          <label>📟 رقم IMEI</label>
          <input type="text" id="imei" placeholder="أدخل رقم IMEI" required>
        `;
      } else if (service === "honor") {
        extra.innerHTML = `
          <label>🔢 الرقم التسلسلي SN</label>
          <input type="text" id="sn" placeholder="أدخل الرقم التسلسلي" required>
        `;
      } else if (service === "icloud") {
        extra.innerHTML = `
          <label>🆔 حساب iCloud أو ملاحظات إضافية</label>
          <textarea id="icloudInfo" placeholder="أدخل معلومات الحساب أو الملاحظات" rows="3" required></textarea>
        `;
      } else if (service === "support") {
        extra.innerHTML = `
          <label>💬 وصف المشكلة</label>
          <textarea id="message" placeholder="صف مشكلتك هنا" rows="3" required></textarea>
        `;
      }
    }

    function submitUnifiedForm() {
      const name = document.getElementById("name").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const service = document.getElementById("service").value;
      if (!name || !phone || !service) return alert("⚠️ الرجاء تعبئة جميع الحقول الأساسية.");

      let details = "";
      if (service === "samsung") {
        const imei = document.getElementById("imei").value.trim();
        if (!imei) return alert("⚠️ الرجاء إدخال رقم IMEI");
        details = `رقم IMEI: ${imei}`;
      } else if (service === "honor") {
        const sn = document.getElementById("sn").value.trim();
        if (!sn) return alert("⚠️ الرجاء إدخال الرقم التسلسلي SN");
        details = `الرقم التسلسلي: ${sn}`;
      } else if (service === "icloud") {
        const icloud = document.getElementById("icloudInfo").value.trim();
        if (!icloud) return alert("⚠️ الرجاء إدخال تفاصيل iCloud");
        details = `تفاصيل الحساب: ${icloud}`;
      } else if (service === "support") {
        const msg = document.getElementById("message").value.trim();
        if (!msg) return alert("⚠️ الرجاء كتابة مشكلتك");
        details = `وصف المشكلة: ${msg}`;
      }

      // رسالة الإيميل (هنا يمكنك لاحقاً ربطه بـ PHP أو Google Form)
      const emailTo = "liumexcode@gmail.com"; // ← ضع بريدك هنا
      const subject = encodeURIComponent(`طلب خدمة جديد من ${name}`);
      const body = encodeURIComponent(`الاسم: ${name}\nالهاتف: ${phone}\nالخدمة: ${service}\n${details}`);
      window.open(`mailto:${emailTo}?subject=${subject}&body=${body}`);

      document.getElementById("successMsg").innerText = "✅ تم استلام طلبك بنجاح، الطلب قيد المعالجة.";
      document.getElementById("requestForm").reset();
      document.getElementById("extraFields").innerHTML = "";
    }
  </script>
</body>
</html>

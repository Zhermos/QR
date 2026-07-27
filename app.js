// ====================================================================
// QRCraft — Full QR Code Generator Application Logic
// All DOM references are initialized inside DOMContentLoaded to ensure
// elements exist before we access them (critical for GitHub Pages).
// ====================================================================

// --- Utility functions (no DOM dependency) ---

function showToast(message) {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-message');
    if (!toast || !toastMsg) return;
    toastMsg.textContent = message;
    toast.classList.remove('hidden');
    if (window._toastTimeout) clearTimeout(window._toastTimeout);
    window._toastTimeout = setTimeout(() => toast.classList.add('hidden'), 3000);
}

function escapeWifiString(str) {
    if (!str) return '';
    return str.replace(/\\/g, '\\\\')
              .replace(/;/g, '\\;')
              .replace(/:/g, '\\:')
              .replace(/,/g, '\\,')
              .replace(/"/g, '\\"');
}

function formatVCalendarDate(dateTimeStr) {
    if (!dateTimeStr) return '';
    return dateTimeStr.replace(/[-:]/g, '') + '00';
}

// --- Main Application Boot ---

document.addEventListener('DOMContentLoaded', function () {

    // ---- Cached DOM references ----
    const mainCanvas       = document.getElementById('qr-canvas');
    const logoImg          = new Image();

    const qrFgColorInput   = document.getElementById('qr-fg-color');
    const qrFgHexInput     = document.getElementById('qr-fg-hex');
    const qrBgColorInput   = document.getElementById('qr-bg-color');
    const qrBgHexInput     = document.getElementById('qr-bg-hex');
    const qrGradStartInput = document.getElementById('qr-grad-start');
    const qrGradStartHex   = document.getElementById('qr-grad-start-hex');
    const qrGradEndInput   = document.getElementById('qr-grad-end');
    const qrGradEndHex     = document.getElementById('qr-grad-end-hex');
    const qrGradDirSelect  = document.getElementById('qr-grad-dir');

    const qrSizeSelect     = document.getElementById('qr-size');
    const qrMarginSelect   = document.getElementById('qr-margin');
    const qrEccSelect      = document.getElementById('qr-ecc');

    const logoUploadInput  = document.getElementById('logo-upload');
    const logoPreviewImg   = document.getElementById('logo-preview-img');
    const logoPlaceholder  = document.getElementById('logo-preview-placeholder');
    const btnRemoveLogo    = document.getElementById('btn-remove-logo');
    const logoSizeRange    = document.getElementById('logo-size');
    const logoSizeVal      = document.getElementById('logo-size-val');
    const logoBorderCb     = document.getElementById('logo-border');

    // ---- Helper: Sync color picker <-> hex text input ----
    function syncColorPicker(pickerId, hexId) {
        const picker = document.getElementById(pickerId);
        const hex    = document.getElementById(hexId);
        if (!picker || !hex) return;
        picker.addEventListener('input', function () {
            hex.value = picker.value.toUpperCase();
            generateQRCode();
        });
        hex.addEventListener('input', function () {
            let v = hex.value.trim();
            if (!v.startsWith('#')) v = '#' + v;
            if (/^#[0-9A-Fa-f]{6}$/.test(v)) { picker.value = v; generateQRCode(); }
        });
    }

    // ---- Helper: draw logo on center of canvas ----
    function drawLogoOnCanvas(ctx, size) {
        const pct      = parseInt(logoSizeRange.value) / 100;
        const logoSize = size * pct;
        const x = (size - logoSize) / 2;
        const y = (size - logoSize) / 2;

        if (logoBorderCb.checked) {
            const pad = logoSize * 0.15;
            const r   = logoSize * 0.1;
            ctx.fillStyle = qrBgColorInput.value;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2, r);
            } else {
                ctx.rect(x - pad, y - pad, logoSize + pad * 2, logoSize + pad * 2);
            }
            ctx.fill();
        }
        ctx.drawImage(logoImg, x, y, logoSize, logoSize);
    }

    // ---- Build data string for active tab ----
    function getQRData() {
        const activeTab = document.querySelector('.tab-btn.active');
        if (!activeTab) return '';
        const tab = activeTab.getAttribute('data-tab');

        switch (tab) {
            case 'url': {
                let url = document.getElementById('url-input').value.trim();
                if (!url) return '';
                if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
                return url;
            }
            case 'text':
                return document.getElementById('text-input').value;

            case 'wifi': {
                const ssid = document.getElementById('wifi-ssid').value.trim();
                const pw   = document.getElementById('wifi-password').value;
                const enc  = document.getElementById('wifi-encryption').value;
                const hid  = document.getElementById('wifi-hidden').checked;
                if (!ssid) return '';
                let s = 'WIFI:S:' + escapeWifiString(ssid) + ';T:' + enc + ';';
                if (enc !== 'nopass' && pw) s += 'P:' + escapeWifiString(pw) + ';';
                if (hid) s += 'H:true;';
                s += ';';
                return s;
            }
            case 'vcard': {
                const fn = document.getElementById('vcard-fn').value.trim();
                const ln = document.getElementById('vcard-ln').value.trim();
                if (!fn && !ln) return '';
                const mob   = document.getElementById('vcard-mobile').value.trim();
                const work  = document.getElementById('vcard-work').value.trim();
                const email = document.getElementById('vcard-email').value.trim();
                const url   = document.getElementById('vcard-url').value.trim();
                const org   = document.getElementById('vcard-org').value.trim();
                const title = document.getElementById('vcard-title').value.trim();
                const addr  = document.getElementById('vcard-address').value.trim();
                let v = 'BEGIN:VCARD\nVERSION:3.0\n';
                v += 'N:' + ln + ';' + fn + ';;;\n';
                v += 'FN:' + fn + ' ' + ln + '\n';
                if (org)   v += 'ORG:' + org + '\n';
                if (title) v += 'TITLE:' + title + '\n';
                if (mob)   v += 'TEL;TYPE=CELL:' + mob + '\n';
                if (work)  v += 'TEL;TYPE=WORK:' + work + '\n';
                if (email) v += 'EMAIL;TYPE=PREF,INTERNET:' + email + '\n';
                if (addr)  v += 'ADR;TYPE=WORK:;;' + addr + ';;;;\n';
                if (url)   v += 'URL:' + url + '\n';
                v += 'END:VCARD';
                return v;
            }
            case 'email': {
                const to = document.getElementById('email-to').value.trim();
                if (!to) return '';
                const subj = document.getElementById('email-subject').value.trim();
                const body = document.getElementById('email-body').value;
                let mailto = 'mailto:' + to;
                const p = [];
                if (subj) p.push('subject=' + encodeURIComponent(subj));
                if (body) p.push('body=' + encodeURIComponent(body));
                if (p.length) mailto += '?' + p.join('&');
                return mailto;
            }
            case 'sms': {
                const phone = document.getElementById('sms-phone').value.trim();
                if (!phone) return '';
                const msg = document.getElementById('sms-message').value;
                let sms = 'sms:' + phone;
                if (msg) sms += '?body=' + encodeURIComponent(msg);
                return sms;
            }
            case 'tel': {
                const phone = document.getElementById('tel-number').value.trim();
                return phone ? 'tel:' + phone : '';
            }
            case 'whatsapp': {
                let ph = document.getElementById('wa-phone').value.trim();
                if (!ph) return '';
                if (ph.startsWith('0')) ph = ph.substring(1);
                let wa = 'https://wa.me/66' + ph;
                const msg = document.getElementById('wa-message').value;
                if (msg) wa += '?text=' + encodeURIComponent(msg);
                return wa;
            }
            case 'social': {
                const plat  = document.getElementById('social-platform').value;
                const input = document.getElementById('social-input').value.trim();
                if (!input) return '';
                if (/^https?:\/\//i.test(input)) return input;
                const map = {
                    facebook:  'https://facebook.com/',
                    instagram: 'https://instagram.com/',
                    x:         'https://x.com/',
                    youtube:   'https://youtube.com/@',
                    tiktok:    'https://tiktok.com/@',
                    linkedin:  'https://linkedin.com/in/',
                    line:      'https://line.me/ti/p/~'
                };
                return (map[plat] || '') + input;
            }
            case 'crypto': {
                const coin = document.getElementById('crypto-coin').value;
                const addr = document.getElementById('crypto-address').value.trim();
                const amt  = document.getElementById('crypto-amount').value.trim();
                if (!addr) return '';
                const prefix = { bitcoin:'bitcoin:', ethereum:'ethereum:', solana:'solana:', dogecoin:'doge:', binance:'binance:' };
                const amtKey = { ethereum:'?value=' };
                let uri = (prefix[coin] || '') + addr;
                if (amt) uri += (amtKey[coin] || '?amount=') + amt;
                return uri;
            }
            case 'event': {
                const title = document.getElementById('event-title').value.trim();
                if (!title) return '';
                const start = document.getElementById('event-start').value;
                const end   = document.getElementById('event-end').value;
                const loc   = document.getElementById('event-location').value.trim();
                const desc  = document.getElementById('event-desc').value;
                let cal = 'BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\n';
                cal += 'SUMMARY:' + title + '\n';
                if (start) cal += 'DTSTART:' + formatVCalendarDate(start) + '\n';
                if (end)   cal += 'DTEND:' + formatVCalendarDate(end) + '\n';
                if (loc)   cal += 'LOCATION:' + loc + '\n';
                if (desc)  cal += 'DESCRIPTION:' + desc + '\n';
                cal += 'END:VEVENT\nEND:VCALENDAR';
                return cal;
            }
            case 'location': {
                const lat = document.getElementById('geo-lat').value.trim();
                const lng = document.getElementById('geo-lng').value.trim();
                if (!lat || !lng) return '';
                return 'https://www.google.com/maps/search/?api=1&query=' + lat + ',' + lng;
            }
            default: return '';
        }
    }

    // ---- Update character / byte counter ----
    function updateStats(dataText) {
        const charEl = document.getElementById('char-counter');
        const sizeEl = document.getElementById('data-size');
        if (!charEl || !sizeEl) return;
        const len = dataText.length;
        charEl.textContent = len + ' อักขระ';
        if (len === 0) { sizeEl.textContent = 'รอข้อมูล...'; return; }
        const bytes = new Blob([dataText]).size;
        sizeEl.textContent = 'ขนาดข้อมูล: ' + (bytes < 1024 ? bytes + ' Bytes' : (bytes / 1024).toFixed(2) + ' KB');
    }

    // ---- Core: draw QR code on Canvas ----
    function drawQRCode(qrDataText) {
        if (typeof QRCode === 'undefined') {
            showToast('ไม่พบโมดูลสร้าง QR Code – กรุณารีเฟรชหน้าเว็บ');
            return;
        }

        const size   = parseInt(qrSizeSelect.value)   || 512;
        const margin = parseInt(qrMarginSelect.value)  || 4;
        const ecc    = qrEccSelect.value || 'H';
        const isGrad = document.querySelector('input[name="color-mode"]:checked').value === 'gradient';
        const bgColor = qrBgColorInput.value;

        QRCode.toCanvas(mainCanvas, qrDataText, {
            errorCorrectionLevel: ecc,
            margin: margin,
            width: size,
            color: { dark: '#000000FF', light: '#00000000' }
        }, function (err) {
            if (err) {
                console.error(err);
                showToast('ข้อมูลมากเกินไป – ลดข้อมูลหรือปรับ Error Correction เป็น L');
                return;
            }

            const ctx = mainCanvas.getContext('2d');

            // Step 1 – color the black modules
            ctx.globalCompositeOperation = 'source-in';
            if (isGrad) {
                const gs = qrGradStartInput.value;
                const ge = qrGradEndInput.value;
                const gd = qrGradDirSelect.value;
                let g;
                if (gd === 'vertical')        g = ctx.createLinearGradient(0, 0, 0, size);
                else if (gd === 'horizontal')  g = ctx.createLinearGradient(0, 0, size, 0);
                else if (gd === 'diagonal')    g = ctx.createLinearGradient(0, 0, size, size);
                else                           g = ctx.createRadialGradient(size/2, size/2, 10, size/2, size/2, size/2);
                g.addColorStop(0, gs);
                g.addColorStop(1, ge);
                ctx.fillStyle = g;
            } else {
                ctx.fillStyle = qrFgColorInput.value;
            }
            ctx.fillRect(0, 0, size, size);

            // Step 2 – fill background behind modules
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = bgColor;
            ctx.fillRect(0, 0, size, size);

            // Step 3 – reset & draw logo
            ctx.globalCompositeOperation = 'source-over';
            if (logoImg.src && logoImg.complete && logoImg.naturalWidth > 0) {
                drawLogoOnCanvas(ctx, size);
            }
        });
    }

    // ---- Master trigger ----
    function generateQRCode() {
        const data = getQRData();
        updateStats(data);
        const ph = document.getElementById('qr-placeholder');
        if (!data) {
            mainCanvas.style.display = 'none';
            if (ph) ph.classList.add('placeholder-active');
            return;
        }
        mainCanvas.style.display = 'block';
        if (ph) ph.classList.remove('placeholder-active');
        drawQRCode(data);
    }

    // ---- SVG export ----
    function generateSVGString(text, size, margin, ecc, fg, bg, isGrad, gs, ge, gd) {
        if (typeof QRCode === 'undefined') return null;
        try {
            const qr = QRCode.create(text, { errorCorrectionLevel: ecc });
            const n  = qr.modules.size;
            const vs = n + margin * 2;
            let svg = '<?xml version="1.0" encoding="utf-8"?>\n';
            svg += '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + vs + ' ' + vs + '" width="' + size + '" height="' + size + '">\n';
            svg += '  <rect width="' + vs + '" height="' + vs + '" fill="' + bg + '" />\n';
            if (isGrad) {
                svg += '  <defs>\n';
                if (gd === 'horizontal')     svg += '    <linearGradient id="qg" x1="0%" y1="0%" x2="100%" y2="0%">\n';
                else if (gd === 'diagonal')  svg += '    <linearGradient id="qg" x1="0%" y1="0%" x2="100%" y2="100%">\n';
                else                         svg += '    <linearGradient id="qg" x1="0%" y1="0%" x2="0%" y2="100%">\n';
                svg += '      <stop offset="0%" stop-color="' + gs + '" />\n';
                svg += '      <stop offset="100%" stop-color="' + ge + '" />\n';
                svg += '    </linearGradient>\n  </defs>\n';
            }
            let d = '';
            for (let r = 0; r < n; r++)
                for (let c = 0; c < n; c++)
                    if (qr.modules.get(c, r)) d += 'M' + (c + margin) + ',' + (r + margin) + 'h1v1h-1z ';
            svg += '  <path d="' + d.trim() + '" fill="' + (isGrad ? 'url(#qg)' : fg) + '" />\n';
            svg += '</svg>';
            return svg;
        } catch (e) { console.error(e); return null; }
    }

    // ---- Init datetime defaults ----
    function initDateTimeInputs() {
        const now   = new Date();
        const se    = document.getElementById('event-start');
        const ee    = document.getElementById('event-end');
        if (!se || !ee) return;
        const tz    = now.getTimezoneOffset() * 60000;
        se.value = new Date(now - tz).toISOString().slice(0, 16);
        ee.value = new Date(now.getTime() + 3600000 - tz).toISOString().slice(0, 16);
    }

    // ============================================================
    //  BOOT SEQUENCE
    // ============================================================

    // 1) datetime defaults
    try { initDateTimeInputs(); } catch (e) { console.error(e); }

    // 2) Lucide icons
    try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) { console.error(e); }

    // 3) first render
    try { generateQRCode(); } catch (e) { console.error(e); }

    // 4) Tab switching
    var tabBtns     = document.querySelectorAll('.tab-btn');
    var tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            tabBtns.forEach(function (b) { b.classList.remove('active'); });
            tabContents.forEach(function (c) { c.classList.remove('active'); });
            btn.classList.add('active');
            var id = btn.getAttribute('data-tab');
            var el = document.getElementById('content-' + id);
            if (el) el.classList.add('active');
            generateQRCode();
        });
    });

    // 5) Accordion
    var accHeaders = document.querySelectorAll('.accordion-header');
    if (accHeaders.length) accHeaders[0].parentElement.classList.add('active');
    accHeaders.forEach(function (h) {
        h.addEventListener('click', function () {
            var item = h.parentElement;
            var wasActive = item.classList.contains('active');
            document.querySelectorAll('.accordion-item').forEach(function (i) { i.classList.remove('active'); });
            if (!wasActive) item.classList.add('active');
        });
    });

    // 6) Bind all inputs → regenerate
    document.querySelectorAll('input, textarea, select').forEach(function (el) {
        if (el.id && (el.id.endsWith('-hex') || el.id === 'logo-upload')) return;
        el.addEventListener('input',  generateQRCode);
        el.addEventListener('change', generateQRCode);
    });

    // 7) Color picker sync
    syncColorPicker('qr-fg-color',   'qr-fg-hex');
    syncColorPicker('qr-bg-color',   'qr-bg-hex');
    syncColorPicker('qr-grad-start', 'qr-grad-start-hex');
    syncColorPicker('qr-grad-end',   'qr-grad-end-hex');

    // 8) Solid / Gradient toggle
    document.querySelectorAll('input[name="color-mode"]').forEach(function (r) {
        r.addEventListener('change', function () {
            var sol  = document.getElementById('solid-color-settings');
            var grad = document.getElementById('gradient-color-settings');
            if (this.value === 'gradient') { sol.classList.add('hidden'); grad.classList.remove('hidden'); }
            else                           { sol.classList.remove('hidden'); grad.classList.add('hidden'); }
            generateQRCode();
        });
    });

    // 9) GPS location
    var btnLoc = document.getElementById('btn-get-location');
    if (btnLoc) {
        btnLoc.addEventListener('click', function () {
            if (!navigator.geolocation) { showToast('เบราว์เซอร์ไม่รองรับ GPS'); return; }
            btnLoc.textContent = 'กำลังดึงพิกัด...';
            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    document.getElementById('geo-lat').value = pos.coords.latitude.toFixed(6);
                    document.getElementById('geo-lng').value = pos.coords.longitude.toFixed(6);
                    btnLoc.textContent = 'ใช้พิกัดปัจจุบันของฉัน';
                    generateQRCode();
                    showToast('ดึงพิกัดสำเร็จ!');
                },
                function (err) {
                    btnLoc.textContent = 'ใช้พิกัดปัจจุบันของฉัน';
                    showToast('ไม่สามารถเข้าถึงพิกัด: ' + err.message);
                }
            );
        });
    }

    // 10) Social platform select
    var socSel   = document.getElementById('social-platform');
    var socLabel = document.getElementById('social-label-text');
    if (socSel && socLabel) {
        socSel.addEventListener('change', function () {
            socLabel.textContent = this.value === 'line'
                ? 'Line ID หรือ ลิงก์ Add Friend'
                : 'ชื่อผู้ใช้ (Username) หรือ ลิงก์โปรไฟล์';
            generateQRCode();
        });
    }

    // 11) Logo upload
    if (logoUploadInput) {
        logoUploadInput.addEventListener('change', function (e) {
            var file = e.target.files[0];
            if (!file) return;
            if (file.size > 512000) { showToast('ไฟล์ใหญ่เกิน 500KB'); return; }
            var reader = new FileReader();
            reader.onload = function (ev) {
                logoImg.src = ev.target.result;
                logoImg.onload = function () {
                    logoPreviewImg.src = ev.target.result;
                    logoPreviewImg.classList.remove('hidden');
                    logoPlaceholder.classList.add('hidden');
                    btnRemoveLogo.classList.remove('hidden');
                    generateQRCode();
                };
            };
            reader.readAsDataURL(file);
        });
    }

    if (btnRemoveLogo) {
        btnRemoveLogo.addEventListener('click', function () {
            logoUploadInput.value = '';
            logoImg.src = '';
            logoPreviewImg.src = '#';
            logoPreviewImg.classList.add('hidden');
            logoPlaceholder.classList.remove('hidden');
            btnRemoveLogo.classList.add('hidden');
            generateQRCode();
        });
    }

    if (logoSizeRange) {
        logoSizeRange.addEventListener('input', function () {
            logoSizeVal.textContent = this.value + '%';
            generateQRCode();
        });
    }

    if (logoBorderCb) logoBorderCb.addEventListener('change', generateQRCode);

    // 12) Export buttons
    var btnPng = document.getElementById('btn-download-png');
    if (btnPng) {
        btnPng.addEventListener('click', function () {
            if (!getQRData()) { showToast('กรุณากรอกข้อมูลก่อน'); return; }
            var a = document.createElement('a');
            a.download = 'qrcraft-code.png';
            a.href = mainCanvas.toDataURL('image/png');
            a.click();
            showToast('ดาวน์โหลด PNG สำเร็จ!');
        });
    }

    var btnCopy = document.getElementById('btn-copy');
    if (btnCopy) {
        btnCopy.addEventListener('click', function () {
            if (!getQRData()) { showToast('กรุณากรอกข้อมูลก่อน'); return; }
            mainCanvas.toBlob(function (blob) {
                if (!blob) { showToast('เกิดข้อผิดพลาด'); return; }
                try {
                    navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]).then(
                        function () { showToast('คัดลอกรูปภาพแล้ว!'); },
                        function (e) { showToast('คัดลอกไม่สำเร็จ: ' + e.message); }
                    );
                } catch (e) { showToast('เบราว์เซอร์ไม่รองรับการคัดลอกรูปภาพ'); }
            }, 'image/png');
        });
    }

    var btnSvg = document.getElementById('btn-download-svg');
    if (btnSvg) {
        btnSvg.addEventListener('click', function () {
            var data = getQRData();
            if (!data) { showToast('กรุณากรอกข้อมูลก่อน'); return; }
            var size   = parseInt(qrSizeSelect.value)  || 512;
            var margin = parseInt(qrMarginSelect.value) || 4;
            var ecc    = qrEccSelect.value || 'H';
            var isGrad = document.querySelector('input[name="color-mode"]:checked').value === 'gradient';
            var svg = generateSVGString(data, size, margin, ecc,
                qrFgColorInput.value, qrBgColorInput.value,
                isGrad, qrGradStartInput.value, qrGradEndInput.value, qrGradDirSelect.value);
            if (!svg) { showToast('ไม่สามารถสร้าง SVG ได้'); return; }
            var blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
            var a = document.createElement('a');
            a.download = 'qrcraft-code.svg';
            a.href = URL.createObjectURL(blob);
            a.click();
            showToast('ดาวน์โหลด SVG สำเร็จ!');
        });
    }

}); // end DOMContentLoaded

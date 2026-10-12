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

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function normalizeGoogleDriveUrl(url, mode) {
    if (!url) return '';
    const match = url.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?id=)([a-zA-Z0-9_-]+)/i);
    if (!match) return url;
    const fileId = match[1];
    if (mode === 'image') {
        return 'https://lh3.googleusercontent.com/d/' + fileId;
    }
    // PDF or Video preview direct viewer
    return 'https://drive.google.com/file/d/' + fileId + '/preview';
}

function extractYouTubeId(url) {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=|shorts\/)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function normalizeVideoUrl(url) {
    if (!url) return '';
    if (url.includes('drive.google.com')) {
        return normalizeGoogleDriveUrl(url, 'video');
    }
    return url;
}

function uploadFileToCloud(file, progressBar, progressWrapper, statusLabel, percentLabel, onComplete, onError) {
    if (progressWrapper) progressWrapper.classList.remove('hidden');
    if (progressBar) progressBar.style.width = '0%';
    if (percentLabel) percentLabel.textContent = '0%';
    if (statusLabel) statusLabel.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> กำลังอัปโหลดขึ้น Cloud...';
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const formData = new FormData();
    formData.append('file', file);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', 'https://tmpfiles.org/api/v1/upload', true);

    xhr.upload.onprogress = function (e) {
        if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            if (progressBar) progressBar.style.width = pct + '%';
            if (percentLabel) percentLabel.textContent = pct + '%';
        }
    };

    xhr.onload = function () {
        if (xhr.status >= 200 && xhr.status < 300) {
            try {
                const json = JSON.parse(xhr.responseText);
                if (json && json.data && json.data.url) {
                    const directUrl = json.data.url.replace('https://tmpfiles.org/', 'https://tmpfiles.org/dl/');
                    if (progressBar) progressBar.style.width = '100%';
                    if (percentLabel) percentLabel.textContent = '100%';
                    if (statusLabel) statusLabel.innerHTML = '<i data-lucide="check-circle-2" style="color:var(--success)"></i> อัปโหลดสำเร็จ!';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    setTimeout(function () {
                        if (progressWrapper) progressWrapper.classList.add('hidden');
                    }, 2500);
                    onComplete(directUrl);
                    return;
                }
            } catch (err) {
                console.error(err);
            }
        }
        handleFail('การประมวลผลล้มเหลว');
    };

    xhr.onerror = function () {
        handleFail('ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์อัปโหลดได้');
    };

    function handleFail(msg) {
        if (statusLabel) statusLabel.innerHTML = '<i data-lucide="alert-circle" style="color:var(--danger)"></i> ' + msg;
        if (typeof lucide !== 'undefined') lucide.createIcons();
        if (onError) onError(msg);
        showToast('อัปโหลดไม่สำเร็จ: ' + msg);
    }

    xhr.send(formData);
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
            case 'pdf': {
                const isUpload = document.querySelector('#pdf-mode-pills .submode-pill.active')?.getAttribute('data-submode') === 'upload';
                if (isUpload) {
                    return document.getElementById('pdf-direct-url').value.trim();
                } else {
                    let u = document.getElementById('pdf-link-input').value.trim();
                    if (!u) return '';
                    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
                    if (u.includes('drive.google.com')) u = normalizeGoogleDriveUrl(u, 'pdf');
                    return u;
                }
            }
            case 'image': {
                const isUpload = document.querySelector('#image-mode-pills .submode-pill.active')?.getAttribute('data-submode') === 'upload';
                if (isUpload) {
                    return document.getElementById('img-direct-url').value.trim();
                } else {
                    let u = document.getElementById('img-link-input').value.trim();
                    if (!u) return '';
                    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
                    if (u.includes('drive.google.com')) u = normalizeGoogleDriveUrl(u, 'image');
                    return u;
                }
            }
            case 'video': {
                const isUpload = document.querySelector('#video-mode-pills .submode-pill.active')?.getAttribute('data-submode') === 'upload';
                if (isUpload) {
                    return document.getElementById('video-direct-url').value.trim();
                } else {
                    let u = document.getElementById('video-link-input').value.trim();
                    if (!u) return '';
                    if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
                    return normalizeVideoUrl(u);
                }
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
            try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
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
        if (el.type === 'file' || (el.id && (el.id.endsWith('-hex') || el.id === 'scanner-result-text'))) return;
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

    // ============================================================
    // 13) Submode Pill Switching (PDF, Image, Video)
    // ============================================================
    document.querySelectorAll('.submode-pills').forEach(function (container) {
        var pills = container.querySelectorAll('.submode-pill');
        pills.forEach(function (pill) {
            pill.addEventListener('click', function () {
                pills.forEach(function (p) { p.classList.remove('active'); });
                pill.classList.add('active');
                var panelId = pill.getAttribute('data-panel');
                var parentTab = container.closest('.tab-content');
                if (parentTab) {
                    parentTab.querySelectorAll('.submode-panel').forEach(function (panel) {
                        panel.classList.add('hidden');
                        panel.classList.remove('active');
                    });
                    var targetPanel = parentTab.querySelector('#' + panelId);
                    if (targetPanel) {
                        targetPanel.classList.remove('hidden');
                        targetPanel.classList.add('active');
                    }
                }
                generateQRCode();
            });
        });
    });

    // Helper: Setup Drag & Drop on a dropzone
    function setupDropzone(dropzoneEl, fileInputEl, onFileDrop) {
        if (!dropzoneEl || !fileInputEl) return;
        dropzoneEl.addEventListener('click', function (e) {
            if (e.target.closest('button') || e.target.closest('a') || e.target.closest('video')) return;
            fileInputEl.click();
        });
        ['dragenter', 'dragover'].forEach(function (evName) {
            dropzoneEl.addEventListener(evName, function (e) {
                e.preventDefault();
                e.stopPropagation();
                dropzoneEl.classList.add('dragover');
            });
        });
        ['dragleave', 'drop'].forEach(function (evName) {
            dropzoneEl.addEventListener(evName, function (e) {
                e.preventDefault();
                e.stopPropagation();
                dropzoneEl.classList.remove('dragover');
            });
        });
        dropzoneEl.addEventListener('drop', function (e) {
            var files = e.dataTransfer.files;
            if (files && files.length > 0) {
                onFileDrop(files[0]);
            }
        });
        fileInputEl.addEventListener('change', function (e) {
            if (e.target.files && e.target.files.length > 0) {
                onFileDrop(e.target.files[0]);
            }
        });
    }

    // ============================================================
    // 14) PDF Tab Handlers
    // ============================================================
    var pdfDropzone      = document.getElementById('pdf-dropzone');
    var pdfFileInput     = document.getElementById('pdf-file-input');
    var pdfDropzoneInner = document.getElementById('pdf-dropzone-inner');
    var pdfFileCard      = document.getElementById('pdf-file-card');
    var pdfFileName      = document.getElementById('pdf-file-name');
    var pdfFileSize      = document.getElementById('pdf-file-size');
    var btnRemovePdf     = document.getElementById('btn-remove-pdf-file');
    var pdfProgressWrap  = document.getElementById('pdf-progress-wrapper');
    var pdfProgressBar   = document.getElementById('pdf-progress-bar');
    var pdfProgressStatus= document.getElementById('pdf-progress-status');
    var pdfProgressPct   = document.getElementById('pdf-progress-percent');
    var pdfDirectUrl     = document.getElementById('pdf-direct-url');
    var pdfLinkInput     = document.getElementById('pdf-link-input');
    var btnTestPdf       = document.getElementById('btn-test-pdf');
    var btnTestPdfLink   = document.getElementById('btn-test-pdf-link');

    setupDropzone(pdfDropzone, pdfFileInput, function (file) {
        if (!file) return;
        if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
            showToast('กรุณาเลือกไฟล์ PDF เท่านั้น');
            return;
        }
        if (file.size > 104857600) {
            showToast('ไฟล์มีขนาดเกิน 100MB');
            return;
        }
        pdfFileName.textContent = file.name;
        pdfFileSize.textContent = formatFileSize(file.size);
        pdfDropzoneInner.classList.add('hidden');
        pdfFileCard.classList.remove('hidden');

        uploadFileToCloud(
            file,
            pdfProgressBar,
            pdfProgressWrap,
            pdfProgressStatus,
            pdfProgressPct,
            function (url) {
                pdfDirectUrl.value = url;
                btnTestPdf.disabled = false;
                generateQRCode();
                showToast('อัปโหลด PDF และสร้าง QR Code สำเร็จ!');
            },
            function () {
                btnTestPdf.disabled = true;
            }
        );
    });

    if (btnRemovePdf) {
        btnRemovePdf.addEventListener('click', function (e) {
            e.stopPropagation();
            pdfFileInput.value = '';
            pdfDirectUrl.value = '';
            btnTestPdf.disabled = true;
            pdfFileCard.classList.add('hidden');
            pdfDropzoneInner.classList.remove('hidden');
            if (pdfProgressWrap) pdfProgressWrap.classList.add('hidden');
            generateQRCode();
        });
    }

    if (btnTestPdf) {
        btnTestPdf.addEventListener('click', function () {
            var u = pdfDirectUrl.value.trim();
            if (u) window.open(u, '_blank');
        });
    }

    if (pdfDirectUrl) {
        pdfDirectUrl.addEventListener('input', function () {
            btnTestPdf.disabled = !this.value.trim();
            generateQRCode();
        });
    }

    if (pdfLinkInput) {
        pdfLinkInput.addEventListener('input', function () {
            btnTestPdfLink.disabled = !this.value.trim();
            generateQRCode();
        });
    }

    if (btnTestPdfLink) {
        btnTestPdfLink.addEventListener('click', function () {
            var u = pdfLinkInput.value.trim();
            if (u) window.open(normalizeGoogleDriveUrl(u, 'pdf'), '_blank');
        });
    }

    // PDF Presets
    var presetPdfGdrive = document.getElementById('preset-pdf-gdrive');
    if (presetPdfGdrive) {
        presetPdfGdrive.addEventListener('click', function () {
            pdfLinkInput.placeholder = 'https://drive.google.com/file/d/YOUR_FILE_ID/view?usp=sharing';
            pdfLinkInput.focus();
            showToast('วางลิงก์ Google Drive ของไฟล์ PDF ได้เลย ระบบจะแปลงให้อัตโนมัติ');
        });
    }
    var presetPdfCanva = document.getElementById('preset-pdf-canva');
    if (presetPdfCanva) {
        presetPdfCanva.addEventListener('click', function () {
            pdfLinkInput.placeholder = 'https://www.canva.com/design/.../view';
            pdfLinkInput.focus();
            showToast('วางลิงก์ Canva PDF ของคุณได้เลย');
        });
    }
    var presetPdfOnedrive = document.getElementById('preset-pdf-onedrive');
    if (presetPdfOnedrive) {
        presetPdfOnedrive.addEventListener('click', function () {
            pdfLinkInput.placeholder = 'https://1drv.ms/b/...';
            pdfLinkInput.focus();
            showToast('วางลิงก์ OneDrive ได้เลย');
        });
    }

    // ============================================================
    // 15) Image Tab Handlers
    // ============================================================
    var imgDropzone       = document.getElementById('img-dropzone');
    var imgFileInput      = document.getElementById('img-file-input');
    var imgDropzoneInner  = document.getElementById('img-dropzone-inner');
    var imgPreviewCard    = document.getElementById('img-preview-card');
    var imgFileThumb      = document.getElementById('img-file-thumb');
    var imgFileName       = document.getElementById('img-file-name');
    var imgFileSize       = document.getElementById('img-file-size');
    var btnRemoveImg      = document.getElementById('btn-remove-img-file');
    var imgProgressWrap   = document.getElementById('img-progress-wrapper');
    var imgProgressBar    = document.getElementById('img-progress-bar');
    var imgProgressStatus = document.getElementById('img-progress-status');
    var imgProgressPct    = document.getElementById('img-progress-percent');
    var imgDirectUrl      = document.getElementById('img-direct-url');
    var imgLinkInput      = document.getElementById('img-link-input');
    var btnTestImg        = document.getElementById('btn-test-img');
    var btnTestImgLink    = document.getElementById('btn-test-img-link');

    setupDropzone(imgDropzone, imgFileInput, function (file) {
        if (!file) return;
        if (!file.type.startsWith('image/')) {
            showToast('กรุณาเลือกไฟล์รูปภาพเท่านั้น');
            return;
        }
        if (file.size > 52428800) {
            showToast('ไฟล์มีขนาดเกิน 50MB');
            return;
        }
        imgFileName.textContent = file.name;
        imgFileSize.textContent = formatFileSize(file.size);

        var reader = new FileReader();
        reader.onload = function (ev) {
            imgFileThumb.src = ev.target.result;
            imgDropzoneInner.classList.add('hidden');
            imgPreviewCard.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        uploadFileToCloud(
            file,
            imgProgressBar,
            imgProgressWrap,
            imgProgressStatus,
            imgProgressPct,
            function (url) {
                imgDirectUrl.value = url;
                btnTestImg.disabled = false;
                generateQRCode();
                showToast('อัปโหลดรูปภาพและสร้าง QR Code สำเร็จ!');
            },
            function () {
                btnTestImg.disabled = true;
            }
        );
    });

    if (btnRemoveImg) {
        btnRemoveImg.addEventListener('click', function (e) {
            e.stopPropagation();
            imgFileInput.value = '';
            imgDirectUrl.value = '';
            btnTestImg.disabled = true;
            imgPreviewCard.classList.add('hidden');
            imgDropzoneInner.classList.remove('hidden');
            if (imgProgressWrap) imgProgressWrap.classList.add('hidden');
            generateQRCode();
        });
    }

    if (btnTestImg) {
        btnTestImg.addEventListener('click', function () {
            var u = imgDirectUrl.value.trim();
            if (u) window.open(u, '_blank');
        });
    }

    if (imgDirectUrl) {
        imgDirectUrl.addEventListener('input', function () {
            btnTestImg.disabled = !this.value.trim();
            generateQRCode();
        });
    }

    if (imgLinkInput) {
        imgLinkInput.addEventListener('input', function () {
            btnTestImgLink.disabled = !this.value.trim();
            generateQRCode();
        });
    }

    if (btnTestImgLink) {
        btnTestImgLink.addEventListener('click', function () {
            var u = imgLinkInput.value.trim();
            if (u) window.open(normalizeGoogleDriveUrl(u, 'image'), '_blank');
        });
    }

    // Image Presets
    var presetImgGdrive = document.getElementById('preset-img-gdrive');
    if (presetImgGdrive) {
        presetImgGdrive.addEventListener('click', function () {
            imgLinkInput.placeholder = 'https://drive.google.com/file/d/YOUR_IMAGE_ID/view?usp=sharing';
            imgLinkInput.focus();
            showToast('วางลิงก์ Google Drive ของรูปภาพได้เลย');
        });
    }
    var presetImgImgur = document.getElementById('preset-img-imgur');
    if (presetImgImgur) {
        presetImgImgur.addEventListener('click', function () {
            imgLinkInput.placeholder = 'https://i.imgur.com/...';
            imgLinkInput.focus();
            showToast('วางลิงก์ Imgur ได้เลย');
        });
    }
    var presetImgIcloud = document.getElementById('preset-img-icloud');
    if (presetImgIcloud) {
        presetImgIcloud.addEventListener('click', function () {
            imgLinkInput.placeholder = 'https://share.icloud.com/photos/...';
            imgLinkInput.focus();
            showToast('วางลิงก์ iCloud รูปภาพได้เลย');
        });
    }

    // ============================================================
    // 16) Video Tab Handlers
    // ============================================================
    var videoDropzone       = document.getElementById('video-dropzone');
    var videoFileInput      = document.getElementById('video-file-input');
    var videoDropzoneInner  = document.getElementById('video-dropzone-inner');
    var videoFileCard       = document.getElementById('video-file-card');
    var videoLocalPlayer    = document.getElementById('video-local-player');
    var videoFileName       = document.getElementById('video-file-name');
    var videoFileSize       = document.getElementById('video-file-size');
    var btnRemoveVideo      = document.getElementById('btn-remove-video-file');
    var videoProgressWrap   = document.getElementById('video-progress-wrapper');
    var videoProgressBar    = document.getElementById('video-progress-bar');
    var videoProgressStatus = document.getElementById('video-progress-status');
    var videoProgressPct    = document.getElementById('video-progress-percent');
    var videoDirectUrl      = document.getElementById('video-direct-url');
    var videoLinkInput      = document.getElementById('video-link-input');
    var btnTestVideo        = document.getElementById('btn-test-video');
    var btnTestVideoLink    = document.getElementById('btn-test-video-link');
    var videoEmbedWrapper   = document.getElementById('video-embed-preview');
    var videoEmbedContainer = document.getElementById('video-embed-container');

    setupDropzone(videoDropzone, videoFileInput, function (file) {
        if (!file) return;
        if (!file.type.startsWith('video/') && !file.name.match(/\.(mp4|mov|webm|m4v|mkv)$/i)) {
            showToast('กรุณาเลือกไฟล์คลิปวิดีโอเท่านั้น');
            return;
        }
        if (file.size > 104857600) {
            showToast('ไฟล์วิดีโอมีขนาดเกิน 100MB');
            return;
        }
        videoFileName.textContent = file.name;
        videoFileSize.textContent = formatFileSize(file.size);

        var blobUrl = URL.createObjectURL(file);
        videoLocalPlayer.src = blobUrl;
        videoDropzoneInner.classList.add('hidden');
        videoFileCard.classList.remove('hidden');

        uploadFileToCloud(
            file,
            videoProgressBar,
            videoProgressWrap,
            videoProgressStatus,
            videoProgressPct,
            function (url) {
                videoDirectUrl.value = url;
                btnTestVideo.disabled = false;
                generateQRCode();
                showToast('อัปโหลดคลิปวิดีโอและสร้าง QR Code สำเร็จ!');
            },
            function () {
                btnTestVideo.disabled = true;
            }
        );
    });

    if (btnRemoveVideo) {
        btnRemoveVideo.addEventListener('click', function (e) {
            e.stopPropagation();
            videoFileInput.value = '';
            videoDirectUrl.value = '';
            if (videoLocalPlayer.src) {
                videoLocalPlayer.pause();
                videoLocalPlayer.src = '';
            }
            btnTestVideo.disabled = true;
            videoFileCard.classList.add('hidden');
            videoDropzoneInner.classList.remove('hidden');
            if (videoProgressWrap) videoProgressWrap.classList.add('hidden');
            generateQRCode();
        });
    }

    if (btnTestVideo) {
        btnTestVideo.addEventListener('click', function () {
            var u = videoDirectUrl.value.trim();
            if (u) window.open(u, '_blank');
        });
    }

    if (videoDirectUrl) {
        videoDirectUrl.addEventListener('input', function () {
            btnTestVideo.disabled = !this.value.trim();
            generateQRCode();
        });
    }

    // Video Link embed preview helper
    function updateVideoEmbedPreview(url) {
        if (!videoEmbedWrapper || !videoEmbedContainer) return;
        var ytId = extractYouTubeId(url);
        if (ytId) {
            videoEmbedContainer.innerHTML = '<iframe src="https://www.youtube.com/embed/' + ytId + '" frameborder="0" allowfullscreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe>';
            videoEmbedWrapper.classList.remove('hidden');
            return;
        }
        if (/\.(mp4|webm|mov)(\?|$)/i.test(url)) {
            videoEmbedContainer.innerHTML = '<video src="' + url + '" controls style="width:100%; height:220px;"></video>';
            videoEmbedWrapper.classList.remove('hidden');
            return;
        }
        videoEmbedContainer.innerHTML = '';
        videoEmbedWrapper.classList.add('hidden');
    }

    if (videoLinkInput) {
        videoLinkInput.addEventListener('input', function () {
            var val = this.value.trim();
            btnTestVideoLink.disabled = !val;
            updateVideoEmbedPreview(val);
            generateQRCode();
        });
    }

    if (btnTestVideoLink) {
        btnTestVideoLink.addEventListener('click', function () {
            var u = videoLinkInput.value.trim();
            if (u) window.open(normalizeVideoUrl(u), '_blank');
        });
    }

    // Video Presets
    var presetVidYt = document.getElementById('preset-video-youtube');
    if (presetVidYt) {
        presetVidYt.addEventListener('click', function () {
            videoLinkInput.placeholder = 'https://www.youtube.com/watch?v=... หรือ shorts/...';
            videoLinkInput.focus();
            showToast('วางลิงก์ YouTube ได้เลย');
        });
    }
    var presetVidTt = document.getElementById('preset-video-tiktok');
    if (presetVidTt) {
        presetVidTt.addEventListener('click', function () {
            videoLinkInput.placeholder = 'https://www.tiktok.com/@user/video/...';
            videoLinkInput.focus();
            showToast('วางลิงก์ TikTok ได้เลย');
        });
    }
    var presetVidReels = document.getElementById('preset-video-reels');
    if (presetVidReels) {
        presetVidReels.addEventListener('click', function () {
            videoLinkInput.placeholder = 'https://www.instagram.com/reel/...';
            videoLinkInput.focus();
            showToast('วางลิงก์ Instagram Reels ได้เลย');
        });
    }
    var presetVidGdrive = document.getElementById('preset-video-gdrive');
    if (presetVidGdrive) {
        presetVidGdrive.addEventListener('click', function () {
            videoLinkInput.placeholder = 'https://drive.google.com/file/d/YOUR_VIDEO_ID/view?usp=sharing';
            videoLinkInput.focus();
            showToast('วางลิงก์ Google Drive คลิปวิดีโอได้เลย');
        });
    }

    // ============================================================
    // 17) QR Code Scanner / Decoder Handlers
    // ============================================================
    var btnOpenScanner     = document.getElementById('btn-open-scanner');
    var btnCloseScanner    = document.getElementById('btn-close-scanner');
    var scannerModal       = document.getElementById('scanner-modal');
    var scannerDropzone    = document.getElementById('scanner-dropzone');
    var scannerFileInput   = document.getElementById('scanner-file-input');
    var scannerPreviewBox  = document.getElementById('scanner-preview-box');
    var scannerPreviewImg  = document.getElementById('scanner-preview-img');
    var scannerStatusText  = document.getElementById('scanner-status-text');
    var scannerResultBox   = document.getElementById('scanner-result-box');
    var scannerResultText  = document.getElementById('scanner-result-text');
    var btnCopyScan        = document.getElementById('btn-copy-scan');
    var btnOpenScanLink    = document.getElementById('btn-open-scan-link');
    var btnUseScanText     = document.getElementById('btn-use-scan-text');

    if (btnOpenScanner && scannerModal) {
        btnOpenScanner.addEventListener('click', function () {
            scannerModal.classList.remove('hidden');
            try { if (typeof lucide !== 'undefined') lucide.createIcons(); } catch (e) {}
        });
    }

    if (btnCloseScanner && scannerModal) {
        btnCloseScanner.addEventListener('click', function () {
            scannerModal.classList.add('hidden');
        });
    }

    if (scannerModal) {
        scannerModal.addEventListener('click', function (e) {
            if (e.target === scannerModal) scannerModal.classList.add('hidden');
        });
    }

    // Scanner file dropzone
    setupDropzone(scannerDropzone, scannerFileInput, function (file) {
        if (!file || !file.type.startsWith('image/')) {
            showToast('กรุณาเลือกไฟล์ภาพ QR Code');
            return;
        }

        var reader = new FileReader();
        reader.onload = function (ev) {
            var dataUrl = ev.target.result;
            scannerPreviewImg.src = dataUrl;
            scannerPreviewBox.classList.remove('hidden');
            scannerResultBox.classList.add('hidden');
            scannerStatusText.innerHTML = '<i data-lucide="loader-2" class="animate-spin"></i> กำลังถอดรหัส QR Code...';
            if (typeof lucide !== 'undefined') lucide.createIcons();

            var scanImg = new Image();
            scanImg.onload = function () {
                var cvs = document.createElement('canvas');
                cvs.width = scanImg.naturalWidth;
                cvs.height = scanImg.naturalHeight;
                var ctx = cvs.getContext('2d');
                ctx.drawImage(scanImg, 0, 0);

                // 1. Try native BarcodeDetector if available
                if ('BarcodeDetector' in window) {
                    try {
                        var detector = new BarcodeDetector({ formats: ['qr_code'] });
                        detector.detect(cvs).then(function (barcodes) {
                            if (barcodes && barcodes.length > 0) {
                                onScanSuccess(barcodes[0].rawValue);
                            } else {
                                fallbackToJsQR();
                            }
                        }).catch(function () {
                            fallbackToJsQR();
                        });
                        return;
                    } catch (e) {
                        fallbackToJsQR();
                        return;
                    }
                } else {
                    fallbackToJsQR();
                }

                function fallbackToJsQR() {
                    // 2. Try jsQR
                    if (typeof jsQR !== 'undefined') {
                        try {
                            var imgData = ctx.getImageData(0, 0, cvs.width, cvs.height);
                            var code = jsQR(imgData.data, imgData.width, imgData.height, {
                                inversionAttempts: 'attemptBoth'
                            });
                            if (code && code.data) {
                                onScanSuccess(code.data);
                                return;
                            }
                        } catch (err) {
                            console.error(err);
                        }
                    }
                    onScanFail();
                }

                function onScanSuccess(result) {
                    scannerStatusText.innerHTML = '<i data-lucide="check-circle-2" style="color:var(--success)"></i> ถอดรหัสสำเร็จ!';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                    scannerResultText.value = result;
                    scannerResultBox.classList.remove('hidden');

                    if (/^https?:\/\//i.test(result)) {
                        btnOpenScanLink.href = result;
                        btnOpenScanLink.classList.remove('hidden');
                    } else {
                        btnOpenScanLink.classList.add('hidden');
                    }
                }

                function onScanFail() {
                    scannerStatusText.innerHTML = '<i data-lucide="alert-triangle" style="color:var(--warning)"></i> ไม่พบ QR Code ในภาพนี้ กรุณาลองภาพที่คมชัดขึ้น';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            };
            scanImg.src = dataUrl;
        };
        reader.readAsDataURL(file);
    });

    if (btnCopyScan) {
        btnCopyScan.addEventListener('click', function () {
            var txt = scannerResultText.value;
            if (!txt) return;
            navigator.clipboard.writeText(txt).then(function () {
                showToast('คัดลอกข้อความสำเร็จ!');
            }).catch(function () {
                scannerResultText.select();
                document.execCommand('copy');
                showToast('คัดลอกสำเร็จ!');
            });
        });
    }

    if (btnUseScanText) {
        btnUseScanText.addEventListener('click', function () {
            var txt = scannerResultText.value.trim();
            if (!txt) return;
            scannerModal.classList.add('hidden');

            if (/^https?:\/\//i.test(txt)) {
                var urlTabBtn = document.querySelector('.tab-btn[data-tab="url"]');
                if (urlTabBtn) urlTabBtn.click();
                var urlInput = document.getElementById('url-input');
                if (urlInput) urlInput.value = txt;
            } else {
                var textTabBtn = document.querySelector('.tab-btn[data-tab="text"]');
                if (textTabBtn) textTabBtn.click();
                var textInput = document.getElementById('text-input');
                if (textInput) textInput.value = txt;
            }
            generateQRCode();
            showToast('นำข้อมูลเข้าสู่ตัวสร้าง QR Code สำเร็จ!');
        });
    }

}); // end DOMContentLoaded
